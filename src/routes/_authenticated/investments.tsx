import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

import {
  bootstrapQueryOptions,
  investmentsQueryOptions,
  type Investment,
} from "@/lib/finance-queries";
import { deleteInvestment, saveInvestment, investmentSchema } from "@/lib/finance.functions";
import {
  calculateInvestmentEarning,
  formatCompact,
  formatCurrency,
  formatDate,
  projectValue,
  sumMoney,
  todayISO,
  type CompoundingMethod,
} from "@/lib/finance-calc";
import {
  COMPOUNDING_OPTIONS,
  INVESTMENT_TYPE_LABELS,
  INVESTMENT_TYPE_OPTIONS,
  MARKET_LINKED_TYPES,
  PAYOUT_OPTIONS,
} from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  EmptyState,
  PageHeader,
  PageSkeleton,
  RouteError,
  RouteNotFound,
  StatCard,
} from "@/components/finance-ui";

export const Route = createFileRoute("/_authenticated/investments")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(investmentsQueryOptions()),
      context.queryClient.ensureQueryData(bootstrapQueryOptions()),
    ]),
  head: () => ({
    meta: [
      { title: "Investments — Artha" },
      {
        name: "description",
        content: "Track deposits, funds and holdings with return projections.",
      },
      { property: "og:title", content: "Investments — Artha" },
      {
        property: "og:description",
        content: "Track deposits, funds and holdings with return projections.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  pendingComponent: PageSkeleton,
  errorComponent: RouteError,
  notFoundComponent: () => <RouteNotFound />,
  component: InvestmentsPage,
});

type FormState = {
  name: string;
  type: string;
  institution: string;
  principal_amount: string;
  current_value: string;
  annual_rate: string;
  rate_type: string;
  start_date: string;
  maturity_date: string;
  compounding_method: string;
  payout_frequency: string;
  status: string;
  notes: string;
};

const blankForm: FormState = {
  name: "",
  type: "fd",
  institution: "",
  principal_amount: "",
  current_value: "",
  annual_rate: "0",
  rate_type: "fixed",
  start_date: todayISO(),
  maturity_date: "",
  compounding_method: "annually",
  payout_frequency: "monthly",
  status: "active",
  notes: "",
};

function toForm(inv: Investment): FormState {
  const cleanNotes = (inv.notes ?? "").replace(/<!--\s*dismissed:.*?-->/g, "").trim();
  return {
    name: inv.name,
    type: inv.type,
    institution: inv.institution ?? "",
    principal_amount: String(inv.principal_amount ?? ""),
    current_value: inv.current_value != null ? String(inv.current_value) : "",
    annual_rate: String(inv.annual_rate ?? "0"),
    rate_type: inv.rate_type,
    start_date: inv.start_date,
    maturity_date: inv.maturity_date ?? "",
    compounding_method: inv.compounding_method,
    payout_frequency: inv.payout_frequency,
    status: inv.status,
    notes: cleanNotes,
  };
}

function monthsUntil(iso: string | null, fallback: number): number {
  if (!iso) return fallback;
  const target = Date.parse(`${iso}T00:00:00`);
  if (Number.isNaN(target)) return fallback;
  return Math.max(1, Math.round((target - Date.parse(`${todayISO()}T00:00:00`)) / 2629800000));
}

function InvestmentsPage() {
  const { data } = useSuspenseQuery(investmentsQueryOptions());
  const { data: boot } = useSuspenseQuery(bootstrapQueryOptions());
  const currency = boot.settings.currency;
  const df = boot.settings.date_format as "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  const fmt = (v: number) => formatCurrency(v, currency);

  const queryClient = useQueryClient();
  const saveFn = useServerFn(saveInvestment);
  const deleteFn = useServerFn(deleteInvestment);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Investment | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["investments"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["income"] }),
      queryClient.invalidateQueries({ queryKey: ["reports"] }),
    ]);

  const save = useMutation({
    mutationFn: (values: typeof form) => {
      const num = (s: string) => (s.trim() === "" ? null : Number(s));
      return saveFn({
        data: {
          ...(editing ? { id: editing.id } : {}),
          name: values.name,
          type: values.type as never,
          institution: values.institution || null,
          principal_amount: num(values.principal_amount) ?? 0,
          current_value: num(values.current_value),
          annual_rate: num(values.annual_rate) ?? 0,
          rate_type: values.rate_type as never,
          start_date: values.start_date,
          maturity_date: values.maturity_date || null,
          compounding_method: values.compounding_method as never,
          payout_frequency: values.payout_frequency as never,
          status: values.status as never,
          notes: values.notes || null,
        },
      });
    },
    onSuccess: async (_res, _vars) => {
      await invalidate();
      toast.success(editing ? "Investment updated" : "Investment added");
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Investment removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openAdd() {
    setEditing(null);
    setForm(blankForm);
    setDialogOpen(true);
  }

  function openEdit(inv: Investment) {
    setEditing(inv);
    setForm(toForm(inv));
    setDialogOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || form.principal_amount.trim() === "") {
      toast.error("Name and principal amount are required");
      return;
    }
    save.mutate(form);
  }

  const set = (key: keyof FormState) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const totalPrincipal = sumMoney(
    data.investments
      .filter((i) => i.status !== "closed")
      .map((i) => Number(i.principal_amount || 0)),
  );
  const totalValue = sumMoney(
    data.investments
      .filter((i) => i.status !== "closed")
      .map((i) => Number(i.current_value ?? i.principal_amount ?? 0)),
  );
  const activeInvestments = data.investments.filter((i) => i.status === "active");
  const monthlyInterestTotal = sumMoney(
    activeInvestments.map((inv) => {
      const calc = calculateInvestmentEarning({
        principal: Number(inv.principal_amount || 0),
        annualRatePct: Number(inv.annual_rate || 0),
        payoutFrequency: inv.payout_frequency,
        compoundingMethod: inv.compounding_method as CompoundingMethod,
      });
      return calc.monthlyAmount;
    }),
  );
  const annualInterestTotal = sumMoney(
    activeInvestments.map((inv) => {
      const calc = calculateInvestmentEarning({
        principal: Number(inv.principal_amount || 0),
        annualRatePct: Number(inv.annual_rate || 0),
        payoutFrequency: inv.payout_frequency,
        compoundingMethod: inv.compounding_method as CompoundingMethod,
      });
      return calc.annualAmount;
    }),
  );

  const earningPreview = calculateInvestmentEarning({
    principal: Number(form.principal_amount) || 0,
    annualRatePct: Number(form.annual_rate) || 0,
    payoutFrequency: form.payout_frequency,
    compoundingMethod: form.compounding_method as CompoundingMethod,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Investments"
        description="Fixed deposits, funds, holdings — with automatic monthly interest calculation and income tracking."
        action={
          <Button onClick={openAdd}>
            <Plus className="size-4" /> Add investment
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Invested"
          value={fmt(totalPrincipal)}
          sub="Principal in active holdings"
        />
        <StatCard
          label="Portfolio Value"
          value={formatCompact(totalValue, currency)}
          sub="Current market & deposit value"
        />
        <StatCard
          label="Monthly Interest / ROI"
          value={fmt(monthlyInterestTotal)}
          tone="income"
          sub="Auto-credited to Monthly Income"
        />
        <StatCard
          label="Annual Interest Return"
          value={fmt(annualInterestTotal)}
          sub="Projected annual returns"
        />
      </div>

      {data.investments.length === 0 ? (
        <EmptyState
          title="No investments yet"
          hint="Add a fixed deposit, mutual fund or savings account to start tracking."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.investments.map((inv) => {
            const base = Number(inv.current_value ?? inv.principal_amount);
            const months = monthsUntil(inv.maturity_date, 12);
            const projection = projectValue({
              principal: base,
              annualRatePct: Number(inv.annual_rate),
              compounding: inv.compounding_method as never,
              months,
              monthlyContribution: inv.type === "rd" ? Number(inv.principal_amount) : 0,
            });
            const hypothetical = MARKET_LINKED_TYPES.has(inv.type);
            const earning = calculateInvestmentEarning({
              principal: Number(inv.principal_amount),
              annualRatePct: Number(inv.annual_rate),
              payoutFrequency: inv.payout_frequency,
              compoundingMethod: inv.compounding_method as CompoundingMethod,
            });
            return (
              <div key={inv.id} className="rounded-xl border bg-card p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display font-semibold">{inv.name}</h3>
                      <Badge variant="secondary">
                        {INVESTMENT_TYPE_LABELS[inv.type] ?? inv.type}
                      </Badge>
                      {inv.status !== "active" ? (
                        <Badge variant="outline">{inv.status}</Badge>
                      ) : null}
                    </div>
                    {inv.institution ? (
                      <p className="mt-1 text-xs text-muted-foreground">{inv.institution}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Edit"
                      onClick={() => openEdit(inv)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete"
                      className="text-destructive"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(inv.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-income/20 bg-income/5 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Interest Return ({earning.periodLabel})
                      </p>
                      <p className="font-display text-lg font-semibold text-income tabular-nums">
                        {fmt(earning.periodicAmount)}
                        {earning.payoutIntervalMonths && earning.payoutIntervalMonths > 1 ? (
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                            (~{fmt(earning.monthlyAmount)} / mo)
                          </span>
                        ) : null}
                      </p>
                    </div>
                    {earning.payoutIntervalMonths ? (
                      <Badge className="bg-income text-income-foreground text-xs font-normal">
                        Auto-credited to Income
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-xs font-normal text-muted-foreground"
                      >
                        Compounded
                      </Badge>
                    )}
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Principal</dt>
                    <dd className="tabular-nums font-medium">
                      {fmt(Number(inv.principal_amount))}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Current value</dt>
                    <dd className="tabular-nums font-medium">
                      {inv.current_value != null ? fmt(Number(inv.current_value)) : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Rate</dt>
                    <dd className="tabular-nums font-medium">
                      {Number(inv.annual_rate).toFixed(2)}% p.a. ({inv.rate_type})
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Payout</dt>
                    <dd className="font-medium capitalize">
                      {inv.payout_frequency.replace(/_/g, " ")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Expiry / Maturity</dt>
                    <dd className="font-medium">
                      {inv.maturity_date ? formatDate(inv.maturity_date, df) : "Open-ended"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Start date</dt>
                    <dd className="font-medium">{formatDate(inv.start_date, df)}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs text-muted-foreground">
                      {hypothetical
                        ? "Projection (hypothetical)"
                        : `Projection — next ${months} month${months === 1 ? "" : "s"}`}
                    </dt>
                    <dd className="tabular-nums font-medium text-income">
                      {fmt(projection.value)}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {hypothetical
                          ? `assumes ${Number(inv.annual_rate).toFixed(2)}% — market returns vary`
                          : `${formatDate(inv.start_date, df)}${inv.maturity_date ? ` → ${formatDate(inv.maturity_date, df)}` : ""}`}
                      </span>
                    </dd>
                  </div>
                </dl>
                {inv.notes?.replace(/<!--\s*dismissed:.*?-->/g, "").trim() ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {inv.notes.replace(/<!--\s*dismissed:.*?-->/g, "").trim()}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit investment" : "Add investment"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="inv-name">Name</Label>
              <Input
                id="inv-name"
                required
                value={form.name}
                onChange={(e) => set("name")(e.target.value)}
                placeholder="e.g. HDFC FD — 2 years"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={set("type")}>
                  <SelectTrigger aria-label="Investment type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVESTMENT_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-institution">Institution</Label>
                <Input
                  id="inv-institution"
                  value={form.institution}
                  onChange={(e) => set("institution")(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="inv-principal">Principal (₹)</Label>
                <Input
                  id="inv-principal"
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.principal_amount}
                  onChange={(e) => set("principal_amount")(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-current">Current value</Label>
                <Input
                  id="inv-current"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.current_value}
                  onChange={(e) => set("current_value")(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="inv-rate">Annual rate (%)</Label>
                <Input
                  id="inv-rate"
                  required
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.annual_rate}
                  onChange={(e) => set("annual_rate")(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Rate type</Label>
                <Select value={form.rate_type} onValueChange={set("rate_type")}>
                  <SelectTrigger aria-label="Rate type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="variable">Variable / market-linked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="inv-start">Start date</Label>
                <Input
                  id="inv-start"
                  required
                  type="date"
                  value={form.start_date}
                  onChange={(e) => set("start_date")(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-maturity">Maturity date</Label>
                <Input
                  id="inv-maturity"
                  type="date"
                  value={form.maturity_date}
                  onChange={(e) => set("maturity_date")(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Compounding</Label>
                <Select value={form.compounding_method} onValueChange={set("compounding_method")}>
                  <SelectTrigger aria-label="Compounding method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPOUNDING_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payout</Label>
                <Select value={form.payout_frequency} onValueChange={set("payout_frequency")}>
                  <SelectTrigger aria-label="Payout frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYOUT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={set("status")}>
                  <SelectTrigger aria-label="Status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="matured">Matured</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-notes">Notes</Label>
                <Input
                  id="inv-notes"
                  value={form.notes}
                  onChange={(e) => set("notes")(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
            {Number(form.principal_amount) > 0 && Number(form.annual_rate) > 0 ? (
              <div className="rounded-lg border border-income/30 bg-income/5 p-3.5 text-sm space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Estimated Monthly Earning
                  </span>
                  <span className="font-display font-semibold text-income tabular-nums">
                    {fmt(earningPreview.monthlyAmount)} / month
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Periodic Payout ({form.payout_frequency.replace(/_/g, " ")}):</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {fmt(earningPreview.periodicAmount)} {earningPreview.periodLabel}
                  </span>
                </div>
                {earningPreview.payoutIntervalMonths ? (
                  <p className="text-xs text-income pt-1 border-t border-income/10 font-medium">
                    ✓ Auto-credits each month to your "Income received" and "Income from Invest"
                    without any manual input.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground pt-1 border-t border-muted/20">
                    ℹ️ Reinvested: Interest compounds into value. Choose "Monthly" or "Quarterly" if
                    you receive periodic cash in hand.
                  </p>
                )}
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {editing ? "Save changes" : "Add investment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

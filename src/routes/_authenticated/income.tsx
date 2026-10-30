import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, BadgeCheck, RotateCcw } from "lucide-react";

import {
  bootstrapQueryOptions,
  incomeQueryOptions,
  investmentsQueryOptions,
  type IncomeRow,
} from "@/lib/finance-queries";
import { deleteIncome, incomeSchema, saveIncome } from "@/lib/finance.functions";
import { formatCurrency, formatDate, sumMoney, todayISO } from "@/lib/finance-calc";
import {
  INCOME_CATEGORY_LABELS,
  INCOME_CATEGORY_OPTIONS,
  RECURRENCE_LABELS,
  RECURRENCE_OPTIONS,
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/income")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(incomeQueryOptions()),
      context.queryClient.ensureQueryData(bootstrapQueryOptions()),
      context.queryClient.ensureQueryData(investmentsQueryOptions()),
    ]),
  head: () => ({
    meta: [
      { title: "Income — Artha" },
      {
        name: "description",
        content: "Salary, rental, freelance and investment income — received and expected.",
      },
      { property: "og:title", content: "Income — Artha" },
      { property: "og:description", content: "All income streams, received and expected." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  pendingComponent: PageSkeleton,
  errorComponent: RouteError,
  notFoundComponent: () => <RouteNotFound />,
  component: IncomePage,
});

type FormState = {
  title: string;
  category: string;
  amount: string;
  received_date: string;
  status: string;
  recurrence: string;
  investment_id: string;
  notes: string;
};

const blankForm: FormState = {
  title: "",
  category: "salary",
  amount: "",
  received_date: todayISO(),
  status: "received",
  recurrence: "one_time",
  investment_id: "none",
  notes: "",
};

function toForm(row: IncomeRow): FormState {
  return {
    title: row.title,
    category: row.category,
    amount: String(row.amount ?? ""),
    received_date: row.received_date,
    status: row.status,
    recurrence: row.recurrence,
    investment_id: row.investment_id ?? "none",
    notes: row.notes ?? "",
  };
}

function IncomePage() {
  const { data } = useSuspenseQuery(incomeQueryOptions());
  const { data: boot } = useSuspenseQuery(bootstrapQueryOptions());
  const { data: investmentsData } = useSuspenseQuery(investmentsQueryOptions());
  const currency = boot.settings.currency;
  const df = boot.settings.date_format as "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  const fmt = (v: number) => formatCurrency(v, currency);

  const queryClient = useQueryClient();
  const saveFn = useServerFn(saveIncome);
  const deleteFn = useServerFn(deleteIncome);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<IncomeRow | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);

  function invalidate() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ["income"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["reports"] }),
    ]);
  }

  const save = useMutation({
    mutationFn: (values: typeof form) => {
      const num = (s: string) => (s.trim() === "" ? null : Number(s));
      const parsed = {
        ...(editing ? { id: editing.id } : {}),
        title: values.title,
        category: values.category as never,
        amount: num(values.amount) ?? 0,
        received_date: values.received_date,
        status: values.status as never,
        recurrence: values.recurrence as never,
        investment_id: values.investment_id === "none" ? null : values.investment_id,
        notes: values.notes || null,
      };
      void incomeSchema;
      return saveFn({ data: parsed });
    },
    onSuccess: async () => {
      await invalidate();
      toast.success(editing ? "Income updated" : "Income added");
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ row, newStatus }: { row: IncomeRow; newStatus: "received" | "expected" }) =>
      saveFn({
        data: {
          id: row.id,
          title: row.title,
          category: row.category as never,
          amount: Number(row.amount),
          received_date: row.received_date,
          status: newStatus,
          recurrence: row.recurrence as never,
          investment_id: row.investment_id ?? null,
          notes: row.notes ?? null,
        },
      }),
    onSuccess: async (_res, vars) => {
      await invalidate();
      toast.success(
        vars.newStatus === "received" ? "Marked as received" : "Marked as pending / not received",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Income removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openAdd() {
    setEditing(null);
    setForm(blankForm);
    setDialogOpen(true);
  }

  function openEdit(row: IncomeRow) {
    setEditing(row);
    setForm(toForm(row));
    setDialogOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || form.amount.trim() === "" || Number(form.amount) <= 0) {
      toast.error("Title and a positive amount are required");
      return;
    }
    save.mutate(form);
  }

  const set = (key: keyof FormState) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const [filter, setFilter] = useState<"all" | "investments" | "other">("all");

  const curMonth = todayISO().slice(0, 7);
  const totalReceivedThisMonth = sumMoney(
    data.income
      .filter((r) => r.status === "received" && r.received_date.startsWith(curMonth))
      .map((r) => Number(r.amount)),
  );
  const investmentIncomeThisMonth = sumMoney(
    data.income
      .filter(
        (r) =>
          r.status === "received" &&
          r.category === "investment_income" &&
          r.received_date.startsWith(curMonth),
      )
      .map((r) => Number(r.amount)),
  );
  const totalExpectedThisMonth = sumMoney(
    data.income
      .filter((r) => r.status === "expected" && r.received_date.startsWith(curMonth))
      .map((r) => Number(r.amount)),
  );

  const filteredIncome = data.income.filter((row) => {
    if (filter === "investments") return row.category === "investment_income";
    if (filter === "other") return row.category !== "investment_income";
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Income"
        description="Expected amounts are forecasts — received income tracks your actual cash flow and investment earnings."
        action={
          <Button onClick={openAdd}>
            <Plus className="size-4" /> Add income
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Income received (This month)"
          value={fmt(totalReceivedThisMonth)}
          tone="income"
          sub="Actual received cash & interest"
        />
        <StatCard
          label="Income from Investments"
          value={fmt(investmentIncomeThisMonth)}
          tone="income"
          sub="Auto-tracked interest & ROI earnings"
        />
        <StatCard
          label="Expected this month"
          value={fmt(totalExpectedThisMonth)}
          sub="Forecasted receivables due this month"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          All Income ({data.income.length})
        </Button>
        <Button
          variant={filter === "investments" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("investments")}
        >
          Income from Investments (
          {data.income.filter((r) => r.category === "investment_income").length})
        </Button>
        <Button
          variant={filter === "other" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("other")}
        >
          Salary & Other ({data.income.filter((r) => r.category !== "investment_income").length})
        </Button>
      </div>

      {filteredIncome.length === 0 ? (
        <EmptyState
          title={
            filter === "investments"
              ? "No investment income found"
              : filter === "other"
                ? "No other income recorded"
                : "No income recorded yet"
          }
          hint={
            filter === "investments"
              ? "Active investments with regular payout (monthly or quarterly) will auto-generate income here."
              : "Add your salary, rent or freelance earnings."
          }
        />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {filteredIncome.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium">{row.title}</p>
                  <Badge
                    variant={row.status === "received" ? "default" : "outline"}
                    className={
                      row.status === "received"
                        ? "bg-income text-income-foreground"
                        : row.received_date < todayISO()
                          ? "border-amber-500/40 text-amber-500 bg-amber-500/10"
                          : ""
                    }
                  >
                    {row.status === "received"
                      ? "Received"
                      : row.received_date < todayISO()
                        ? "Pending / Not received"
                        : "Expected"}
                  </Badge>
                  {row.category === "investment_income" ? (
                    <Badge
                      variant="outline"
                      className="border-income/40 bg-income/10 text-income text-xs"
                    >
                      From Investment
                    </Badge>
                  ) : null}
                  {row.recurrence !== "one_time" ? (
                    <Badge variant="secondary">{RECURRENCE_LABELS[row.recurrence]}</Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {INCOME_CATEGORY_LABELS[row.category] ?? row.category} ·{" "}
                  {formatDate(row.received_date, df)}
                  {row.investment ? ` · ${row.investment.name}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {row.status === "expected" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-income hover:text-income"
                    disabled={toggleStatus.isPending}
                    onClick={() => toggleStatus.mutate({ row, newStatus: "received" })}
                  >
                    <BadgeCheck className="size-4 mr-1" /> Mark received
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    title="Mark not received / pending"
                    disabled={toggleStatus.isPending}
                    onClick={() => toggleStatus.mutate({ row, newStatus: "expected" })}
                  >
                    <RotateCcw className="size-3.5 mr-1" /> Mark not received
                  </Button>
                )}
                <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => openEdit(row)}>
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete"
                  className="text-destructive"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(row.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <span
                className={cn(
                  "w-28 text-right font-display text-sm font-semibold tabular-nums",
                  row.status === "received" ? "text-income" : "text-muted-foreground",
                )}
              >
                {fmt(Number(row.amount))}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit income" : "Add income"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="inc-title">Title</Label>
              <Input
                id="inc-title"
                required
                value={form.title}
                onChange={(e) => set("title")(e.target.value)}
                placeholder="e.g. October salary"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={set("category")}>
                  <SelectTrigger aria-label="Income category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INCOME_CATEGORY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="inc-amount">Amount (₹)</Label>
                <Input
                  id="inc-amount"
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => set("amount")(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="inc-date">
                  {form.status === "expected" ? "Expected on" : "Received on"}
                </Label>
                <Input
                  id="inc-date"
                  required
                  type="date"
                  value={form.received_date}
                  onChange={(e) => set("received_date")(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={set("status")}>
                  <SelectTrigger aria-label="Income status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="received">Received</SelectItem>
                    <SelectItem value="expected">Expected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Recurrence</Label>
                <Select value={form.recurrence} onValueChange={set("recurrence")}>
                  <SelectTrigger aria-label="Recurrence">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRENCE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.category === "investment_income" ? (
                <div className="space-y-2">
                  <Label>From investment</Label>
                  <Select value={form.investment_id} onValueChange={set("investment_id")}>
                    <SelectTrigger aria-label="Linked investment">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not linked</SelectItem>
                      {investmentsData.investments.map((inv) => (
                        <SelectItem key={inv.id} value={inv.id}>
                          {inv.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="inc-notes">Notes</Label>
              <Textarea
                id="inc-notes"
                rows={2}
                value={form.notes}
                onChange={(e) => set("notes")(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {editing ? "Save changes" : "Add income"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

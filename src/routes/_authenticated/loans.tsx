import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, BadgeCheck, Undo2 } from "lucide-react";

import { bootstrapQueryOptions, loansQueryOptions, type EmiRow, type Loan } from "@/lib/finance-queries";
import { deleteLoan, loanSchema, markEmiPaid, saveLoan, unmarkEmiPaid } from "@/lib/finance.functions";
import { formatCompact, formatCurrency, formatDate, todayISO } from "@/lib/finance-calc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
  EmptyState,
  PageHeader,
  PageSkeleton,
  RouteError,
  RouteNotFound,
} from "@/components/finance-ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/loans")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(loansQueryOptions()),
      context.queryClient.ensureQueryData(bootstrapQueryOptions()),
    ]),
  head: () => ({
    meta: [
      { title: "Loans & EMI — Artha" },
      { name: "description", content: "Loan schedules with one-tap EMI tracking that stays in sync with expenses." },
      { property: "og:title", content: "Loans & EMI — Artha" },
      { property: "og:description", content: "EMI schedules with paid tracking synced to expenses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  pendingComponent: PageSkeleton,
  errorComponent: RouteError,
  notFoundComponent: () => <RouteNotFound />,
  component: LoansPage,
});

type FormState = {
  name: string;
  lender: string;
  original_amount: string;
  emi_amount: string;
  interest_rate: string;
  start_date: string;
  monthly_due_day: string;
  remaining_installments: string;
  outstanding_principal: string;
  notes: string;
};

const blankForm: FormState = {
  name: "",
  lender: "",
  original_amount: "",
  emi_amount: "",
  interest_rate: "",
  start_date: todayISO(),
  monthly_due_day: "5",
  remaining_installments: "",
  outstanding_principal: "",
  notes: "",
};

function toForm(loan: Loan): FormState {
  return {
    name: loan.name,
    lender: loan.lender ?? "",
    original_amount: String(loan.original_amount ?? ""),
    emi_amount: String(loan.emi_amount ?? ""),
    interest_rate: loan.interest_rate != null ? String(loan.interest_rate) : "",
    start_date: loan.start_date,
    monthly_due_day: String(loan.monthly_due_day),
    remaining_installments: loan.remaining_installments != null ? String(loan.remaining_installments) : "",
    outstanding_principal: loan.outstanding_principal != null ? String(loan.outstanding_principal) : "",
    notes: loan.notes ?? "",
  };
}

function LoansPage() {
  const { data } = useSuspenseQuery(loansQueryOptions());
  const { data: boot } = useSuspenseQuery(bootstrapQueryOptions());
  const currency = boot.settings.currency;
  const df = boot.settings.date_format as "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  const fmt = (v: number) => formatCurrency(v, currency);

  const queryClient = useQueryClient();
  const saveFn = useServerFn(saveLoan);
  const deleteFn = useServerFn(deleteLoan);
  const markPaidFn = useServerFn(markEmiPaid);
  const unmarkPaidFn = useServerFn(unmarkEmiPaid);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Loan | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);

  function invalidate() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ["loans"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["reports"] }),
      queryClient.invalidateQueries({ queryKey: ["expenses"] }),
    ]);
  }

  const save = useMutation({
    mutationFn: (values: typeof form) => {
      void loanSchema;
      const num = (s: string) => (s.trim() === "" ? null : Number(s));
      return saveFn({
        data: {
          ...(editing ? { id: editing.id } : {}),
          name: values.name,
          lender: values.lender || null,
          original_amount: num(values.original_amount) ?? 0,
          emi_amount: num(values.emi_amount) ?? 0,
          interest_rate: num(values.interest_rate),
          start_date: values.start_date,
          monthly_due_day: Number(values.monthly_due_day),
          remaining_installments: num(values.remaining_installments),
          outstanding_principal: num(values.outstanding_principal),
          status: "active" as const,
          notes: values.notes || null,
        },
      });
    },
    onSuccess: async () => {
      await invalidate();
      toast.success(editing ? "Loan updated" : "Loan added with its EMI schedule");
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Loan removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markPaid = useMutation({
    mutationFn: (emi: EmiRow) => markPaidFn({ data: { emi_id: emi.id, paid_date: todayISO() } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("EMI marked paid — recorded once, as an expense");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unmarkPaid = useMutation({
    mutationFn: (emi: EmiRow) => unmarkPaidFn({ data: { emi_id: emi.id } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("EMI reverted to unpaid");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openAdd() {
    setEditing(null);
    setForm(blankForm);
    setDialogOpen(true);
  }

  function openEdit(loan: Loan) {
    setEditing(loan);
    setForm(toForm(loan));
    setDialogOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || Number(form.emi_amount) <= 0) {
      toast.error("Name and a positive EMI amount are required");
      return;
    }
    save.mutate(form);
  }

  const set = (key: keyof FormState) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Loans & EMI"
        description="Marking an EMI paid creates exactly one expense — never counted twice."
        action={
          <Button onClick={openAdd}>
            <Plus className="size-4" /> Add loan
          </Button>
        }
      />

      {data.loans.length === 0 ? (
        <EmptyState
          title="No loans yet"
          hint="Add a loan and Artha builds the full EMI schedule from its due day."
        />
      ) : (
        data.loans.map((loan) => {
          const emis = data.emis.filter((e) => e.loan_id === loan.id);
          const paid = emis.filter((e) => e.status === "paid").length;
          const pct = emis.length > 0 ? (paid / emis.length) * 100 : 0;
          return (
            <section key={loan.id} className="rounded-xl border bg-card">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display font-semibold">{loan.name}</h2>
                    <Badge variant={loan.status === "active" ? "default" : "outline"}
                      className={loan.status === "active" ? "bg-primary text-primary-foreground" : ""}>
                      {loan.status === "active" ? "Active" : "Closed"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {loan.lender ? `${loan.lender} · ` : ""}
                    {Number(loan.interest_rate ?? 0) > 0 ? `${Number(loan.interest_rate)}% p.a. · ` : ""}
                    due day {loan.monthly_due_day}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" aria-label={`Edit ${loan.name}`} onClick={() => openEdit(loan)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${loan.name}`}
                    className="text-destructive"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(loan.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 p-5 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Loan amount</p>
                  <p className="font-display font-semibold tabular-nums">{fmt(Number(loan.original_amount))}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Outstanding</p>
                  <p className="font-display font-semibold tabular-nums">
                    {loan.outstanding_principal != null ? fmt(Number(loan.outstanding_principal)) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">EMI</p>
                  <p className="font-display font-semibold tabular-nums">{fmt(Number(loan.emi_amount))} / month</p>
                </div>
                <div className="sm:col-span-3">
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {paid} of {emis.length} EMIs paid
                    </span>
                    <span className="tabular-nums">{pct.toFixed(0)}%</span>
                  </div>
                  <Progress value={pct} aria-label={`${loan.name} EMI progress`} />
                </div>
              </div>

              {emis.length > 0 ? (
                <div className="overflow-x-auto border-t">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-5 py-2 font-medium">#</th>
                        <th className="px-5 py-2 font-medium">Due date</th>
                        <th className="px-5 py-2 font-medium">Amount</th>
                        <th className="px-5 py-2 font-medium">Status</th>
                        <th className="px-5 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {emis.map((emi) => (
                        <tr key={emi.id} className="border-b last:border-0">
                          <td className="px-5 py-2.5 tabular-nums text-muted-foreground">{emi.installment_number}</td>
                          <td className="px-5 py-2.5 tabular-nums">{formatDate(emi.due_date, df)}</td>
                          <td className="px-5 py-2.5 tabular-nums">{fmt(Number(emi.amount))}</td>
                          <td className="px-5 py-2.5">
                            <Badge
                              className={cn(
                                emi.status === "paid" && "bg-income text-income-foreground",
                                emi.status === "overdue" && "bg-negative text-negative-foreground",
                              )}
                            >
                              {emi.status.charAt(0).toUpperCase() + emi.status.slice(1)}
                            </Badge>
                          </td>
                          <td className="px-5 py-2.5 text-right">
                            {emi.status === "paid" ? (
                              <Button variant="ghost" size="sm" disabled={unmarkPaid.isPending} onClick={() => unmarkPaid.mutate(emi)}>
                                <Undo2 className="size-4" /> Undo
                              </Button>
                            ) : (
                              <Button variant="ghost" size="sm" disabled={markPaid.isPending} onClick={() => markPaid.mutate(emi)}>
                                <BadgeCheck className="size-4" /> Mark paid
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>
          );
        })
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit loan" : "Add loan"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="loan-name">Name</Label>
                <Input id="loan-name" required value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder="e.g. Car loan" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loan-lender">Lender</Label>
                <Input id="loan-lender" value={form.lender} onChange={(e) => set("lender")(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="loan-amount">Loan amount (₹)</Label>
                <Input id="loan-amount" required type="number" min="0" step="0.01" value={form.original_amount} onChange={(e) => set("original_amount")(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loan-emi">Monthly EMI (₹)</Label>
                <Input id="loan-emi" required type="number" min="0.01" step="0.01" value={form.emi_amount} onChange={(e) => set("emi_amount")(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="loan-rate">Interest rate (%)</Label>
                <Input id="loan-rate" type="number" min="0" max="100" step="0.01" value={form.interest_rate} onChange={(e) => set("interest_rate")(e.target.value)} placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loan-start">Start date</Label>
                <Input id="loan-start" required type="date" value={form.start_date} onChange={(e) => set("start_date")(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="loan-day">EMI due day (1–28)</Label>
                <Input id="loan-day" required type="number" min="1" max="28" value={form.monthly_due_day} onChange={(e) => set("monthly_due_day")(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loan-count">Number of EMIs</Label>
                <Input
                  id="loan-count"
                  type="number"
                  min="1"
                  max="360"
                  value={form.remaining_installments}
                  onChange={(e) => set("remaining_installments")(e.target.value)}
                  placeholder="Auto from amount ÷ EMI"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="loan-outstanding">Outstanding principal (₹)</Label>
              <Input
                id="loan-outstanding"
                type="number"
                min="0"
                step="0.01"
                value={form.outstanding_principal}
                onChange={(e) => set("outstanding_principal")(e.target.value)}
                placeholder="Optional — tracked automatically as EMIs are paid"
              />
            </div>
            {editing ? (
              <p className="text-xs text-muted-foreground">
                Editing a loan doesn't change its existing EMI schedule.
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {editing ? "Save changes" : "Add loan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// compact total for the page header area
export function LoansOutstanding({ total, currency }: { total: number; currency: string }) {
  return <span className="tabular-nums">{formatCompact(total, currency)}</span>;
}

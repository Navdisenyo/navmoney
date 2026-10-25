import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, BadgeCheck, Repeat } from "lucide-react";

import {
  bootstrapQueryOptions,
  expensesQueryOptions,
  type Category,
  type ExpenseRow,
} from "@/lib/finance-queries";
import {
  deleteCategory,
  deleteExpense,
  expenseSchema,
  saveCategory,
  saveExpense,
} from "@/lib/finance.functions";
import { formatDate, todayISO } from "@/lib/finance-calc";
import {
  CATEGORY_COLORS,
  PAYMENT_STATUS_LABELS,
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
import {
  EmptyState,
  PageHeader,
  PageSkeleton,
  RouteError,
  RouteNotFound,
} from "@/components/finance-ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/expenses")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(expensesQueryOptions()),
      context.queryClient.ensureQueryData(bootstrapQueryOptions()),
    ]),
  head: () => ({
    meta: [
      { title: "Expenses — Artha" },
      { name: "description", content: "Bills and spending with categories, recurrence and paid tracking." },
      { property: "og:title", content: "Expenses — Artha" },
      { property: "og:description", content: "Bills and spending with categories and recurrence." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  pendingComponent: PageSkeleton,
  errorComponent: RouteError,
  notFoundComponent: () => <RouteNotFound />,
  component: ExpensesPage,
});

type FormState = {
  title: string;
  category_id: string;
  amount: string;
  due_date: string;
  recurrence: string;
  recurrence_end_date: string;
  payment_status: string;
  payment_date: string;
  notes: string;
};

const blankForm: FormState = {
  title: "",
  category_id: "",
  amount: "",
  due_date: todayISO(),
  recurrence: "one_time",
  recurrence_end_date: "",
  payment_status: "unpaid",
  payment_date: "",
  notes: "",
};

function toForm(row: ExpenseRow): FormState {
  return {
    title: row.title,
    category_id: row.category_id,
    amount: String(row.amount ?? ""),
    due_date: row.due_date,
    recurrence: row.recurrence,
    recurrence_end_date: row.recurrence_end_date ?? "",
    payment_status: row.payment_status,
    payment_date: row.payment_date ?? "",
    notes: row.notes ?? "",
  };
}

function ExpensesPage() {
  const { data } = useSuspenseQuery(expensesQueryOptions());
  const { data: boot } = useSuspenseQuery(bootstrapQueryOptions());
  const currency = boot.settings.currency;
  const df = boot.settings.date_format as "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  const fmt = (v: number) => formatCurrency(v, currency);

  const queryClient = useQueryClient();
  const saveFn = useServerFn(saveExpense);
  const deleteFn = useServerFn(deleteExpense);
  const saveCatFn = useServerFn(saveCategory);
  const deleteCatFn = useServerFn(deleteCategory);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [catOpen, setCatOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [catColor, setCatColor] = useState(CATEGORY_COLORS[0]);

  function invalidate() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ["expenses"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["reports"] }),
    ]);
  }

  const save = useMutation({
    mutationFn: (values: typeof form) => {
      void expenseSchema;
      return saveFn({
        data: {
          ...(editing ? { id: editing.id } : {}),
          title: values.title,
          category_id: values.category_id,
          amount: Number(values.amount),
          due_date: values.due_date,
          recurrence: values.recurrence as never,
          recurrence_end_date: values.recurrence_end_date || null,
          payment_status: values.payment_status as never,
          payment_date: values.payment_date || null,
          notes: values.notes || null,
        },
      });
    },
    onSuccess: async () => {
      await invalidate();
      toast.success(editing ? "Expense updated" : "Expense added");
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Expense removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addCategory = useMutation({
    mutationFn: () => saveCatFn({ data: { name: catName, color: catColor } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      toast.success("Category added");
      setCatOpen(false);
      setCatName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeCategory = useMutation({
    mutationFn: (id: string) => deleteCatFn({ data: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      toast.success("Category removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openAdd() {
    setEditing(null);
    setForm({ ...blankForm, category_id: data.categories[0]?.id ?? "" });
    setDialogOpen(true);
  }

  function openEdit(row: ExpenseRow) {
    setEditing(row);
    setForm(toForm(row));
    setDialogOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.category_id || Number(form.amount) <= 0) {
      toast.error("Title, category and a positive amount are required");
      return;
    }
    if (form.payment_status === "paid" && !form.payment_date) {
      setForm((f) => ({ ...f, payment_date: todayISO() }));
      save.mutate({ ...form, payment_date: todayISO() });
      return;
    }
    save.mutate(form);
  }

  const set = (key: keyof FormState) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Expenses"
        description="Recurring bills generate their future occurrences automatically — no duplicates."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCatOpen(true)}>
              <Plus className="size-4" /> Category
            </Button>
            <Button onClick={openAdd}>
              <Plus className="size-4" /> Add expense
            </Button>
          </div>
        }
      />

      {data.expenses.length === 0 ? (
        <EmptyState title="No expenses yet" hint="Add a bill or a recurring expense to get started." />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {data.expenses.map((row) => {
            const isEmiLinked = row.emi_payment_id != null;
            return (
              <li key={row.id} className="flex flex-wrap items-center gap-3 p-4">
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: row.category?.color ?? "var(--muted-foreground)" }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">{row.title}</p>
                    <Badge
                      variant="default"
                      className={cn(
                        row.payment_status === "paid" && "bg-income text-income-foreground",
                        row.payment_status === "overdue" && "bg-negative text-negative-foreground",
                      )}
                    >
                      {PAYMENT_STATUS_LABELS[row.payment_status]}
                    </Badge>
                    {row.recurrence !== "one_time" ? (
                      <Badge variant="secondary">
                        <Repeat className="size-3" /> {RECURRENCE_LABELS[row.recurrence]}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {row.category?.name ?? "Uncategorised"} · Due {formatDate(row.due_date, df)}
                    {row.payment_date ? ` · Paid ${formatDate(row.payment_date, df)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {row.payment_status !== "paid" && !isEmiLinked ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={save.isPending}
                      onClick={() =>
                        save.mutate({
                          ...toForm(row),
                          payment_status: "paid",
                          payment_date: todayISO(),
                        })
                      }
                    >
                      <BadgeCheck className="size-4" /> Mark paid
                    </Button>
                  ) : null}
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
                <span className="w-28 text-right font-display text-sm font-semibold tabular-nums">
                  {fmt(Number(row.amount))}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Categories</h2>
        <div className="flex flex-wrap gap-2">
          {data.categories.map((cat: Category) => (
            <span
              key={cat.id}
              className="group flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm"
            >
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: cat.color ?? "var(--muted-foreground)" }}
                aria-hidden
              />
              {cat.name}
              {!cat.is_default ? (
                <button
                  aria-label={`Delete category ${cat.name}`}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                  disabled={removeCategory.isPending}
                  onClick={() => removeCategory.mutate(cat.id)}
                >
                  ×
                </button>
              ) : null}
            </span>
          ))}
        </div>
      </section>

      {/* Expense dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit expense" : "Add expense"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="exp-title">Title</Label>
              <Input id="exp-title" required value={form.title} onChange={(e) => set("title")(e.target.value)} placeholder="e.g. Electricity bill" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category_id} onValueChange={set("category_id")}>
                  <SelectTrigger aria-label="Expense category"><SelectValue placeholder="Pick one" /></SelectTrigger>
                  <SelectContent>
                    {data.categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-amount">Amount (₹)</Label>
                <Input id="exp-amount" required type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => set("amount")(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="exp-due">Due date</Label>
                <Input id="exp-due" required type="date" value={form.due_date} onChange={(e) => set("due_date")(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Recurrence</Label>
                <Select value={form.recurrence} onValueChange={set("recurrence")}>
                  <SelectTrigger aria-label="Recurrence"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RECURRENCE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.recurrence !== "one_time" ? (
              <div className="space-y-2">
                <Label htmlFor="exp-rec-end">Repeat until</Label>
                <Input
                  id="exp-rec-end"
                  type="date"
                  min={form.due_date}
                  value={form.recurrence_end_date}
                  onChange={(e) => set("recurrence_end_date")(e.target.value)}
                  placeholder="No end date"
                />
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment status</Label>
                <Select value={form.payment_status} onValueChange={set("payment_status")}>
                  <SelectTrigger aria-label="Payment status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.payment_status === "paid" ? (
                <div className="space-y-2">
                  <Label htmlFor="exp-paid">Paid on</Label>
                  <Input id="exp-paid" type="date" value={form.payment_date} onChange={(e) => set("payment_date")(e.target.value)} />
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp-notes">Notes</Label>
              <Input id="exp-notes" value={form.notes} onChange={(e) => set("notes")(e.target.value)} placeholder="Optional" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {editing ? "Save changes" : "Add expense"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Category dialog */}
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New category</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Name</Label>
              <Input id="cat-name" required value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="e.g. Groceries" />
            </div>
            <div className="space-y-2">
              <Label>Colour</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Colour ${c}`}
                    onClick={() => setCatColor(c)}
                    className={cn(
                      "size-6 rounded-full border-2 transition-transform",
                      catColor === c ? "scale-110 border-foreground" : "border-transparent",
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCatOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!catName.trim() || addCategory.isPending}
                onClick={() => addCategory.mutate()}
              >
                Add category
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  addDaysISO,
  addMonthsClamped,
  buildEmiSchedule,
  monthKey,
  monthRange,
  nextRecurrenceDate,
  requireNonNegative,
  requirePositive,
  roundMoney,
  savingsRate,
  sumMoney,
  todayISO,
  type CompoundingMethod,
  type Recurrence,
} from "@/lib/finance-calc";

// All server functions below run behind requireSupabaseAuth: RLS scopes every
// read/write to the signed-in user. user_id is always derived from the auth
// context, never from client input.

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

function listSum(rows: { amount: number }[] | null): number {
  return sumMoney((rows ?? []).map((r) => Number(r.amount)));
}

// ---------- bootstrap (profile, settings, categories) ----------

export const getBootstrap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    let [profileRes, settingsRes, categoriesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("expense_categories")
        .select("*")
        .order("is_default", { ascending: false })
        .order("name"),
    ]);

    // If profile or settings are missing (e.g. user was created before triggers were setup), auto-provision
    if (!profileRes.data || !settingsRes.data) {
      await supabase.rpc("ensure_current_user").catch(() => {});

      [profileRes, settingsRes, categoriesRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
        supabase
          .from("expense_categories")
          .select("*")
          .order("is_default", { ascending: false })
          .order("name"),
      ]);
    }

    if (profileRes.error) throw new Error(profileRes.error.message);
    if (settingsRes.error) throw new Error(settingsRes.error.message);
    if (categoriesRes.error) throw new Error(categoriesRes.error.message);

    const profile = profileRes.data ?? {
      id: userId,
      email: "",
      full_name: "Account",
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const settings = settingsRes.data ?? {
      user_id: userId,
      currency: "INR",
      date_format: "DD/MM/YYYY" as const,
      week_start: "MON" as const,
      monthly_budget: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return {
      profile,
      settings,
      categories: categoriesRes.data ?? [],
    };
  });

const settingsSchema = z.object({
  currency: z.string().trim().min(1).max(8),
  date_format: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]),
  week_start: z.enum(["MON", "SUN"]),
  monthly_budget: z.number().min(0).nullable(),
});

export const updateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => settingsSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_settings")
      .update(data)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ full_name: z.string().trim().max(120) }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ full_name: data.full_name || null })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ---------- dashboard ----------

const upcomingItemSchema = z.object({
  kind: z.enum(["expense", "emi", "income"]),
  id: z.string(),
  title: z.string(),
  amount: z.number(),
  due_date: z.string(),
  overdue: z.boolean(),
});

export type UpcomingItem = z.infer<typeof upcomingItemSchema>;

export const getDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const today = todayISO();
    const { start, end } = monthRange(data.month);
    const horizon = addDaysISO(today, 30);

    const [
      incomeMonth,
      paidExpenses,
      unpaidMonth,
      overdueExpenses,
      upcomingExpenses,
      upcomingEmis,
      upcomingIncome,
      overdueEmis,
      investments,
      loans,
      recentIncome,
      recentExpenses,
      settings,
    ] = await Promise.all([
      supabase
        .from("income_transactions")
        .select("amount")
        .eq("status", "received")
        .gte("received_date", start)
        .lt("received_date", end),
      supabase
        .from("expenses")
        .select("amount")
        .eq("payment_status", "paid")
        .gte("payment_date", start)
        .lt("payment_date", end),
      supabase
        .from("expenses")
        .select("amount")
        .in("payment_status", ["unpaid", "overdue"])
        .gte("due_date", start)
        .lt("due_date", end),
      supabase
        .from("expenses")
        .select("amount")
        .in("payment_status", ["unpaid", "overdue"])
        .lt("due_date", today),
      supabase
        .from("expenses")
        .select("id, title, amount, due_date")
        .in("payment_status", ["unpaid", "overdue"])
        .gte("due_date", today)
        .lte("due_date", horizon),
      supabase
        .from("emi_payments")
        .select("id, amount, due_date, installment_number, loan:loans(name)")
        .in("status", ["unpaid", "overdue"])
        .gte("due_date", today)
        .lte("due_date", horizon),
      supabase
        .from("income_transactions")
        .select("id, title, amount, received_date")
        .eq("status", "expected")
        .gte("received_date", today)
        .lte("received_date", horizon),
      supabase
        .from("emi_payments")
        .select("amount")
        .in("status", ["unpaid", "overdue"])
        .lt("due_date", today),
      supabase.from("investments").select("current_value, principal_amount, status"),
      supabase.from("loans").select("outstanding_principal, status"),
      supabase
        .from("income_transactions")
        .select("id, title, amount, received_date")
        .eq("status", "received")
        .order("received_date", { ascending: false })
        .limit(8),
      supabase
        .from("expenses")
        .select("id, title, amount, payment_date, due_date")
        .eq("payment_status", "paid")
        .order("payment_date", { ascending: false })
        .limit(8),
      supabase
        .from("user_settings")
        .select("monthly_budget")
        .eq("user_id", context.userId)
        .single(),
    ]);

    if (settings.error) throw new Error(settings.error.message);

    const monthIncome = listSum(incomeMonth.data);
    const monthExpenses = listSum(paidExpenses.data);
    const monthUnpaid = listSum(unpaidMonth.data);
    const overdueTotal = roundMoney(listSum(overdueExpenses.data) + listSum(overdueEmis.data));
    const netSavings = roundMoney(monthIncome - monthExpenses);
    const rate = savingsRate(netSavings, monthIncome);

    const investmentsValue = sumMoney(
      (investments.data ?? []).map((i) =>
        i.status === "closed" ? 0 : Number(i.current_value ?? i.principal_amount),
      ),
    );
    const loansOutstanding = sumMoney(
      (loans.data ?? [])
        .filter((l) => l.status === "active")
        .map((l) => Number(l.outstanding_principal ?? 0)),
    );

    const budget = settings.data?.monthly_budget ?? null;
    const budgetUsed =
      budget && budget > 0 ? roundMoney((monthExpenses / Number(budget)) * 100) : null;

    const upcoming: UpcomingItem[] = [
      ...(upcomingExpenses.data ?? []).map((e) => ({
        kind: "expense" as const,
        id: e.id,
        title: e.title,
        amount: Number(e.amount),
        due_date: e.due_date,
        overdue: e.due_date < today,
      })),
      ...(upcomingEmis.data ?? []).map((e) => ({
        kind: "emi" as const,
        id: e.id,
        title: `${(e.loan as { name: string } | null)?.name ?? "Loan"} — EMI #${e.installment_number}`,
        amount: Number(e.amount),
        due_date: e.due_date,
        overdue: e.due_date < today,
      })),
      ...(upcomingIncome.data ?? []).map((i) => ({
        kind: "income" as const,
        id: i.id,
        title: i.title,
        amount: Number(i.amount),
        due_date: i.received_date,
        overdue: false,
      })),
    ].sort((a, b) => a.due_date.localeCompare(b.due_date));

    const recent = [
      ...(recentIncome.data ?? []).map((i) => ({
        kind: "income" as const,
        id: i.id,
        title: i.title,
        amount: Number(i.amount),
        date: i.received_date,
      })),
      ...(recentExpenses.data ?? []).map((e) => ({
        kind: "expense" as const,
        id: e.id,
        title: e.title,
        amount: Number(e.amount),
        date: e.payment_date ?? e.due_date,
      })),
    ]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8);

    return {
      month: data.month,
      monthIncome,
      monthExpenses,
      monthUnpaid,
      overdueTotal,
      netSavings,
      savingsRate: rate,
      budget,
      budgetUsed,
      investmentsValue,
      loansOutstanding,
      upcoming,
      recent,
    };
  });

// ---------- investments ----------

export const listInvestments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("investments")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { investments: data ?? [] };
  });

export const investmentSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  type: z.enum([
    "fd",
    "rd",
    "savings_account",
    "mutual_fund",
    "stocks",
    "bonds",
    "ppf",
    "epf",
    "real_estate",
    "other",
  ]),
  institution: z.string().trim().max(120).nullish(),
  principal_amount: z.number().min(0),
  current_value: z.number().min(0).nullish(),
  annual_rate: z.number().min(0).max(100),
  rate_type: z.enum(["fixed", "variable"]),
  start_date: z.string().regex(dateRe),
  maturity_date: z.string().regex(dateRe).nullish(),
  compounding_method: z.enum(["simple", "monthly", "quarterly", "half_yearly", "annually"]),
  payout_frequency: z.enum([
    "monthly",
    "quarterly",
    "annually",
    "at_maturity",
    "reinvested",
    "variable",
  ]),
  status: z.enum(["active", "matured", "closed"]),
  notes: z.string().max(500).nullish(),
});

export const saveInvestment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => investmentSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      name: data.name,
      type: data.type,
      institution: data.institution ?? null,
      principal_amount: data.principal_amount,
      current_value: data.current_value ?? null,
      annual_rate: data.annual_rate,
      rate_type: data.rate_type,
      start_date: data.start_date,
      maturity_date: data.maturity_date ?? null,
      compounding_method: data.compounding_method,
      payout_frequency: data.payout_frequency,
      status: data.status,
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { error } = await supabase
        .from("investments")
        .update(payload)
        .eq("id", data.id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { ok: true as const };
    }
    const { error } = await supabase.from("investments").insert({ ...payload, user_id: userId });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteInvestment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("investments")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ---------- income ----------

export const listIncome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("income_transactions")
      .select("*, investment:investments(name)")
      .order("received_date", { ascending: false });
    if (error) throw new Error(error.message);
    return { income: data ?? [] };
  });

export const incomeSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(120),
  category: z.enum(["salary", "business", "rental", "investment_income", "freelance", "other"]),
  amount: z.number().positive(),
  received_date: z.string().regex(dateRe),
  status: z.enum(["expected", "received"]),
  recurrence: z.enum(["one_time", "weekly", "monthly", "quarterly", "annually"]),
  investment_id: z.string().uuid().nullish(),
  notes: z.string().max(500).nullish(),
});

export const saveIncome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => incomeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      title: data.title,
      category: data.category,
      amount: data.amount,
      received_date: data.received_date,
      status: data.status,
      recurrence: data.recurrence,
      // income may only link to an investment for investment_income (DB check)
      investment_id: data.category === "investment_income" ? (data.investment_id ?? null) : null,
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { error } = await supabase
        .from("income_transactions")
        .update(payload)
        .eq("id", data.id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { ok: true as const };
    }
    const { error } = await supabase
      .from("income_transactions")
      .insert({ ...payload, user_id: userId });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteIncome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("income_transactions")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ---------- expenses ----------

/**
 * Materialise due recurring expenses. Idempotent: the generated copies hit the
 * dedupe unique index (user, title, due_date, amount for recurring rows) and
 * ignore duplicates skips anything already generated — no check-then-insert.
 */
async function materializeRecurring(supabase: SupabaseClient, userId: string) {
  const today = todayISO();
  const { data: series, error } = await supabase
    .from("expenses")
    .select("*")
    .neq("recurrence", "one_time")
    .lte("due_date", today);
  if (error || !series) return;

  for (const s of series) {
    let due: string | null = s.due_date;
    const clones: TablesInsert<"expenses">[] = [];
    while (due && due <= today && (!s.recurrence_end_date || due <= s.recurrence_end_date)) {
      clones.push({
        user_id: userId,
        category_id: s.category_id,
        title: s.title,
        amount: s.amount,
        due_date: due,
        recurrence: s.recurrence,
        notes: s.notes,
        payment_method: s.payment_method,
        payment_status: "unpaid",
      });
      due = nextRecurrenceDate(due, s.recurrence as Recurrence);
    }
    if (clones.length > 0) {
      for (const clone of clones) {
        const { error: insertError } = await supabase.from("expenses").insert(clone);
        if (insertError && insertError.code !== "23505") {
          console.warn("[recurring generation]", insertError.message);
        }
      }
    }
    const lastGenerated = clones.length > 0 ? clones[clones.length - 1] : null;
    const nextDue = lastGenerated?.due_date
      ? nextRecurrenceDate(lastGenerated.due_date, s.recurrence as Recurrence)
      : null;
    if (nextDue && nextDue !== s.due_date) {
      const { error: updateError } = await supabase
        .from("expenses")
        .update({ due_date: nextDue })
        .eq("id", s.id);
      if (updateError) console.warn("[recurring advance]", updateError.message);
    }
  }
}

export const listExpenses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await materializeRecurring(supabase, userId);
    const [expRes, catRes] = await Promise.all([
      supabase
        .from("expenses")
        .select("*, category:expense_categories!expenses_category_id_fkey(name, color)")
        .order("due_date", { ascending: false }),
      supabase
        .from("expense_categories")
        .select("*")
        .order("is_default", { ascending: false })
        .order("name"),
    ]);
    if (expRes.error) throw new Error(expRes.error.message);
    if (catRes.error) throw new Error(catRes.error.message);
    return { expenses: expRes.data ?? [], categories: catRes.data ?? [] };
  });

export const expenseSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(160),
  category_id: z.string().uuid(),
  amount: z.number().positive(),
  due_date: z.string().regex(dateRe),
  recurrence: z.enum(["one_time", "weekly", "monthly", "quarterly", "annually"]),
  recurrence_end_date: z.string().regex(dateRe).nullish(),
  payment_status: z.enum(["unpaid", "paid", "overdue"]),
  payment_date: z.string().regex(dateRe).nullish(),
  payment_method: z.string().trim().max(60).nullish(),
  notes: z.string().max(500).nullish(),
});

export const saveExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => expenseSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const paymentDate =
      data.payment_status === "paid"
        ? (data.payment_date ?? todayISO())
        : (data.payment_date ?? null);
    const payload = {
      title: data.title,
      category_id: data.category_id,
      amount: data.amount,
      due_date: data.due_date,
      recurrence: data.recurrence,
      recurrence_end_date:
        data.recurrence === "one_time" ? null : (data.recurrence_end_date ?? null),
      payment_status: data.payment_status,
      payment_date: paymentDate,
      payment_method: data.payment_method ?? null,
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { error } = await supabase
        .from("expenses")
        .update(payload)
        .eq("id", data.id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { ok: true as const };
    }
    const { error } = await supabase.from("expenses").insert({ ...payload, user_id: userId });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("expenses")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(60),
  color: z.string().trim().max(20).nullish(),
});

export const saveCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => categorySchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.id) {
      const { error } = await supabase
        .from("expense_categories")
        .update({ name: data.name, color: data.color ?? null })
        .eq("id", data.id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { ok: true as const };
    }
    const { error } = await supabase
      .from("expense_categories")
      .insert({ user_id: userId, name: data.name, color: data.color ?? null, is_default: false });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("expense_categories")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) {
      if (error.code === "23503") {
        throw new Error("This category still has expenses linked to it. Move them first.");
      }
      throw new Error(error.message);
    }
    return { ok: true as const };
  });

// ---------- loans & EMI ----------

export const listLoans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [loanRes, emiRes] = await Promise.all([
      context.supabase.from("loans").select("*").order("created_at", { ascending: false }),
      context.supabase
        .from("emi_payments")
        .select("*, loan:loans(name)")
        .order("due_date", { ascending: true }),
    ]);
    if (loanRes.error) throw new Error(loanRes.error.message);
    if (emiRes.error) throw new Error(emiRes.error.message);
    return { loans: loanRes.data ?? [], emis: emiRes.data ?? [] };
  });

export const loanSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  lender: z.string().trim().max(120).nullish(),
  original_amount: z.number().min(0),
  emi_amount: z.number().positive(),
  interest_rate: z.number().min(0).max(100).nullish(),
  start_date: z.string().regex(dateRe),
  monthly_due_day: z.number().int().min(1).max(28),
  remaining_installments: z.number().int().min(0).max(360).nullish(),
  outstanding_principal: z.number().min(0).nullish(),
  status: z.enum(["active", "closed"]),
  notes: z.string().max(500).nullish(),
});

export const saveLoan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => loanSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    requireNonNegative(data.original_amount, "Loan amount");
    requirePositive(data.emi_amount, "EMI amount");
    const payload = {
      name: data.name,
      lender: data.lender ?? null,
      original_amount: data.original_amount,
      emi_amount: data.emi_amount,
      interest_rate: data.interest_rate ?? null,
      start_date: data.start_date,
      monthly_due_day: data.monthly_due_day,
      remaining_installments: data.remaining_installments ?? null,
      outstanding_principal: data.outstanding_principal ?? null,
      status: data.status,
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { error } = await supabase
        .from("loans")
        .update(payload)
        .eq("id", data.id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { ok: true as const };
    }
    const { data: loan, error } = await supabase
      .from("loans")
      .insert({ ...payload, user_id: userId })
      .select("id")
      .single();
    if (error || !loan) throw new Error(error?.message ?? "Could not create loan");

    // Generate the EMI schedule up front (unique loan_id + installment_number
    // guards against duplicates).
    const count =
      data.remaining_installments ??
      Math.max(1, Math.min(360, Math.ceil(data.original_amount / data.emi_amount)));
    const dueDates = buildEmiSchedule(data.start_date, data.monthly_due_day, count);
    if (dueDates.length > 0) {
      const rows = dueDates.map((due_date, i) => ({
        user_id: userId,
        loan_id: loan.id,
        installment_number: i + 1,
        due_date,
        amount: data.emi_amount,
        status: "unpaid" as const,
      }));
      const { error: emiError } = await supabase.from("emi_payments").upsert(rows, {
        onConflict: "loan_id,installment_number",
        ignoreDuplicates: true,
      });
      if (emiError) throw new Error(emiError.message);
      await supabase
        .from("loans")
        .update({ remaining_installments: dueDates.length })
        .eq("id", loan.id);
    }
    return { ok: true as const };
  });

export const deleteLoan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    // emi_payments cascade; linked expenses keep the amount with emi_payment_id
    // cleared, so outflows stay counted exactly once.
    const { error } = await context.supabase
      .from("loans")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const markEmiPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ emi_id: z.string().uuid(), paid_date: z.string().regex(dateRe) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: emi, error: emiError } = await supabase
      .from("emi_payments")
      .select("id, amount, installment_number, status, loan_id, loan:loans(name)")
      .eq("id", data.emi_id)
      .single();
    if (emiError || !emi) throw new Error(emiError?.message ?? "EMI not found");

    if (emi.status !== "paid") {
      const { error } = await supabase
        .from("emi_payments")
        .update({ status: "paid", paid_date: data.paid_date })
        .eq("id", emi.id);
      if (error) throw new Error(error.message);
    }

    // Exactly one expense per paid EMI (partial-unique index on emi_payment_id).
    const { data: linked } = await supabase
      .from("expenses")
      .select("id")
      .eq("emi_payment_id", emi.id)
      .maybeSingle();
    if (!linked) {
      let categoryId: string | null = null;
      const { data: cats } = await supabase
        .from("expense_categories")
        .select("id, name")
        .or("name.ilike.EMI,name.ilike.Loan")
        .limit(1);
      categoryId = cats?.[0]?.id ?? null;
      if (!categoryId) {
        const { data: created } = await supabase
          .from("expense_categories")
          .insert({ user_id: userId, name: "EMI", is_default: false, color: "#6366f1" })
          .select("id")
          .single();
        categoryId = created?.id ?? null;
      }
      if (!categoryId) throw new Error("Could not resolve an expense category for the EMI");
      const loanName = (emi.loan as { name: string } | null)?.name ?? "Loan";
      const { error: expError } = await supabase.from("expenses").insert({
        user_id: userId,
        category_id: categoryId,
        title: `${loanName} — EMI #${emi.installment_number}`,
        amount: emi.amount,
        due_date: data.paid_date,
        payment_date: data.paid_date,
        payment_status: "paid",
        recurrence: "one_time",
        emi_payment_id: emi.id,
      });
      if (expError) {
        // 23505 = the expense link already exists (race); safe to ignore.
        if (expError.code !== "23505") throw new Error(expError.message);
      }
    }

    // Track the loan balance.
    const { data: loan } = await supabase
      .from("loans")
      .select("id, outstanding_principal, remaining_installments")
      .eq("id", emi.loan_id)
      .single();
    if (loan) {
      const patch: TablesUpdate<"loans"> = {};
      if (loan.outstanding_principal != null) {
        patch.outstanding_principal = Math.max(
          0,
          roundMoney(Number(loan.outstanding_principal) - Number(emi.amount)),
        );
      }
      if (loan.remaining_installments != null) {
        patch.remaining_installments = Math.max(0, loan.remaining_installments - 1);
      }
      if (Object.keys(patch).length > 0) {
        await supabase.from("loans").update(patch).eq("id", loan.id);
      }
    }
    return { ok: true as const };
  });

export const unmarkEmiPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ emi_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: emi } = await supabase
      .from("emi_payments")
      .select("id, amount, status, loan_id, paid_date")
      .eq("id", data.emi_id)
      .single();
    if (!emi || emi.status !== "paid") return { ok: true as const };

    await supabase.from("expenses").delete().eq("emi_payment_id", emi.id);
    const { error } = await supabase
      .from("emi_payments")
      .update({ status: "unpaid", paid_date: null })
      .eq("id", emi.id);
    if (error) throw new Error(error.message);

    const { data: loan } = await supabase
      .from("loans")
      .select("id, outstanding_principal, remaining_installments")
      .eq("id", emi.loan_id)
      .single();
    if (loan) {
      const patch: TablesUpdate<"loans"> = {};
      if (loan.outstanding_principal != null) {
        patch.outstanding_principal = roundMoney(
          Number(loan.outstanding_principal) + Number(emi.amount),
        );
      }
      if (loan.remaining_installments != null) {
        patch.remaining_installments = loan.remaining_installments + 1;
      }
      if (Object.keys(patch).length > 0) {
        await supabase.from("loans").update(patch).eq("id", loan.id);
      }
    }
    return { ok: true as const };
  });

// ---------- reports ----------

export const getReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const today = todayISO();
    const startISO = addMonthsClamped(`${today.slice(0, 7)}-01`, -11);
    const months: string[] = [];
    for (let i = 0; i < 12; i++) {
      months.push(addMonthsClamped(startISO, i).slice(0, 7));
    }

    const [incomeRes, expenseRes, investRes] = await Promise.all([
      supabase
        .from("income_transactions")
        .select("amount, category, received_date")
        .eq("status", "received")
        .gte("received_date", `${startISO.slice(0, 7)}-01`),
      supabase
        .from("expenses")
        .select(
          "amount, category_id, payment_date, category:expense_categories!expenses_category_id_fkey(name)",
        )
        .eq("payment_status", "paid")
        .gte("payment_date", `${startISO.slice(0, 7)}-01`),
      supabase.from("investments").select("current_value, principal_amount, status"),
    ]);

    const monthlySeries = months.map((m) => {
      const income = sumMoney(
        (incomeRes.data ?? [])
          .filter((r) => monthKey(r.received_date) === m)
          .map((r) => Number(r.amount)),
      );
      const expenses = sumMoney(
        (expenseRes.data ?? [])
          .filter((r) => r.payment_date && monthKey(r.payment_date) === m)
          .map((r) => Number(r.amount)),
      );
      return { month: m, income, expenses, savings: roundMoney(income - expenses) };
    });

    const categoryMap = new Map<string, number>();
    for (const row of expenseRes.data ?? []) {
      const name = (row.category as { name: string } | null)?.name ?? "Other";
      categoryMap.set(name, (categoryMap.get(name) ?? 0) + Number(row.amount));
    }
    const categoryBreakdown = [...categoryMap.entries()]
      .map(([name, total]) => ({ name, total: roundMoney(total) }))
      .sort((a, b) => b.total - a.total);

    const incomeMap = new Map<string, number>();
    for (const row of incomeRes.data ?? []) {
      incomeMap.set(row.category, (incomeMap.get(row.category) ?? 0) + Number(row.amount));
    }
    const incomeByCategory = [...incomeMap.entries()]
      .map(([category, total]) => ({ category, total: roundMoney(total) }))
      .sort((a, b) => b.total - a.total);

    const totalIncome = sumMoney(monthlySeries.map((m) => m.income));
    const totalExpenses = sumMoney(monthlySeries.map((m) => m.expenses));
    const netSavings = roundMoney(totalIncome - totalExpenses);
    const investmentsValue = sumMoney(
      (investRes.data ?? [])
        .filter((i) => i.status !== "closed")
        .map((i) => Number(i.current_value ?? i.principal_amount)),
    );

    return {
      months,
      monthlySeries,
      categoryBreakdown,
      incomeByCategory,
      totalIncome,
      totalExpenses,
      netSavings,
      savingsRate: savingsRate(netSavings, totalIncome),
      investmentsValue,
    };
  });

// keep tree-shaking honest: these types are part of the public surface
export type { CompoundingMethod, Recurrence };

import { queryOptions } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";
import {
  getBootstrap,
  getDashboard,
  getReports,
  listExpenses,
  listIncome,
  listInvestments,
  listLoans,
} from "./finance.functions";

export type Profile = Tables<"profiles">["Row"];
export type Settings = Tables<"user_settings">["Row"];
export type Category = Tables<"expense_categories">["Row"];
export type Investment = Tables<"investments">["Row"];
export type Loan = Tables<"loans">["Row"];

export type IncomeRow = Tables<"income_transactions">["Row"] & {
  investment: { name: string } | null;
};

export type ExpenseRow = Tables<"expenses">["Row"] & {
  category: { name: string; color: string | null } | null;
};

export type EmiRow = Tables<"emi_payments">["Row"] & {
  loan: { name: string } | null;
};

export type BootstrapData = Awaited<ReturnType<typeof getBootstrap>>;
export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;
export type ReportsData = Awaited<ReturnType<typeof getReports>>;
export type { UpcomingItem } from "./finance.functions";

export const bootstrapQueryOptions = () =>
  queryOptions({ queryKey: ["bootstrap"], queryFn: () => getBootstrap() });

export const dashboardQueryOptions = (month: string) =>
  queryOptions({
    queryKey: ["dashboard", month],
    queryFn: () => getDashboard({ data: { month } }),
  });

export const investmentsQueryOptions = () =>
  queryOptions({ queryKey: ["investments"], queryFn: () => listInvestments() });

export const incomeQueryOptions = () =>
  queryOptions({ queryKey: ["income"], queryFn: () => listIncome() });

export const expensesQueryOptions = () =>
  queryOptions({ queryKey: ["expenses"], queryFn: () => listExpenses() });

export const loansQueryOptions = () =>
  queryOptions({ queryKey: ["loans"], queryFn: () => listLoans() });

export const reportsQueryOptions = () =>
  queryOptions({ queryKey: ["reports"], queryFn: () => getReports() });

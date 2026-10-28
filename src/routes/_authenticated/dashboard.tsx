import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, Landmark, ReceiptText, Wallet } from "lucide-react";

import {
  bootstrapQueryOptions,
  dashboardQueryOptions,
  type DashboardData,
} from "@/lib/finance-queries";
import { currentMonthKey, formatCompact, formatCurrency, formatDate } from "@/lib/finance-calc";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  EmptyState,
  MonthNav,
  PageHeader,
  PageSkeleton,
  RouteError,
  RouteNotFound,
  StatCard,
} from "@/components/finance-ui";
import { cn } from "@/lib/utils";
import { Suspense } from "react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: (search: Record<string, unknown>): { month?: string } => {
    const rawMonth = search["month"];
    return typeof rawMonth === "string" && /^\d{4}-\d{2}$/.test(rawMonth)
      ? { month: rawMonth }
      : {};
  },
  loaderDeps: ({ search: { month } }) => ({ month }),
  loader: ({ context, deps }) => {
    const month = deps.month ?? currentMonthKey();
    return Promise.all([
      context.queryClient.ensureQueryData(dashboardQueryOptions(month)),
      context.queryClient.ensureQueryData(bootstrapQueryOptions()),
    ]);
  },
  head: () => ({
    meta: [
      { title: "Dashboard — Artha" },
      {
        name: "description",
        content: "Your monthly cash flow, savings rate and upcoming bills and EMIs.",
      },
      { property: "og:title", content: "Dashboard — Artha" },
      { property: "og:description", content: "Monthly cash flow, savings rate and upcoming EMIs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  pendingComponent: PageSkeleton,
  errorComponent: RouteError,
  notFoundComponent: () => <RouteNotFound />,
  component: DashboardPage,
});

function DashboardPage() {
  const { month: searchMonth } = Route.useSearch();
  const month = searchMonth ?? currentMonthKey();
  const navigate = useNavigate();
  const { data: data } = useSuspenseQuery(dashboardQueryOptions(month));
  const { data: boot } = useSuspenseQuery(bootstrapQueryOptions());

  const currency = boot.settings.currency;
  const df = boot.settings.date_format as "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  const d = data as DashboardData;
  const fmt = (v: number) => formatCurrency(v, currency);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Actuals for the month, plus what's coming in the next 30 days."
        action={
          <MonthNav
            month={month}
            onChange={(m) => navigate({ to: "/dashboard", search: { month: m } })}
          />
        }
      />

      {d.overdueTotal > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-negative/30 bg-negative/10 p-4 text-sm font-medium text-negative">
          <AlertTriangle className="size-4 shrink-0" />
          {fmt(d.overdueTotal)} is overdue across bills and EMIs.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Income received"
          value={fmt(d.monthIncome)}
          tone="income"
          sub="Actual received income only"
        />
        <StatCard
          label="Expenses paid"
          value={fmt(d.monthExpenses)}
          sub={d.monthUnpaid > 0 ? `${fmt(d.monthUnpaid)} still due this month` : "All settled"}
        />
        <StatCard
          label="Net savings"
          value={fmt(d.netSavings)}
          tone={d.netSavings < 0 ? "negative" : "income"}
          sub={
            d.savingsRate == null
              ? "Savings rate unavailable — no income yet"
              : `Savings rate ${d.savingsRate.toFixed(1)}% of income`
          }
        />
        <StatCard
          label="Investments"
          value={formatCompact(d.investmentsValue, currency)}
          sub="Current value of all holdings"
        />
        <StatCard
          label="Loan balance"
          value={formatCompact(d.loansOutstanding, currency)}
          sub="Outstanding principal on active loans"
        />
        <StatCard
          label="Monthly budget"
          value={d.budget ? fmt(Number(d.budget)) : "Not set"}
          sub={
            d.budget
              ? `${(d.budgetUsed ?? 0).toFixed(0)}% used — ${fmt(d.monthExpenses)} of ${fmt(Number(d.budget))}`
              : "Set one in Settings"
          }
        />
      </div>

      {d.budget && d.budgetUsed != null ? (
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">Budget used</span>
            <span
              className={cn(
                "tabular-nums font-medium",
                (d.budgetUsed ?? 0) > 100 ? "text-negative" : "text-income",
              )}
            >
              {(d.budgetUsed ?? 0).toFixed(0)}%
            </span>
          </div>
          <Progress
            value={Math.min(100, d.budgetUsed ?? 0)}
            aria-label="Budget used this month"
            className={cn((d.budgetUsed ?? 0) > 100 && "bg-negative/30 [&>div]:bg-negative")}
          />
        </div>
      ) : null}

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
          <CalendarClock className="size-4 text-primary" /> Next 30 days
        </h2>
        {d.upcoming.length === 0 ? (
          <EmptyState title="Nothing due in the next 30 days" hint="You're all clear for now." />
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {d.upcoming.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="flex items-center gap-3 p-4">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    item.kind === "income"
                      ? "bg-income/15 text-income"
                      : "bg-accent text-muted-foreground",
                  )}
                >
                  {item.kind === "income" ? (
                    <Wallet className="size-4" />
                  ) : item.kind === "emi" ? (
                    <Landmark className="size-4" />
                  ) : (
                    <ReceiptText className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Due {formatDate(item.due_date, df)}
                  </p>
                </div>
                {item.overdue ? (
                  <Badge className="bg-negative text-negative-foreground">Overdue</Badge>
                ) : null}
                <span
                  className={cn(
                    "font-display text-sm font-semibold tabular-nums",
                    item.kind === "income" ? "text-income" : "text-foreground",
                  )}
                >
                  {item.kind === "income" ? "+" : ""}
                  {fmt(item.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Recent activity</h2>
        {d.recent.length === 0 ? (
          <EmptyState
            title="No activity yet"
            hint="Mark an expense paid or record income and it shows up here."
          />
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {d.recent.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="flex items-center gap-3 p-4">
                <Badge variant="outline" className="shrink-0">
                  {item.kind === "income" ? "Income" : "Expense"}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(item.date, df)}</p>
                </div>
                <span
                  className={cn(
                    "font-display text-sm font-semibold tabular-nums",
                    item.kind === "income" ? "text-income" : "text-foreground",
                  )}
                >
                  {item.kind === "income" ? "+" : ""}
                  {fmt(item.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

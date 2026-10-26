import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { bootstrapQueryOptions, reportsQueryOptions, type ReportsData } from "@/lib/finance-queries";
import { formatCompact, formatCurrency } from "@/lib/finance-calc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, PageSkeleton, RouteError, StatCard } from "@/components/finance-ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/reports")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(reportsQueryOptions()),
      context.queryClient.ensureQueryData(bootstrapQueryOptions()),
    ]),
  head: () => ({
    meta: [
      { title: "Reports — Artha" },
      { name: "description", content: "Monthly cash flow, category breakdown and savings insights." },
      { property: "og:title", content: "Reports — Artha" },
      { property: "og:description", content: "Monthly cash flow and category breakdown." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  pendingComponent: PageSkeleton,
  errorComponent: RouteError,
  notFoundComponent: () => (
    <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
      Nothing here.
    </div>
  ),
  component: ReportsPage,
});

const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function monthShort(m: string): string {
  return new Date(`${m}-01T00:00:00`).toLocaleDateString("en", { month: "short" });
}

function ReportsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReportsInner />
    </Suspense>
  );
}

function ReportsInner() {
  const { data: data } = useSuspenseQuery(reportsQueryOptions());
  const { data: boot } = useSuspenseQuery(bootstrapQueryOptions());
  const d = data as ReportsData;
  const currency = boot.settings.currency;
  const fmt = (v: number) => formatCurrency(v, currency);

  const series = d.monthlySeries.map((m) => ({
    ...m,
    label: monthShort(m.month),
  }));

  const topCategories = d.categoryBreakdown.slice(0, 6);
  const othersTotal = d.categoryBreakdown.slice(6).reduce((acc, c) => acc + c.total, 0);
  const pieData = othersTotal > 0 ? [...topCategories, { name: "Other", total: othersTotal }] : topCategories;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reports"
        description="Last 12 months, actuals only — received income and paid expenses."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Income" value={formatCompact(d.totalIncome, currency)} tone="income" sub={fmt(d.totalIncome)} />
        <StatCard label="Expenses" value={formatCompact(d.totalExpenses, currency)} sub={fmt(d.totalExpenses)} />
        <StatCard
          label="Net savings"
          value={formatCompact(d.netSavings, currency)}
          tone={d.netSavings < 0 ? "negative" : "income"}
          sub={fmt(d.netSavings)}
        />
        <StatCard
          label="Savings rate"
          value={d.savingsRate == null ? "—" : `${d.savingsRate.toFixed(1)}%`}
          sub={d.savingsRate == null ? "Unavailable — no received income" : "Net savings ÷ actual income"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Monthly cash flow</CardTitle>
        </CardHeader>
        <CardContent>
          {d.totalIncome === 0 && d.totalExpenses === 0 ? (
            <EmptyState title="No activity in the last 12 months" hint="Record income and expenses to see the trend." />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => formatCompact(v, currency)}
                  width={70}
                />
                <Tooltip
                  formatter={(value: number | string, name: string) => [fmt(Number(value)), name]}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--popover-foreground)",
                  }}
                />
                <Legend />
                <Bar dataKey="income" name="Income" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="var(--chart-5)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Where the money went</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <EmptyState title="No paid expenses yet" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="total"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number | string, name: string) => [fmt(Number(value)), name]}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      color: "var(--popover-foreground)",
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Income by source</CardTitle>
          </CardHeader>
          <CardContent>
            {d.incomeByCategory.length === 0 ? (
              <EmptyState title="No received income yet" />
            ) : (
              <ul className="space-y-3">
                {d.incomeByCategory.map((row, i) => {
                  const pct = d.totalIncome > 0 ? (row.total / d.totalIncome) * 100 : 0;
                  return (
                    <li key={row.category}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium capitalize">{row.category.replace(/_/g, " ")}</span>
                        <span className="tabular-nums text-muted-foreground">{fmt(row.total)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full")}
                          style={{
                            width: `${pct.toFixed(1)}%`,
                            backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Investment holdings worth {formatCompact(d.investmentsValue, currency)} are excluded from
        income — investment gains count only when received as income.
      </p>
    </div>
  );
}

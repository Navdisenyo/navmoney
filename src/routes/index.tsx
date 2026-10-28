import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import {
  TrendingUp,
  Wallet,
  ReceiptText,
  Landmark,
  ArrowRight,
  ChartLine,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Artha — Track investments, income & expenses" },
      {
        name: "description",
        content:
          "A calm, premium personal finance app: investments, income, expenses, loans and EMI — with forecasts and savings insights.",
      },
      { property: "og:title", content: "Artha — Track investments, income & expenses" },
      {
        property: "og:description",
        content: "Investments, income, expenses, loans and EMI in one calm, premium dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const FEATURES = [
  {
    icon: TrendingUp,
    title: "Investments",
    body: "FDs, RDs, mutual funds, stocks, PPF and more — with equivalent monthly returns and maturity projections.",
  },
  {
    icon: Wallet,
    title: "Income",
    body: "Salary, rent, freelance and investment payouts — received and expected, side by side.",
  },
  {
    icon: ReceiptText,
    title: "Expenses",
    body: "Recurring bills generate themselves. Category budgets keep you honest without nagging.",
  },
  {
    icon: Landmark,
    title: "Loans & EMI",
    body: "Full EMI schedules with one-tap paid tracking. Payments flow into expenses automatically — never double-counted.",
  },
] as const;

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <div className="mx-auto max-w-6xl px-6 pt-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground">
              A
            </span>
            <span className="font-display text-xl font-semibold tracking-tight">Artha</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild>
              <Link to="/auth">Get started</Link>
            </Button>
          </div>
        </header>

        <section className="py-20 md:py-28">
          <p className="text-sm font-medium uppercase tracking-widest text-primary">
            Personal finance, quietly powerful
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
            Know exactly where your money stands —{" "}
            <span className="text-primary">every rupee of it</span>.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Artha brings your investments, income, expenses and loan EMIs into one calm dashboard —
            with honest forecasts, not guesses.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" asChild>
              <Link to="/auth">
                Create your free account <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/auth">Sign in with Google or email</Link>
            </Button>
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 text-primary" />
            Your data is private to your account — always.
          </p>
        </section>
      </div>

      {/* Features */}
      <div className="border-y bg-card">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex flex-col gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary">
                <f.icon className="size-5" />
              </span>
              <h3 className="font-display text-lg font-semibold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Closing */}
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="flex flex-col items-start gap-6 rounded-2xl border bg-card p-8 md:flex-row md:items-center md:justify-between md:p-12">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
              See the whole picture in minutes
            </h2>
            <p className="mt-2 max-w-lg text-muted-foreground">
              Savings rate, monthly cash flow, upcoming EMIs and category breakdowns — calculated
              consistently and clearly labelled.
            </p>
          </div>
          <Button size="lg" asChild>
            <Link to="/auth">
              Start tracking <ChartLine className="ml-1 size-4" />
            </Link>
          </Button>
        </div>
        <footer className="mt-10 text-center text-xs text-muted-foreground">
          Artha — your money, in focus.
        </footer>
      </div>
    </div>
  );
}

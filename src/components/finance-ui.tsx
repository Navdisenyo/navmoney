import { useEffect, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { addMonthsClamped } from "@/lib/finance-calc";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  tone = "neutral",
  className,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  tone?: "neutral" | "income" | "negative";
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-5", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-2 font-display text-2xl font-semibold tabular-nums",
          tone === "income" && "text-income",
          tone === "negative" && "text-negative",
        )}
      >
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export function MonthNav({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const label = new Date(`${month}-01T00:00:00`).toLocaleDateString("en", {
    month: "long",
    year: "numeric",
  });
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label="Previous month"
        onClick={() => onChange(addMonthsClamped(`${month}-01`, -1).slice(0, 7))}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="min-w-32 text-center text-sm font-medium tabular-nums">{label}</span>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label="Next month"
        onClick={() => onChange(addMonthsClamped(`${month}-01`, 1).slice(0, 7))}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-card/50 p-10 text-center">
      <p className="font-display font-medium">{title}</p>
      {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-56" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

/** Loader errors: retry re-runs the loader (reset() alone would not). */
export function RouteError({ error, reset }: { error: unknown; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "An unexpected error occurred";
  return (
    <div className="rounded-xl border bg-card p-10 text-center">
      <p className="font-display font-semibold">This page didn't load</p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      <Button
        className="mt-4"
        onClick={() => {
          router.invalidate();
          reset();
        }}
      >
        Try again
      </Button>
    </div>
  );
}

export function RouteNotFound() {
  return (
    <div className="rounded-xl border bg-card p-10 text-center">
      <p className="font-display font-semibold">Nothing here</p>
      <p className="mt-1 text-sm text-muted-foreground">
        This record doesn't exist (or is not yours).
      </p>
    </div>
  );
}

export function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString("en", {
    month: "long",
    year: "numeric",
  });
}

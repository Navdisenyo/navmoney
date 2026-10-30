// Central money/date math for the whole app.
// Every derived money value must go through roundMoney/sumMoney so rounding
// stays consistent (half-up, 2 decimals) across dashboard, reports and pages.

export type Recurrence = "one_time" | "weekly" | "monthly" | "quarterly" | "annually";

export type CompoundingMethod = "simple" | "monthly" | "quarterly" | "half_yearly" | "annually";

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Half-up rounding to 2 decimals, stable for money. */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const scaled = Math.abs(value) * 100 + 1e-9;
  const rounded = Math.round(scaled) / 100;
  return value < 0 ? -rounded : rounded;
}

export function sumMoney(values: number[]): number {
  return roundMoney(values.reduce((acc, v) => acc + v, 0));
}

export function requirePositive(value: number, label = "Amount"): number {
  if (!(typeof value === "number" && Number.isFinite(value) && value > 0)) {
    throw new Error(`${label} must be greater than 0`);
  }
  return value;
}

export function requireNonNegative(value: number, label = "Amount"): number {
  if (!(typeof value === "number" && Number.isFinite(value) && value >= 0)) {
    throw new Error(`${label} cannot be negative`);
  }
  return value;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

type Parts = { y: number; m: number; d: number };

export function parseISO(iso: string): Parts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

export function isoFromParts(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

export function addDaysISO(iso: string, days: number): string {
  const p = parseISO(iso);
  if (!p) return iso;
  const d = new Date(p.y, p.m - 1, p.d + days);
  return isoFromParts(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** Add months, clamping the day (Jan 31 + 1 month -> Feb 28/29). */
export function addMonthsClamped(iso: string, months: number): string {
  const p = parseISO(iso);
  if (!p) return iso;
  const total = p.y * 12 + (p.m - 1) + months;
  const y = Math.floor(total / 12);
  const m = ((total % 12) + 12) % 12; // 0-based
  const d = Math.min(p.d, daysInMonth(y, m + 1));
  return isoFromParts(y, m + 1, d);
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function currentMonthKey(): string {
  return todayISO().slice(0, 7);
}

/** First day of the given month and first day of the next month. */
export function monthRange(month: string): { start: string; end: string } {
  const p = parseISO(`${month}-01`);
  if (!p) throw new Error(`Invalid month: ${month}`);
  return {
    start: isoFromParts(p.y, p.m, 1),
    end: addMonthsClamped(isoFromParts(p.y, p.m, 1), 1),
  };
}

export function nextRecurrenceDate(iso: string, recurrence: Recurrence): string | null {
  switch (recurrence) {
    case "weekly":
      return addDaysISO(iso, 7);
    case "monthly":
      return addMonthsClamped(iso, 1);
    case "quarterly":
      return addMonthsClamped(iso, 3);
    case "annually":
      return addMonthsClamped(iso, 12);
    default:
      return null;
  }
}

/**
 * Equivalent monthly rate for an annual rate (in %), by compounding method.
 * - simple / monthly: nominal r/12
 * - quarterly: (1 + r/4)^(1/3) - 1
 * - half_yearly: (1 + r/2)^(1/6) - 1
 * - annually: effective APY -> (1 + r)^(1/12) - 1
 */
export function monthlyEquivalentRate(
  annualRatePct: number,
  compounding: CompoundingMethod,
): number {
  const r = annualRatePct / 100;
  switch (compounding) {
    case "simple":
    case "monthly":
      return r / 12;
    case "quarterly":
      return Math.pow(1 + r / 4, 1 / 3) - 1;
    case "half_yearly":
      return Math.pow(1 + r / 2, 1 / 6) - 1;
    case "annually":
      return Math.pow(1 + r, 1 / 12) - 1;
  }
}

/** Project a value forward. Market-linked instruments must be labelled
 * hypothetical by the caller; this function only does the math. */
export function projectValue(opts: {
  principal: number;
  annualRatePct: number;
  compounding: CompoundingMethod;
  months: number;
  monthlyContribution?: number;
}): { value: number; totalContributed: number; growth: number } {
  const months = Math.max(0, Math.min(600, Math.round(opts.months)));
  const rate = monthlyEquivalentRate(opts.annualRatePct, opts.compounding);
  let value = opts.principal;
  let contributed = opts.principal;
  const contribution = opts.monthlyContribution ?? 0;
  for (let i = 0; i < months; i++) {
    value += contribution;
    contributed += contribution;
    value *= 1 + rate;
  }
  value = roundMoney(value);
  contributed = roundMoney(contributed);
  return { value, totalContributed: contributed, growth: roundMoney(value - contributed) };
}

/**
 * Savings rate = net savings / actual income x 100.
 * Returns null when actual income is 0 (the rate is undefined, not 0).
 */
export function savingsRate(netSavings: number, actualIncome: number): number | null {
  if (!(actualIncome > 0)) return null;
  return roundMoney((netSavings / actualIncome) * 100);
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "AED ",
  SGD: "S$",
};

export function formatCurrency(amount: number, currency = "INR"): string {
  const locale = currency === "INR" ? "en-IN" : "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${CURRENCY_SYMBOLS[currency] ?? ""}${amount.toLocaleString("en-IN")}`;
  }
}

/** Indian short form for big numbers: 1.25 Cr / 2.50 L, else full format. */
export function formatCompact(amount: number, currency = "INR"): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (currency === "INR") {
    const symbol = CURRENCY_SYMBOLS["INR"];
    if (abs >= 1e7) return `${sign}${symbol}${(abs / 1e7).toFixed(2)} Cr`;
    if (abs >= 1e5) return `${sign}${symbol}${(abs / 1e5).toFixed(2)} L`;
    return formatCurrency(amount, currency);
  }
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
  } catch {
    return formatCurrency(amount, currency);
  }
}

export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";

/** Format an ISO date (YYYY-MM-DD...) per the stored date_format setting. */
export function formatDate(iso: string, format: DateFormat = "DD/MM/YYYY"): string {
  const p = parseISO(iso);
  if (!p) return iso;
  switch (format) {
    case "MM/DD/YYYY":
      return `${pad2(p.d)}/${pad2(p.m)}/${p.y}`.replace(
        `${pad2(p.d)}/${pad2(p.m)}`,
        `${pad2(p.m)}/${pad2(p.d)}`,
      );
    case "YYYY-MM-DD":
      return isoFromParts(p.y, p.m, p.d);
    default:
      return `${pad2(p.d)}/${pad2(p.m)}/${p.y}`;
  }
}

/** EMI schedule: first due on monthlyDueDay of the start month when that day
 * is on/after the start date, otherwise the following month. Capped at 360. */
export function buildEmiSchedule(
  startDateISO: string,
  monthlyDueDay: number,
  count: number,
): string[] {
  const p = parseISO(startDateISO);
  if (!p || !Number.isFinite(monthlyDueDay) || monthlyDueDay < 1 || monthlyDueDay > 28) {
    return [];
  }
  const n = Math.max(0, Math.min(360, Math.round(count)));
  const firstIsCurrentMonth = p.d <= monthlyDueDay;
  const dates: string[] = [];
  for (let i = 0; i < n; i++) {
    dates.push(
      addMonthsClamped(isoFromParts(p.y, p.m, monthlyDueDay), firstIsCurrentMonth ? i : i + 1),
    );
  }
  return dates;
}

export interface InvestmentEarningDetails {
  monthlyAmount: number;
  periodicAmount: number;
  periodLabel: string;
  annualAmount: number;
  payoutIntervalMonths: number | null;
}

/**
 * Calculate interest earnings for an investment based on principal, annual rate,
 * payout frequency (monthly, quarterly, annually, reinvested, etc.) and compounding method.
 */
export function calculateInvestmentEarning(opts: {
  principal: number;
  annualRatePct: number;
  payoutFrequency: string;
  compoundingMethod?: CompoundingMethod;
}): InvestmentEarningDetails {
  const p = Math.max(0, opts.principal || 0);
  const r = Math.max(0, opts.annualRatePct || 0);
  const freq = opts.payoutFrequency;
  const compounding = opts.compoundingMethod ?? "annually";

  if (p === 0 || r === 0) {
    return {
      monthlyAmount: 0,
      periodicAmount: 0,
      periodLabel: "per month",
      annualAmount: 0,
      payoutIntervalMonths: null,
    };
  }

  const annualInterest = roundMoney(p * (r / 100));

  if (freq === "monthly") {
    const monthly = roundMoney(annualInterest / 12);
    return {
      monthlyAmount: monthly,
      periodicAmount: monthly,
      periodLabel: "per month",
      annualAmount: annualInterest,
      payoutIntervalMonths: 1,
    };
  }

  if (freq === "quarterly") {
    const quarterly = roundMoney(annualInterest / 4);
    const monthly = roundMoney(annualInterest / 12);
    return {
      monthlyAmount: monthly,
      periodicAmount: quarterly,
      periodLabel: "per quarter",
      annualAmount: annualInterest,
      payoutIntervalMonths: 3,
    };
  }

  if (freq === "annually") {
    const monthly = roundMoney(annualInterest / 12);
    return {
      monthlyAmount: monthly,
      periodicAmount: annualInterest,
      periodLabel: "per year",
      annualAmount: annualInterest,
      payoutIntervalMonths: 12,
    };
  }

  if (freq === "at_maturity") {
    const monthlyRate = monthlyEquivalentRate(r, compounding);
    const monthly = roundMoney(p * monthlyRate);
    return {
      monthlyAmount: monthly,
      periodicAmount: annualInterest,
      periodLabel: "at maturity",
      annualAmount: annualInterest,
      payoutIntervalMonths: null,
    };
  }

  // "reinvested" or "variable" or other
  const monthlyRate = monthlyEquivalentRate(r, compounding);
  const monthly = roundMoney(p * monthlyRate);
  return {
    monthlyAmount: monthly,
    periodicAmount: monthly,
    periodLabel: freq === "reinvested" ? "accumulated/mo" : "per month",
    annualAmount: annualInterest,
    payoutIntervalMonths: null,
  };
}

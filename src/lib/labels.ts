// Client-safe display labels and form options for the stored enum values.

import type { CompoundingMethod, Recurrence } from "@/lib/finance-calc";

export const INVESTMENT_TYPE_OPTIONS = [
  { value: "fd", label: "Fixed Deposit" },
  { value: "rd", label: "Recurring Deposit" },
  { value: "savings_account", label: "Savings Account" },
  { value: "mutual_fund", label: "Mutual Fund" },
  { value: "stocks", label: "Stocks" },
  { value: "bonds", label: "Bonds" },
  { value: "ppf", label: "PPF" },
  { value: "epf", label: "EPF" },
  { value: "real_estate", label: "Real Estate" },
  { value: "other", label: "Other" },
] as const;

export const INVESTMENT_TYPE_LABELS = Object.fromEntries(
  INVESTMENT_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

/** Market-linked: returns are not fixed, projections must say "hypothetical". */
export const MARKET_LINKED_TYPES = new Set(["mutual_fund", "stocks"]);

export const COMPOUNDING_OPTIONS: { value: CompoundingMethod; label: string }[] = [
  { value: "simple", label: "Simple interest" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "half_yearly", label: "Half-yearly" },
  { value: "annually", label: "Annually" },
];

export const PAYOUT_OPTIONS = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annually" },
  { value: "at_maturity", label: "At maturity" },
  { value: "reinvested", label: "Reinvested" },
  { value: "variable", label: "Variable" },
];

export const INCOME_CATEGORY_OPTIONS = [
  { value: "salary", label: "Salary" },
  { value: "business", label: "Business" },
  { value: "rental", label: "Rental" },
  { value: "investment_income", label: "Investment income" },
  { value: "freelance", label: "Freelance" },
  { value: "other", label: "Other" },
] as const;

export const INCOME_CATEGORY_LABELS = Object.fromEntries(
  INCOME_CATEGORY_OPTIONS.map((o) => [o.value, o.label]),
);

export const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
  { value: "one_time", label: "One time" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Yearly" },
];

export const RECURRENCE_LABELS: Record<string, string> = {
  one_time: "One time",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Yearly",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: "Unpaid",
  paid: "Paid",
  overdue: "Overdue",
};

export const INCOME_STATUS_LABELS: Record<string, string> = {
  received: "Received",
  expected: "Expected",
};

export const CURRENCY_OPTIONS = [
  { value: "INR", label: "₹ Indian Rupee (INR)" },
  { value: "USD", label: "$ US Dollar (USD)" },
  { value: "EUR", label: "€ Euro (EUR)" },
  { value: "GBP", label: "£ British Pound (GBP)" },
  { value: "AED", label: "AED UAE Dirham (AED)" },
  { value: "SGD", label: "S$ Singapore Dollar (SGD)" },
];

export const DATE_FORMAT_OPTIONS = [
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
];

export const WEEK_START_OPTIONS = [
  { value: "MON", label: "Monday" },
  { value: "SUN", label: "Sunday" },
];

/** Palette for user-created expense categories. */
export const CATEGORY_COLORS = [
  "#10b981",
  "#059669",
  "#0d9488",
  "#0891b2",
  "#0284c7",
  "#6366f1",
  "#8b5cf6",
  "#d946ef",
  "#f43f5e",
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#14b8a6",
];

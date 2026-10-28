import { describe, expect, it } from "vitest";
import {
  addMonthsClamped,
  buildEmiSchedule,
  formatCompact,
  formatCurrency,
  monthlyEquivalentRate,
  nextRecurrenceDate,
  projectValue,
  requireNonNegative,
  requirePositive,
  roundMoney,
  savingsRate,
  sumMoney,
} from "@/lib/finance-calc";

describe("roundMoney", () => {
  it("rounds half-up to 2 decimals", () => {
    expect(roundMoney(2.005)).toBe(2.01);
    expect(roundMoney(2.004)).toBe(2.0);
    expect(roundMoney(-2.005)).toBe(-2.01);
    expect(roundMoney(1234.567)).toBe(1234.57);
  });

  it("sumMoney rounds once at the end", () => {
    expect(sumMoney([0.1, 0.2, 0.3])).toBe(0.6);
  });
});

describe("validation", () => {
  it("rejects negative principal", () => {
    expect(() => requirePositive(-5, "Principal")).toThrow("greater than 0");
    expect(() => requireNonNegative(-1, "Principal")).toThrow("cannot be negative");
    expect(requireNonNegative(0, "Principal")).toBe(0);
  });
});

describe("formatting", () => {
  it("formats INR with Indian digit grouping", () => {
    const s = formatCurrency(100000, "INR");
    expect(s).toContain("₹");
    expect(s).toContain("1,00,000");
  });

  it("formats compact Indian units", () => {
    expect(formatCompact(12500000, "INR")).toBe("₹1.25 Cr");
    expect(formatCompact(250000, "INR")).toBe("₹2.50 L");
  });
});

describe("rates and projections", () => {
  it("effective APY converts to equivalent monthly rate", () => {
    const expected = Math.pow(1.12, 1 / 12) - 1;
    expect(monthlyEquivalentRate(12, "annually")).toBeCloseTo(expected, 12);
  });

  it("nominal monthly rate is r/12", () => {
    expect(monthlyEquivalentRate(12, "monthly")).toBeCloseTo(0.01, 12);
    expect(monthlyEquivalentRate(12, "simple")).toBeCloseTo(0.01, 12);
  });

  it("0% rate yields no growth", () => {
    expect(monthlyEquivalentRate(0, "annually")).toBe(0);
    const p = projectValue({
      principal: 100000,
      annualRatePct: 0,
      compounding: "annually",
      months: 24,
    });
    expect(p.value).toBe(100000);
  });

  it("projects 12% APY for 12 months to the principal times 1.12", () => {
    const p = projectValue({
      principal: 100000,
      annualRatePct: 12,
      compounding: "annually",
      months: 12,
    });
    expect(Math.abs(p.value - 112000)).toBeLessThan(0.01);
  });

  it("counts monthly contributions", () => {
    const p = projectValue({
      principal: 0,
      annualRatePct: 0,
      compounding: "annually",
      months: 6,
      monthlyContribution: 5000,
    });
    expect(p.value).toBe(30000);
    expect(p.totalContributed).toBe(30000);
  });
});

describe("savings rate", () => {
  it("is net savings over actual income", () => {
    expect(savingsRate(2000, 10000)).toBe(20);
  });

  it("is unavailable when income is 0", () => {
    expect(savingsRate(500, 0)).toBeNull();
  });
});

describe("dates", () => {
  it("clamps month arithmetic to month length", () => {
    expect(addMonthsClamped("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsClamped("2026-02-28", 1)).toBe("2026-03-28");
    expect(addMonthsClamped("2026-11-15", 3)).toBe("2027-02-15");
  });

  it("advances recurrences", () => {
    expect(nextRecurrenceDate("2026-10-21", "weekly")).toBe("2026-10-28");
    expect(nextRecurrenceDate("2026-10-21", "monthly")).toBe("2026-11-21");
    expect(nextRecurrenceDate("2026-10-21", "one_time")).toBeNull();
  });

  it("builds an EMI schedule from the monthly due day", () => {
    expect(buildEmiSchedule("2026-10-10", 5, 3)).toEqual([
      "2026-11-05",
      "2026-12-05",
      "2027-01-05",
    ]);
    expect(buildEmiSchedule("2026-10-01", 5, 2)).toEqual(["2026-10-05", "2026-11-05"]);
    expect(buildEmiSchedule("2026-01-31", 30, 2)).toEqual([]);
  });
});

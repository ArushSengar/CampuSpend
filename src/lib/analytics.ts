/**
 * All dashboard maths lives here so the server pages, the API routes and the
 * AI insight engine always agree on a number.
 */

import {
  addDays,
  addMonths,
  daysBetween,
  endOfMonth,
  formatMonthLong,
  MONTHS_SHORT,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "@/lib/dates";
import { percent, safePercent, toRupees } from "@/lib/money";

export type AnalyticsCategory = {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  color: string;
  kind: string;
};

export type AnalyticsTxn = {
  id: string;
  amount: number; // paise
  type: string;
  method: string;
  occurredAt: Date;
  merchant: string | null;
  note: string | null;
  accountId: string | null;
  categoryId: string | null;
  splits: string | null;
  confidence: number | null;
  source: string;
  category: AnalyticsCategory | null;
};

export type Range = { from: Date; to: Date };

export const inRange = (t: AnalyticsTxn, r: Range) => t.occurredAt >= r.from && t.occurredAt <= r.to;

export const isExpense = (t: AnalyticsTxn) => t.type === "EXPENSE";
export const isIncome = (t: AnalyticsTxn) => t.type === "INCOME";

export function sum(txns: AnalyticsTxn[], predicate: (t: AnalyticsTxn) => boolean = () => true): number {
  let total = 0;
  for (const t of txns) if (predicate(t)) total += t.amount;
  return total;
}

export function filterRange(txns: AnalyticsTxn[], range: Range): AnalyticsTxn[] {
  return txns.filter((t) => inRange(t, range));
}

export function expensesIn(txns: AnalyticsTxn[], range: Range): number {
  return sum(txns, (t) => inRange(t, range) && isExpense(t));
}

export function incomeIn(txns: AnalyticsTxn[], range: Range): number {
  return sum(txns, (t) => inRange(t, range) && isIncome(t));
}

/* ------------------------------- breakdowns -------------------------------- */

export type CategorySlice = {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  color: string;
  amount: number;
  count: number;
  share: number; // 0..100
  prevAmount: number;
  deltaPercent: number | null;
};

export function categoryBreakdown(
  txns: AnalyticsTxn[],
  range: Range,
  prevRange: Range,
  limit = 8,
): { slices: CategorySlice[]; total: number; other: CategorySlice | null } {
  const map = new Map<string, { cat: AnalyticsCategory; amount: number; count: number }>();
  const prevMap = new Map<string, number>();

  for (const t of txns) {
    if (!isExpense(t)) continue;
    if (inRange(t, prevRange)) {
      const key = t.category?.id ?? "uncategorised";
      prevMap.set(key, (prevMap.get(key) ?? 0) + t.amount);
    }
    if (!inRange(t, range)) continue;
    const key = t.category?.id ?? "uncategorised";
    const entry =
      map.get(key) ??
      {
        cat: t.category ?? {
          id: "uncategorised",
          name: "Uncategorised",
          slug: "uncategorised",
          emoji: "❔",
          color: "#94a3b8",
          kind: "EXPENSE",
        },
        amount: 0,
        count: 0,
      };
    entry.amount += t.amount;
    entry.count += 1;
    map.set(key, entry);
  }

  const total = [...map.values()].reduce((acc, e) => acc + e.amount, 0);
  const slices: CategorySlice[] = [...map.values()]
    .map(({ cat, amount, count }) => {
      const prevAmount = prevMap.get(cat.id) ?? 0;
      return {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        emoji: cat.emoji,
        color: cat.color,
        amount,
        count,
        share: safePercent(amount, total),
        prevAmount,
        deltaPercent: prevAmount > 0 ? Math.round(((amount - prevAmount) / prevAmount) * 100) : null,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  return { slices, total, other: slices.length > limit ? slices[limit - 1] : null };
}

export type MethodSlice = { method: string; amount: number; count: number; share: number };

export function methodSplit(txns: AnalyticsTxn[], range: Range): MethodSlice[] {
  const map = new Map<string, { amount: number; count: number }>();
  for (const t of txns) {
    if (!inRange(t, range) || !isExpense(t)) continue;
    const entry = map.get(t.method) ?? { amount: 0, count: 0 };
    entry.amount += t.amount;
    entry.count += 1;
    map.set(t.method, entry);
  }
  const total = [...map.values()].reduce((a, e) => a + e.amount, 0);
  return [...map.entries()]
    .map(([method, e]) => ({ method, amount: e.amount, count: e.count, share: safePercent(e.amount, total) }))
    .sort((a, b) => b.amount - a.amount);
}

export type DailyPoint = { date: string; label: string; expense: number; income: number };

export function dailySeries(txns: AnalyticsTxn[], days = 30, now = new Date()): DailyPoint[] {
  const points: DailyPoint[] = [];
  const buckets = new Map<string, { expense: number; income: number }>();
  for (let i = 0; i < days; i++) {
    const d = addDays(now, -(days - 1 - i));
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    buckets.set(key, { expense: 0, income: 0 });
  }
  for (const t of txns) {
    const key = `${t.occurredAt.getFullYear()}-${t.occurredAt.getMonth()}-${t.occurredAt.getDate()}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (isExpense(t)) bucket.expense += t.amount;
    else bucket.income += t.amount;
  }
  for (let i = 0; i < days; i++) {
    const d = addDays(now, -(days - 1 - i));
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const b = buckets.get(key)!;
    points.push({
      date: d.toISOString(),
      label: `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`,
      expense: b.expense,
      income: b.income,
    });
  }
  return points;
}

export type MonthPoint = { key: string; label: string; expense: number; income: number; net: number };

export function monthlySeries(txns: AnalyticsTxn[], months = 6, now = new Date()): MonthPoint[] {
  const out: MonthPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = subMonths(now, i);
    const from = startOfMonth(d);
    const to = endOfMonth(d);
    const expense = expensesIn(txns, { from, to });
    const income = incomeIn(txns, { from, to });
    out.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: formatMonthLong(d), expense, income, net: income - expense });
  }
  return out;
}

export type MerchantRow = { merchant: string; amount: number; count: number; lastAt: Date };

export function topMerchants(txns: AnalyticsTxn[], range: Range, limit = 5): MerchantRow[] {
  const map = new Map<string, { amount: number; count: number; lastAt: Date }>();
  for (const t of txns) {
    if (!inRange(t, range) || !isExpense(t) || !t.merchant) continue;
    const key = t.merchant;
    const entry = map.get(key) ?? { amount: 0, count: 0, lastAt: t.occurredAt };
    entry.amount += t.amount;
    entry.count += 1;
    if (t.occurredAt > entry.lastAt) entry.lastAt = t.occurredAt;
    map.set(key, entry);
  }
  return [...map.entries()]
    .map(([merchant, e]) => ({ merchant, ...e }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

/* ---------------------------------- streaks --------------------------------- */

export function loggingStreak(txns: AnalyticsTxn[], now = new Date()): { current: number; longest: number } {
  const days = new Set(txns.map((t) => startOfDay(t.occurredAt).getTime()));
  let current = 0;
  let cursor = startOfDay(now);
  if (!days.has(cursor.getTime())) cursor = addDays(cursor, -1); // streak can survive "today not logged yet"
  while (days.has(cursor.getTime())) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  const sorted = [...days].sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const day of sorted) {
    run = prev !== null && day - prev === 86400000 ? run + 1 : 1;
    prev = day;
    if (run > longest) longest = run;
  }
  return { current, longest };
}

/* --------------------------------- budgets ---------------------------------- */

export type BudgetStatus = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  limit: number;
  spent: number;
  remaining: number;
  percent: number;
  status: "safe" | "watch" | "over";
  categoryId: string | null;
  period: string;
};

export function budgetStatuses(
  txns: AnalyticsTxn[],
  budgets: { id: string; limit: number; period: string; categoryId: string | null; category: AnalyticsCategory | null }[],
  now = new Date(),
): BudgetStatus[] {
  const monthStart = startOfMonth(now);
  const weekStart = startOfWeek(now);
  const daysInMonth = endOfMonth(now).getDate();
  const dayOfMonth = now.getDate();

  return budgets.map((b) => {
    const from = b.period === "WEEKLY" ? weekStart : monthStart;
    const spent = sum(
      txns,
      (t) => isExpense(t) && t.occurredAt >= from && (b.categoryId ? t.categoryId === b.categoryId : true),
    );
    const pct = safePercent(spent, b.limit);
    // pace: how much of the period has elapsed
    const elapsedPct = b.period === "WEEKLY" ? ((now.getDay() + 1) / 7) * 100 : (dayOfMonth / daysInMonth) * 100;
    const status: BudgetStatus["status"] =
      pct >= 100 ? "over" : pct >= Math.max(75, elapsedPct + 10) ? "watch" : "safe";
    return {
      id: b.id,
      name: b.category?.name ?? "Overall spending",
      emoji: b.category?.emoji ?? "🎯",
      color: b.category?.color ?? "#6366f1",
      limit: b.limit,
      spent,
      remaining: b.limit - spent,
      percent: Math.min(150, pct),
      status,
      categoryId: b.categoryId,
      period: b.period,
    };
  });
}

/* ---------------------------------- snapshot -------------------------------- */

/**
 * Projected month-end spend.
 *
 * Naive pace (spend ÷ days elapsed × days in month) goes crazy on the 1st of a
 * month — one rent payment looks like a ₹1.9L month. So we blend this month's
 * pace with the trailing 30-day average, weighting the pace in as the month
 * accumulates evidence.
 */
export function monthProjection(txns: AnalyticsTxn[], now = new Date()): number {
  const from = startOfMonth(now);
  const spent = expensesIn(txns, { from, to: now });
  const daysElapsed = Math.max(1, daysBetween(from, now) + 1);
  const daysInMonth = endOfMonth(now).getDate();
  const daysLeft = Math.max(0, daysInMonth - daysElapsed);

  const pace = spent / daysElapsed;
  const trailingFrom = new Date(now.getTime() - 30 * 86400000);
  const trailingAvg = expensesIn(txns, { from: trailingFrom, to: now }) / 30;
  // Ramp the pace in quadratically: early in the month a single rent payment
  // shouldn't set the trajectory, so the trailing average carries the estimate.
  const weight = Math.pow(Math.min(1, daysElapsed / daysInMonth), 2);
  const daily = pace * weight + trailingAvg * (1 - weight);

  return Math.round(spent + daily * daysLeft);
}

export function averageDailyExpense(txns: AnalyticsTxn[], range: Range): number {
  const days = Math.max(1, daysBetween(range.from, range.to) + 1);
  return Math.round(expensesIn(txns, range) / days);
}

export function weekdayVsWeekend(txns: AnalyticsTxn[], range: Range): { weekday: number; weekend: number } {
  let weekday = 0;
  let weekend = 0;
  const weekdayCount = new Set<number>();
  const weekendCount = new Set<number>();
  for (const t of txns) {
    if (!inRange(t, range) || !isExpense(t)) continue;
    const key = startOfDay(t.occurredAt).getTime();
    const day = t.occurredAt.getDay();
    if (day === 0 || day === 6) {
      weekend += t.amount;
      weekendCount.add(key);
    } else {
      weekday += t.amount;
      weekdayCount.add(key);
    }
  }
  return {
    weekday: weekdayCount.size ? Math.round(weekday / weekdayCount.size) : 0,
    weekend: weekendCount.size ? Math.round(weekend / weekendCount.size) : 0,
  };
}

/** spend in the current month up to the same day-of-month, one month ago */
export function sameDayLastMonth(txns: AnalyticsTxn[], now = new Date()): number {
  const from = startOfMonth(now);
  const lastMonthFrom = startOfMonth(subMonths(now, 1));
  const dayOfMonth = now.getDate();
  const lastDay = new Date(lastMonthFrom.getFullYear(), lastMonthFrom.getMonth() + 1, 0).getDate();
  const to = new Date(lastMonthFrom.getFullYear(), lastMonthFrom.getMonth(), Math.min(dayOfMonth, lastDay), 23, 59, 59, 999);
  void from;
  return expensesIn(txns, { from: lastMonthFrom, to });
}

export { addMonths, percent, toRupees };

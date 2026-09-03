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
  effectiveLimit: number;
  rolloverAmount: number;
  spent: number;
  remaining: number;
  percent: number;
  status: "safe" | "watch" | "over";
  categoryId: string | null;
  period: string;
  rollover?: boolean;
};

export function budgetStatuses(
  txns: AnalyticsTxn[],
  budgets: {
    id: string;
    limit: number;
    period: string;
    rollover?: boolean;
    categoryId: string | null;
    category: AnalyticsCategory | null;
  }[],
  now = new Date(),
): BudgetStatus[] {
  const monthStart = startOfMonth(now);
  const weekStart = startOfWeek(now);
  const daysInMonth = endOfMonth(now).getDate();
  const dayOfMonth = now.getDate();

  const prevMonthRange = {
    from: startOfMonth(subMonths(now, 1)),
    to: endOfMonth(subMonths(now, 1)),
  };

  return budgets.map((b) => {
    const from = b.period === "WEEKLY" ? weekStart : monthStart;
    const spent = sum(
      txns,
      (t) => isExpense(t) && t.occurredAt >= from && (b.categoryId ? t.categoryId === b.categoryId : true),
    );

    // Rollover calculations
    let rolloverAmount = 0;
    if (b.rollover && b.period === "MONTHLY") {
      const prevSpent = sum(
        txns,
        (t) =>
          isExpense(t) &&
          inRange(t, prevMonthRange) &&
          (b.categoryId ? t.categoryId === b.categoryId : true),
      );
      if (b.limit > prevSpent) {
        rolloverAmount = Math.min(b.limit, b.limit - prevSpent); // Rollover surplus
      }
    }

    const effectiveLimit = b.limit + rolloverAmount;
    const pct = safePercent(spent, effectiveLimit);
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
      effectiveLimit,
      rolloverAmount,
      spent,
      remaining: effectiveLimit - spent,
      percent: Math.min(150, pct),
      status,
      categoryId: b.categoryId,
      period: b.period,
      rollover: Boolean(b.rollover),
    };
  });
}

/* --------------------------- financial health score ------------------------- */

export type HealthPillar = {
  name: string;
  score: number;
  maxScore: number;
  status: "good" | "fair" | "needs-work";
  feedback: string;
};

export type FinancialHealthResult = {
  score: number; // 0..100
  grade: "A+" | "A" | "B" | "C" | "D";
  title: string;
  summary: string;
  pillars: HealthPillar[];
  topTips: string[];
};

export function calculateFinancialHealthScore(input: {
  txns: AnalyticsTxn[];
  budgets: BudgetStatus[];
  monthlyIncome: number;
  monthExpense: number;
  monthIncome: number;
  now?: Date;
}): FinancialHealthResult {
  const { txns, budgets, monthlyIncome, monthExpense, monthIncome, now = new Date() } = input;

  // 1. Budget Adherence (0..30 points)
  let budgetScore = 30;
  let budgetFeedback = "All monthly spending targets on track!";
  if (budgets.length > 0) {
    const overCount = budgets.filter((b) => b.status === "over").length;
    const watchCount = budgets.filter((b) => b.status === "watch").length;
    budgetScore = Math.max(0, 30 - overCount * 12 - watchCount * 4);
    if (overCount > 0) {
      budgetFeedback = `${overCount} budget category is currently exceeded.`;
    } else if (watchCount > 0) {
      budgetFeedback = `${watchCount} budget category near threshold.`;
    }
  } else {
    budgetScore = 20; // Default baseline when no budgets set
    budgetFeedback = "Set monthly category caps to boost your score.";
  }

  // 2. Logging Consistency & Streak (0..30 points)
  const streak = loggingStreak(txns, now);
  let streakScore = 10;
  let streakFeedback = "Log transactions daily to sharpen tracking.";
  if (streak.current >= 14) {
    streakScore = 30;
    streakFeedback = `Legendary ${streak.current}-day tracking streak!`;
  } else if (streak.current >= 7) {
    streakScore = 25;
    streakFeedback = `Strong ${streak.current}-day streak in progress.`;
  } else if (streak.current >= 3) {
    streakScore = 18;
    streakFeedback = `${streak.current}-day streak. Keep it going!`;
  }

  // 3. Savings Rate & Buffer (0..25 points)
  const expectedIncome = monthlyIncome > 0 ? monthlyIncome : monthIncome;
  let savingsScore = 15;
  let savingsFeedback = "Aim to keep 20%+ of your allowance unspent.";
  if (expectedIncome > 0) {
    const savingsRatio = (expectedIncome - monthExpense) / expectedIncome;
    if (savingsRatio >= 0.25) {
      savingsScore = 25;
      savingsFeedback = `${Math.round(savingsRatio * 100)}% savings rate — exceptional student buffer!`;
    } else if (savingsRatio >= 0.1) {
      savingsScore = 18;
      savingsFeedback = `Saving ~${Math.round(savingsRatio * 100)}% of monthly allowance.`;
    } else if (savingsRatio >= 0) {
      savingsScore = 12;
      savingsFeedback = "Breaking even this month. Try trimming impulse orders.";
    } else {
      savingsScore = 5;
      savingsFeedback = "Spending exceeds monthly allowance.";
    }
  }

  // 4. Cash Discipline (0..15 points)
  const monthRange = { from: startOfMonth(now), to: now };
  const monthTxns = filterRange(txns, monthRange);
  const cashSpend = sum(monthTxns, (t) => isExpense(t) && t.method === "CASH");
  const cashRatio = monthExpense > 0 ? cashSpend / monthExpense : 0;
  let cashScore = 15;
  let cashFeedback = "Clean digital audit trail via UPI & cards.";
  if (cashRatio > 0.5) {
    cashScore = 6;
    cashFeedback = "Over 50% cash spend — easy to lose track of receipts.";
  } else if (cashRatio > 0.3) {
    cashScore = 10;
    cashFeedback = "Moderate cash usage. Note cash payments right away.";
  }

  const totalScore = Math.min(100, Math.max(0, budgetScore + streakScore + savingsScore + cashScore));

  const grade: FinancialHealthResult["grade"] =
    totalScore >= 90 ? "A+" : totalScore >= 80 ? "A" : totalScore >= 65 ? "B" : totalScore >= 50 ? "C" : "D";

  const title =
    totalScore >= 90
      ? "Campus Financier 👑"
      : totalScore >= 80
        ? "Budget Master 🚀"
        : totalScore >= 65
          ? "On Solid Track 📈"
          : totalScore >= 50
            ? "Building Habits 🌱"
            : "Needs Attention ⚠️";

  const summary =
    totalScore >= 80
      ? "You have outstanding financial discipline for a college student!"
      : "You're doing well. A few minor tweaks will help you save even more.";

  const pillars: HealthPillar[] = [
    {
      name: "Budget Discipline",
      score: budgetScore,
      maxScore: 30,
      status: budgetScore >= 24 ? "good" : budgetScore >= 16 ? "fair" : "needs-work",
      feedback: budgetFeedback,
    },
    {
      name: "Logging Habit",
      score: streakScore,
      maxScore: 30,
      status: streakScore >= 24 ? "good" : streakScore >= 16 ? "fair" : "needs-work",
      feedback: streakFeedback,
    },
    {
      name: "Savings Rate",
      score: savingsScore,
      maxScore: 25,
      status: savingsScore >= 18 ? "good" : savingsScore >= 12 ? "fair" : "needs-work",
      feedback: savingsFeedback,
    },
    {
      name: "Payment Trail",
      score: cashScore,
      maxScore: 15,
      status: cashScore >= 12 ? "good" : cashScore >= 8 ? "fair" : "needs-work",
      feedback: cashFeedback,
    },
  ];

  const topTips: string[] = [];
  if (budgetScore < 24) topTips.push("Review and adjust any budget categories in warning or over state.");
  if (streakScore < 25) topTips.push("Keep a 7-day logging streak active using quick natural-language entries.");
  if (savingsScore < 18) topTips.push("Cut back 1-2 restaurant deliveries this week to build your buffer.");
  if (cashScore < 12) topTips.push("Log cash withdrawals or chai payments immediately.");
  if (!topTips.length) topTips.push("Maintain your current logging and savings cadence!");

  return {
    score: totalScore,
    grade,
    title,
    summary,
    pillars,
    topTips: topTips.slice(0, 2),
  };
}

/* ------------------------------- achievements ------------------------------- */

export type StudentBadge = {
  id: string;
  title: string;
  emoji: string;
  description: string;
  unlocked: boolean;
  progressText: string;
};

export function evaluateBadges(input: {
  txns: AnalyticsTxn[];
  goals: { targetAmount: number; savedAmount: number }[];
  streak: { current: number; longest: number };
}): StudentBadge[] {
  const { txns, goals, streak } = input;

  const totalTxns = txns.length;
  const upiCount = txns.filter((t) => t.method === "UPI").length;
  const upiRatio = totalTxns > 0 ? (upiCount / totalTxns) * 100 : 0;
  const chaiTxns = txns.filter((t) => t.category?.slug === "chai");
  const splitTxns = txns.filter((t) => Boolean(t.splits));
  const goalFunded = goals.some((g) => g.savedAmount >= g.targetAmount * 0.75);

  return [
    {
      id: "streak-7",
      title: "Consistency Champion",
      emoji: "🔥",
      description: "Log expenses for 7+ days in a row",
      unlocked: streak.longest >= 7,
      progressText: `${streak.current}/7 days streak`,
    },
    {
      id: "chai-master",
      title: "Chai Regular",
      emoji: "☕",
      description: "Logged 5+ chai & tapri sessions",
      unlocked: chaiTxns.length >= 5,
      progressText: `${chaiTxns.length}/5 logged`,
    },
    {
      id: "upi-ninja",
      title: "UPI Power User",
      emoji: "📱",
      description: "Over 75% digital UPI transactions",
      unlocked: upiRatio >= 75 && totalTxns >= 10,
      progressText: `${Math.round(upiRatio)}% UPI rate`,
    },
    {
      id: "roommate-diplomat",
      title: "Roommate Diplomat",
      emoji: "👥",
      description: "Split expenses with friends",
      unlocked: splitTxns.length >= 3,
      progressText: `${splitTxns.length} splits logged`,
    },
    {
      id: "goal-crusher",
      title: "Goal Crusher",
      emoji: "🎯",
      description: "75%+ funded on a savings goal",
      unlocked: goalFunded,
      progressText: goalFunded ? "Unlocked!" : "In progress",
    },
    {
      id: "century-club",
      title: "Century Club",
      emoji: "💯",
      description: "Logged over 100 campus transactions",
      unlocked: totalTxns >= 100,
      progressText: `${totalTxns}/100 transactions`,
    },
  ];
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

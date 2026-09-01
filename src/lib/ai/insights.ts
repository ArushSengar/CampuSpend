/**
 * Rule-based "AI coach". Every insight is computed from the user's own numbers,
 * so it works offline and never hallucinates a figure.
 */

import { addMonths, daysBetween, endOfMonth, startOfMonth, subMonths } from "@/lib/dates";
import { formatMoney, percent, safePercent, toRupees } from "@/lib/money";
import {
  averageDailyExpense,
  expensesIn,
  filterRange,
  incomeIn,
  isExpense,
  loggingStreak,
  sameDayLastMonth,
  weekdayVsWeekend,
  topMerchants,
  type AnalyticsTxn,
  type BudgetStatus,
  type CategorySlice,
  type MethodSlice,
} from "@/lib/analytics";

export type InsightTone = "positive" | "warning" | "critical" | "info";

export type Insight = {
  id: string;
  tone: InsightTone;
  emoji: string;
  title: string;
  body: string;
  action?: { label: string; href: string };
};

export type GoalInsightInput = {
  id: string;
  name: string;
  emoji: string;
  targetAmount: number;
  savedAmount: number;
  deadline: Date | null;
};

export type InsightInput = {
  txns: AnalyticsTxn[];
  now: Date;
  monthExpense: number;
  monthIncome: number;
  prevMonthExpense: number;
  projection: number;
  categories: CategorySlice[];
  methods: MethodSlice[];
  budgets: BudgetStatus[];
  goals: GoalInsightInput[];
  monthlyIncomeSetting: number;
};

const TONE_ORDER: InsightTone[] = ["critical", "warning", "info", "positive"];

export function buildInsights(input: InsightInput): Insight[] {
  const out: Insight[] = [];
  const { txns, now, categories, methods, budgets, goals } = input;
  const monthStart = startOfMonth(now);
  const monthRange = { from: monthStart, to: now };
  const monthTxns = filterRange(txns, monthRange);

  if (txns.length === 0) {
    return [
      {
        id: "empty",
        tone: "info",
        emoji: "🌱",
        title: "Your coach is warming up",
        body: "Log a few transactions — or type something like “chai 20 yesterday” — and CampuSpend will start spotting patterns for you.",
        action: { label: "Add your first expense", href: "/transactions?new=1" },
      },
    ];
  }

  /* 1. pace vs income ------------------------------------------------------- */
  const expectedIncome = input.monthlyIncomeSetting > 0 ? input.monthlyIncomeSetting : input.monthIncome;
  if (expectedIncome > 0) {
    const savingsRate = safePercent(expectedIncome - input.monthExpense, expectedIncome);
    const pace = safePercent(input.projection, expectedIncome);
    if (pace > 100) {
      out.push({
        id: "pace-over",
        tone: "critical",
        emoji: "🚨",
        title: `You're on pace to spend ${formatMoney(input.projection)} this month`,
        body: `That's ${formatMoney(input.projection - expectedIncome)} more than the ${formatMoney(expectedIncome)} you typically have. Cutting ${formatMoney(
          Math.round((input.projection - expectedIncome) / Math.max(1, daysBetween(now, endOfMonth(now)))),
        )} a day gets you back to even.`,
        action: { label: "See where it goes", href: "/insights" },
      });
    } else if (savingsRate >= 20) {
      out.push({
        id: "pace-good",
        tone: "positive",
        emoji: "🏦",
        title: `${Math.round(savingsRate)}% of this month's money is still yours`,
        body: `${formatMoney(input.monthIncome - input.monthExpense)} left after ${formatMoney(input.monthExpense)} of spending. Keep it up — that's real savings.`,
      });
    } else {
      out.push({
        id: "pace-info",
        tone: "info",
        emoji: "📈",
        title: `Projected month-end spend: ${formatMoney(input.projection)}`,
        body: `You've spent ${formatMoney(input.monthExpense)} so far. At this pace you'll keep about ${formatMoney(
          Math.max(0, expectedIncome - input.projection),
        )} of your ${formatMoney(expectedIncome)}.`,
      });
    }
  }

  /* 2. month-over-month ----------------------------------------------------- */
  // Day-1 vs day-1 comparisons are noise; wait until the month has some shape.
  const lastMonthSameDay = now.getDate() >= 5 ? sameDayLastMonth(txns, now) : 0;
  if (lastMonthSameDay > 0 && input.monthExpense > 0) {
    const delta = Math.round(((input.monthExpense - lastMonthSameDay) / lastMonthSameDay) * 100);
    if (Math.abs(delta) >= 12) {
      out.push({
        id: "mom",
        tone: delta > 0 ? "warning" : "positive",
        emoji: delta > 0 ? "📊" : "📉",
        title: delta > 0 ? `Spending up ${delta}% vs last month` : `Spending down ${Math.abs(delta)}% vs last month`,
        body: `By this day last month you'd spent ${formatMoney(lastMonthSameDay)}. You're at ${formatMoney(input.monthExpense)} now.`,
      });
    }
  }

  /* 3. category movers ------------------------------------------------------ */
  const mover = [...categories]
    .filter((c) => c.prevAmount > 0 && c.amount >= 20000)
    .sort((a, b) => (b.deltaPercent ?? 0) - (a.deltaPercent ?? 0))[0];
  if (mover && (mover.deltaPercent ?? 0) >= 40) {
    out.push({
      id: `mover-${mover.slug}`,
      tone: "warning",
      emoji: mover.emoji,
      title: `${mover.name} jumped ${mover.deltaPercent}%`,
      body: `${formatMoney(mover.amount)} this month vs ${formatMoney(mover.prevAmount)} last month — ${mover.count} transactions, ${Math.round(
        mover.share,
      )}% of your spending.`,
      action: { label: "Review transactions", href: `/transactions?category=${mover.id}` },
    });
  }

  /* 4. budget health -------------------------------------------------------- */
  for (const b of budgets) {
    if (b.status === "over") {
      out.push({
        id: `budget-over-${b.id}`,
        tone: "critical",
        emoji: "💥",
        title: `${b.name} budget exceeded`,
        body: `${formatMoney(b.spent)} of ${formatMoney(b.limit)} used — ${formatMoney(Math.abs(b.remaining))} over.`,
        action: { label: "Adjust budget", href: "/budgets" },
      });
    } else if (b.status === "watch" && b.percent >= 80) {
      out.push({
        id: `budget-watch-${b.id}`,
        tone: "warning",
        emoji: "⚠️",
        title: `${b.name} is ${Math.round(b.percent)}% used`,
        body: `${formatMoney(b.remaining)} left for the rest of the ${b.period.toLowerCase().replace("ly", "")}.`,
        action: { label: "Open budgets", href: "/budgets" },
      });
    }
  }

  /* 5. cash leakage --------------------------------------------------------- */
  const cash = methods.find((m) => m.method === "CASH");
  const upi = methods.find((m) => m.method === "UPI");
  if (cash && upi && cash.amount > 0 && cash.share >= 40) {
    out.push({
      id: "cash-heavy",
      tone: "info",
      emoji: "💵",
      title: `${Math.round(cash.share)}% of your spending is cash`,
      body: `Cash is the easiest money to lose track of. ${formatMoney(cash.amount)} across ${cash.count} cash transactions this month vs ${formatMoney(
        upi.amount,
      )} on UPI.`,
    });
  }

  /* 6. small-ticket creep --------------------------------------------------- */
  const small = monthTxns.filter((t) => isExpense(t) && t.amount <= 10000);
  if (small.length >= 8) {
    const smallTotal = small.reduce((a, t) => a + t.amount, 0);
    out.push({
      id: "small-ticket",
      tone: smallTotal > input.monthExpense * 0.25 ? "warning" : "info",
      emoji: "☕",
      title: `${small.length} tiny purchases added up to ${formatMoney(smallTotal)}`,
      body: `Everything under ₹100 — chai, snacks, autos. Individually harmless, together ${Math.round(
        safePercent(smallTotal, input.monthExpense),
      )}% of the month.`,
      action: { label: "See them", href: "/transactions?max=100" },
    });
  }

  /* 7. biggest single expense ---------------------------------------------- */
  const biggest = [...monthTxns].filter(isExpense).sort((a, b) => b.amount - a.amount)[0];
  if (biggest && biggest.amount >= input.monthExpense * 0.2 && input.monthExpense > 0) {
    out.push({
      id: "biggest",
      tone: "info",
      emoji: "🧾",
      title: `Biggest expense: ${biggest.merchant ?? biggest.category?.name ?? "Uncategorised"}`,
      body: `${formatMoney(biggest.amount)} on ${biggest.occurredAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} — ${Math.round(
        safePercent(biggest.amount, input.monthExpense),
      )}% of this month in one go.`,
    });
  }

  /* 8. weekend vs weekday --------------------------------------------------- */
  const wv = weekdayVsWeekend(txns, monthRange);
  if (wv.weekend > 0 && wv.weekday > 0 && wv.weekend > wv.weekday * 1.4) {
    out.push({
      id: "weekend",
      tone: "info",
      emoji: "🎉",
      title: "Weekends cost you more",
      body: `You average ${formatMoney(wv.weekend)} on weekends vs ${formatMoney(wv.weekday)} on weekdays — about ${formatMoney(
        (wv.weekend - wv.weekday) * 8,
      )} a month if the pattern holds.`,
    });
  }

  /* 9. subscriptions -------------------------------------------------------- */
  const sub = categories.find((c) => c.slug === "subscriptions");
  if (sub && sub.amount > 0) {
    out.push({
      id: "subs",
      tone: "info",
      emoji: "🎬",
      title: `${formatMoney(sub.amount)} on subscriptions this month`,
      body: `That's ${formatMoney(sub.amount * 12)} a year. Worth an audit — most students pay for at least one they forgot.`,
    });
  }

  /* 10. top merchant -------------------------------------------------------- */
  const merchants = topMerchants(txns, monthRange, 1);
  if (merchants[0] && merchants[0].count >= 4) {
    out.push({
      id: "top-merchant",
      tone: "info",
      emoji: "🏪",
      title: `${merchants[0].merchant} is your #1 this month`,
      body: `${formatMoney(merchants[0].amount)} across ${merchants[0].count} visits — averaging ${formatMoney(
        Math.round(merchants[0].amount / merchants[0].count),
      )} each.`,
    });
  }

  /* 11. goals --------------------------------------------------------------- */
  for (const g of goals) {
    const pct = safePercent(g.savedAmount, g.targetAmount);
    if (pct >= 100) continue;
    const remaining = g.targetAmount - g.savedAmount;
    if (g.deadline) {
      const monthsLeft = Math.max(1, Math.round(daysBetween(now, g.deadline) / 30));
      const perMonth = Math.round(remaining / monthsLeft);
      const monthsOfIncome = input.monthlyIncomeSetting > 0 ? perMonth / input.monthlyIncomeSetting : 0;
      if (monthsOfIncome > 0.4) {
        out.push({
          id: `goal-tight-${g.id}`,
          tone: "warning",
          emoji: g.emoji,
          title: `${g.name} needs ${formatMoney(perMonth)}/month`,
          body: `${formatMoney(remaining)} left in ${monthsLeft} month${monthsLeft === 1 ? "" : "s"} — that's ${Math.round(
            monthsOfIncome * 100,
          )}% of your monthly money. Consider pushing the date or trimming the target.`,
          action: { label: "Open goals", href: "/goals" },
        });
      } else {
        out.push({
          id: `goal-ok-${g.id}`,
          tone: "positive",
          emoji: g.emoji,
          title: `${g.name}: ${Math.round(pct)}% funded`,
          body: `${formatMoney(remaining)} to go. Saving ${formatMoney(perMonth)} a month hits it ${monthsLeft <= 1 ? "this month" : `in ${monthsLeft} months`}.`,
          action: { label: "Open goals", href: "/goals" },
        });
      }
    }
  }

  /* 12. streak -------------------------------------------------------------- */
  const streak = loggingStreak(txns, now);
  if (streak.current >= 3) {
    out.push({
      id: "streak",
      tone: "positive",
      emoji: "🔥",
      title: `${streak.current}-day logging streak`,
      body: `You've logged money ${streak.current} days in a row${streak.longest > streak.current ? ` (best ever: ${streak.longest})` : ""}. Consistent tracking is the #1 predictor of sticking to a budget.`,
    });
  } else if (txns.length > 5) {
    out.push({
      id: "streak-low",
      tone: "info",
      emoji: "📝",
      title: "Try logging for 3 days straight",
      body: "One-line entries like “auto 60” take 5 seconds and make every insight here sharper.",
    });
  }

  /* 13. quiet days ---------------------------------------------------------- */
  const avgDaily = averageDailyExpense(txns, { from: startOfMonth(now), to: now });
  const todaySpend = expensesIn(txns, { from: new Date(now.getFullYear(), now.getMonth(), now.getDate()), to: now });
  if (todaySpend === 0 && avgDaily > 0) {
    out.push({
      id: "no-spend-today",
      tone: "positive",
      emoji: "🌤️",
      title: "Zero spend logged today",
      body: avgDaily > 0 ? `You usually spend ${formatMoney(avgDaily)} a day — that's ${formatMoney(avgDaily)} still in your pocket.` : "Nice.",
    });
  }

  return out
    .sort((a, b) => TONE_ORDER.indexOf(a.tone) - TONE_ORDER.indexOf(b.tone))
    .slice(0, 6);
}

/** Headline numbers used by the dashboard header + the "ask" endpoint. */
export function quickStats(input: { txns: AnalyticsTxn[]; now: Date }) {
  const { txns, now } = input;
  const monthRange = { from: startOfMonth(now), to: now };
  const prevMonth = { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) };
  const last30 = { from: new Date(new Date().setDate(now.getDate() - 29)), to: now };
  return {
    monthExpense: expensesIn(txns, monthRange),
    monthIncome: incomeIn(txns, monthRange),
    prevMonthExpense: expensesIn(txns, prevMonth),
    last30Expense: expensesIn(txns, last30),
    allTimeExpense: expensesIn(txns, { from: new Date(2000, 0, 1), to: addMonths(now, 1) }),
    txnCount: txns.length,
  };
}

export const insightHelpers = { percent, toRupees, formatMoney };

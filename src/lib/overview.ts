import {
  getUserAccounts,
  getUserBudgets,
  getUserCategories,
  getUserGoals,
  getUserRecurrings,
  loadAnalyticsTxns,
  queryTransactions,
  applyDueRecurrings,
} from "@/lib/queries";
import {
  budgetStatuses,
  categoryBreakdown,
  dailySeries,
  expensesIn,
  filterRange,
  incomeIn,
  loggingStreak,
  methodSplit,
  monthlySeries,
  monthProjection,
  sameDayLastMonth,
  topMerchants,
  weekdayVsWeekend,
} from "@/lib/analytics";
import { buildInsights } from "@/lib/ai/insights";
import { serializeAccount, serializeGoal, serializeRecurring, serializeTxn } from "@/lib/serialize";
import { addMonths, endOfMonth, startOfMonth } from "@/lib/dates";

export type Overview = Awaited<ReturnType<typeof buildOverview>>;

/**
 * Single source of truth for the dashboard. Used by both the server-rendered
 * page (fast first paint) and GET /api/overview (client refreshes).
 */
export async function buildOverview(userId: string, userName: string, monthlyIncome: number) {
  await applyDueRecurrings(userId);
  const now = new Date();

  const [txns, budgets, goals, recurrings, accounts, recent] = await Promise.all([
    loadAnalyticsTxns(userId),
    getUserBudgets(userId),
    getUserGoals(userId),
    getUserRecurrings(userId),
    getUserAccounts(userId),
    queryTransactions(userId, { limit: 8, sort: "recent" }),
  ]);

  const monthStart = startOfMonth(now);
  const monthRange = { from: monthStart, to: now };
  const prevRange = { from: startOfMonth(addMonths(now, -1)), to: endOfMonth(addMonths(now, -1)) };
  const last30 = { from: new Date(now.getTime() - 29 * 86400000), to: now };
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const monthExpense = expensesIn(txns, monthRange);
  const monthIncome = incomeIn(txns, monthRange);
  const { slices: categories, total: categoryTotal } = categoryBreakdown(txns, monthRange, prevRange, 8);
  const budgetStatus = budgetStatuses(txns, budgets, now);

  const insights = buildInsights({
    txns,
    now,
    monthExpense,
    monthIncome,
    prevMonthExpense: now.getDate() >= 5 ? sameDayLastMonth(txns, now) : 0,
    projection: monthProjection(txns, now),
    categories,
    methods: methodSplit(txns, monthRange),
    budgets: budgetStatus,
    goals: goals.map((g) => ({
      id: g.id,
      name: g.name,
      emoji: g.emoji,
      targetAmount: g.targetAmount,
      savedAmount: g.savedAmount,
      deadline: g.deadline,
    })),
    monthlyIncomeSetting: monthlyIncome,
  });

  return {
    now: now.toISOString(),
    month: {
      expense: monthExpense,
      income: monthIncome,
      net: monthIncome - monthExpense,
      projection: monthProjection(txns, now),
      prevExpense: expensesIn(txns, prevRange),
      // Comparing day-1 spending to day-1 of last month is noise, not signal.
      prevSameDay: now.getDate() >= 5 ? sameDayLastMonth(txns, now) : 0,
      daysLeft: Math.max(0, Math.round((endOfMonth(now).getTime() - now.getTime()) / 86400000)),
      dayOfMonth: now.getDate(),
      daysInMonth: endOfMonth(now).getDate(),
      txnCount: filterRange(txns, monthRange).length,
    },
    today: {
      expense: expensesIn(txns, { from: todayStart, to: now }),
      count: filterRange(txns, { from: todayStart, to: now }).length,
    },
    last30: {
      expense: expensesIn(txns, last30),
      income: incomeIn(txns, last30),
      avgDaily: Math.round(expensesIn(txns, last30) / 30),
    },
    daily: dailySeries(txns, 30, now).map((d) => ({
      label: d.label,
      value: d.expense,
      secondary: d.income,
    })),
    monthly: monthlySeries(txns, 6, now),
    categories,
    categoryTotal,
    methods: methodSplit(txns, monthRange),
    merchants: topMerchants(txns, monthRange, 5).map((m) => ({ ...m, lastAt: m.lastAt.toISOString() })),
    weekdayVsWeekend: weekdayVsWeekend(txns, monthRange),
    streak: loggingStreak(txns, now),
    budgets: budgetStatus,
    goals: goals.map(serializeGoal),
    accounts: accounts.map(serializeAccount),
    recurring: recurrings.slice(0, 5).map(serializeRecurring),
    recent: recent.rows.map(serializeTxn),
    insights,
    totals: { transactions: txns.length },
    userName,
  };
}

export { getUserCategories };

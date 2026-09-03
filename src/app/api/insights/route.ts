import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { getUserBudgets, getUserGoals, loadAnalyticsTxns, applyDueRecurrings } from "@/lib/queries";
import {
  budgetStatuses,
  categoryBreakdown,
  expensesIn,
  incomeIn,
  methodSplit,
  monthProjection,
  sameDayLastMonth,
  calculateFinancialHealthScore,
  evaluateBadges,
  loggingStreak,
} from "@/lib/analytics";
import { buildInsights } from "@/lib/ai/insights";
import { serverError } from "@/lib/api";
import { endOfMonth, startOfMonth, addMonths } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    await applyDueRecurrings(user.id);
    const now = new Date();

    const [txns, budgets, goals] = await Promise.all([
      loadAnalyticsTxns(user.id),
      getUserBudgets(user.id),
      getUserGoals(user.id),
    ]);

    const monthRange = { from: startOfMonth(now), to: now };
    const prevRange = { from: startOfMonth(addMonths(now, -1)), to: endOfMonth(addMonths(now, -1)) };
    const { slices } = categoryBreakdown(txns, monthRange, prevRange, 10);
    const budgetStatus = budgetStatuses(txns, budgets, now);
    const monthExpense = expensesIn(txns, monthRange);
    const monthIncome = incomeIn(txns, monthRange);

    const insights = buildInsights({
      txns,
      now,
      monthExpense,
      monthIncome,
      prevMonthExpense: expensesIn(txns, prevRange),
      projection: monthProjection(txns, now),
      categories: slices,
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
      monthlyIncomeSetting: user.monthlyIncome,
    });

    const financialHealth = calculateFinancialHealthScore({
      txns,
      budgets: budgetStatus,
      monthlyIncome: user.monthlyIncome,
      monthExpense,
      monthIncome,
      now,
    });

    const badges = evaluateBadges({
      txns,
      goals,
      streak: loggingStreak(txns, now),
    });

    return NextResponse.json({
      insights,
      monthExpense,
      prevSameDay: now.getDate() >= 5 ? sameDayLastMonth(txns, now) : 0,
      projection: monthProjection(txns, now),
      financialHealth,
      badges,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError("GET /api/insights", error);
  }
}

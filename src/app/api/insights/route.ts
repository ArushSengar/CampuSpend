import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { getUserBudgets, getUserGoals, loadAnalyticsTxns, applyDueRecurrings } from "@/lib/queries";
import { budgetStatuses, categoryBreakdown, expensesIn, incomeIn, methodSplit, monthProjection, sameDayLastMonth } from "@/lib/analytics";
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

    const insights = buildInsights({
      txns,
      now,
      monthExpense: expensesIn(txns, monthRange),
      monthIncome: incomeIn(txns, monthRange),
      prevMonthExpense: expensesIn(txns, prevRange),
      projection: monthProjection(txns, now),
      categories: slices,
      methods: methodSplit(txns, monthRange),
      budgets: budgetStatuses(txns, budgets, now),
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

    return NextResponse.json({
      insights,
      monthExpense: expensesIn(txns, monthRange),
      prevSameDay: sameDayLastMonth(txns, now),
      projection: monthProjection(txns, now),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError("GET /api/insights", error);
  }
}

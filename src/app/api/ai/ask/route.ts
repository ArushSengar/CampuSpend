import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { requireUser } from "@/lib/session";
import {
  getUserAccounts,
  getUserBudgets,
  getUserCategories,
  getUserGoals,
  loadAnalyticsTxns,
} from "@/lib/queries";
import { askInput } from "@/lib/validate";
import { answerQuestion } from "@/lib/ai/ask";
import { llmAnswer, llmEnabled } from "@/lib/ai/llm";
import {
  budgetStatuses,
  calculateFinancialHealthScore,
  expensesIn,
  incomeIn,
} from "@/lib/analytics";
import { startOfMonth } from "@/lib/dates";
import { toRupees } from "@/lib/money";
import { serverError, zodError } from "@/lib/api";
import { ZodError } from "zod";

export const runtime = "nodejs";

/** Natural-language Q&A over the user's own data. */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { question } = askInput.parse(await request.json());

    const now = new Date();
    const [txns, categories, budgets, goals, accounts, splitRows] = await Promise.all([
      loadAnalyticsTxns(user.id),
      getUserCategories(user.id),
      getUserBudgets(user.id),
      getUserGoals(user.id),
      getUserAccounts(user.id),
      db.query.transactions.findMany({
        where: and(
          eq(transactions.userId, user.id),
          sql`(${transactions.splits} IS NOT NULL OR ${transactions.source} = 'SETTLEMENT')`,
        ),
      }),
    ]);

    // Calculate roommate splits / debts summary
    const friendMap = new Map<string, { name: string; netBalance: number }>();
    for (const row of splitRows) {
      if (row.source === "SETTLEMENT") {
        const friendMatch = row.note?.match(/Settlement (?:from|to) (.+)/i);
        const name = (friendMatch ? friendMatch[1] : (row.merchant ?? "Friend")).trim();
        const amt = toRupees(row.amount);
        const entry = friendMap.get(name.toLowerCase()) ?? { name, netBalance: 0 };
        if (row.type === "INCOME") entry.netBalance -= amt;
        else entry.netBalance += amt;
        friendMap.set(name.toLowerCase(), entry);
      } else if (row.splits) {
        try {
          const splits = JSON.parse(row.splits);
          if (Array.isArray(splits)) {
            for (const s of splits) {
              const name = String(s.name || "").trim();
              const amt = Number(s.amount || 0);
              if (name && amt > 0) {
                const entry = friendMap.get(name.toLowerCase()) ?? { name, netBalance: 0 };
                entry.netBalance += amt;
                friendMap.set(name.toLowerCase(), entry);
              }
            }
          }
        } catch {}
      }
    }

    const friends = Array.from(friendMap.values()).filter((f) => Math.abs(f.netBalance) > 0);
    const totalOwedToYou = friends
      .filter((f) => f.netBalance > 0)
      .reduce((a, f) => a + f.netBalance, 0);
    const totalYouOwe = friends
      .filter((f) => f.netBalance < 0)
      .reduce((a, f) => a + Math.abs(f.netBalance), 0);
    const splitsSummary = {
      totalOwedToYou,
      totalYouOwe,
      netBalance: totalOwedToYou - totalYouOwe,
      friends,
    };

    const monthRange = { from: startOfMonth(now), to: now };
    const monthExpense = expensesIn(txns, monthRange);
    const monthIncome = incomeIn(txns, monthRange);
    const budgetStatus = budgetStatuses(txns, budgets, now);

    const financialHealth = calculateFinancialHealthScore({
      txns,
      budgets: budgetStatus,
      monthlyIncome: user.monthlyIncome,
      monthExpense,
      monthIncome,
      now,
    });

    const context = {
      txns,
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        emoji: c.emoji,
        color: c.color,
        kind: c.kind,
      })),
      budgets: budgets.map((b) => ({
        id: b.id,
        limit: b.limit,
        categoryId: b.categoryId,
        category: b.category
          ? {
              id: b.category.id,
              name: b.category.name,
              slug: b.category.slug,
              emoji: b.category.emoji,
              color: b.category.color,
              kind: b.category.kind,
            }
          : null,
      })),
      goals: goals.map((g) => ({
        name: g.name,
        emoji: g.emoji,
        targetAmount: g.targetAmount,
        savedAmount: g.savedAmount,
        deadline: g.deadline,
      })),
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        balance: toRupees(a.balance),
      })),
      splitsSummary,
      financialHealth: {
        score: financialHealth.score,
        grade: financialHealth.grade,
        title: financialHealth.title,
        summary: financialHealth.summary,
        topTips: financialHealth.topTips,
      },
      monthlyIncome: user.monthlyIncome,
      now,
      userName: user.name,
    };

    // If an LLM is enabled (GEMINI_API_KEY or OPENAI_API_KEY), run optional synthesis pass
    if (llmEnabled()) {
      const summaryText = `User: ${user.name}
Monthly Income Setting: ₹${user.monthlyIncome ? toRupees(user.monthlyIncome) : "Not set"}
This Month Spent: ₹${toRupees(monthExpense)}
This Month Income Received: ₹${toRupees(monthIncome)}
Financial Health: ${financialHealth.score}/100 (Grade ${financialHealth.grade})
Accounts: ${accounts.map((a) => `${a.name}: ₹${toRupees(a.balance)} (${a.type})`).join(", ")}
Roommate Debts: ${
        friends.length
          ? friends
              .map((f) =>
                f.netBalance > 0
                  ? `${f.name} owes ₹${f.netBalance}`
                  : `user owes ${f.name} ₹${Math.abs(f.netBalance)}`,
              )
              .join(", ")
          : "None"
      }
Goals: ${goals.map((g) => `${g.name}: ₹${toRupees(g.savedAmount)}/₹${toRupees(g.targetAmount)}`).join(", ")}`;

      const llmResult = await llmAnswer(question, summaryText);
      if (llmResult) return NextResponse.json(llmResult);
    }

    // Default fast offline deterministic rule engine
    const result = answerQuestion(question, context);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) return zodError(error);
    if (error instanceof Response) return error;
    return serverError("POST /api/ai/ask", error);
  }
}

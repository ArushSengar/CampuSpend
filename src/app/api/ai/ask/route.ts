import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { getUserBudgets, getUserCategories, getUserGoals, loadAnalyticsTxns } from "@/lib/queries";
import { askInput } from "@/lib/validate";
import { answerQuestion } from "@/lib/ai/ask";
import { serverError, zodError } from "@/lib/api";
import { ZodError } from "zod";

export const runtime = "nodejs";

/** Natural-language Q&A over the user's own data. */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { question } = askInput.parse(await request.json());

    const [txns, categories, budgets, goals] = await Promise.all([
      loadAnalyticsTxns(user.id),
      getUserCategories(user.id),
      getUserBudgets(user.id),
      getUserGoals(user.id),
    ]);

    const result = answerQuestion(question, {
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
          ? { id: b.category.id, name: b.category.name, slug: b.category.slug, emoji: b.category.emoji, color: b.category.color, kind: b.category.kind }
          : null,
      })),
      goals: goals.map((g) => ({
        name: g.name,
        emoji: g.emoji,
        targetAmount: g.targetAmount,
        savedAmount: g.savedAmount,
        deadline: g.deadline,
      })),
      monthlyIncome: user.monthlyIncome,
      now: new Date(),
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) return zodError(error);
    if (error instanceof Response) return error;
    return serverError("POST /api/ai/ask", error);
  }
}

import { NextResponse } from "next/server";
import { db } from "@/db";
import { budgets } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { getUserBudgets, loadAnalyticsTxns } from "@/lib/queries";
import { budgetInput } from "@/lib/validate";
import { serializeBudget } from "@/lib/serialize";
import { budgetStatuses } from "@/lib/analytics";
import { serverError, zodError } from "@/lib/api";
import { toPaise } from "@/lib/money";
import { ZodError } from "zod";

export async function GET() {
  try {
    const user = await requireUser();
    const [rows, txns] = await Promise.all([getUserBudgets(user.id), loadAnalyticsTxns(user.id)]);
    return NextResponse.json({
      budgets: rows.map(serializeBudget),
      status: budgetStatuses(txns, rows, new Date()),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError("GET /api/budgets", error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = budgetInput.parse(await request.json());

    const [row] = await db
      .insert(budgets)
      .values({
        id: `bud_${crypto.randomUUID().slice(0, 20)}`,
        userId: user.id,
        categoryId: body.categoryId ?? null,
        limit: toPaise(body.limit),
        period: body.period,
        rollover: body.rollover,
      })
      .returning();

    return NextResponse.json({ budget: serializeBudget(row) }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return zodError(error);
    if (error instanceof Response) return error;
    return serverError("POST /api/budgets", error);
  }
}

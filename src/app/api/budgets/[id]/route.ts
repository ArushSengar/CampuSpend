import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { budgets } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { budgetUpdate } from "@/lib/validate";
import { serializeBudget } from "@/lib/serialize";
import { fail, serverError, zodError } from "@/lib/api";
import { toPaise } from "@/lib/money";
import { ZodError } from "zod";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = budgetUpdate.parse(await request.json());

    const existing = await db.query.budgets.findFirst({
      where: and(eq(budgets.id, id), eq(budgets.userId, user.id)),
    });
    if (!existing) return fail("Budget not found", 404);

    const [row] = await db
      .update(budgets)
      .set({
        ...(body.limit != null ? { limit: toPaise(body.limit) } : {}),
        ...(body.period != null ? { period: body.period } : {}),
        ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
        ...(body.rollover != null ? { rollover: body.rollover } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(budgets.id, id), eq(budgets.userId, user.id)))
      .returning();

    return NextResponse.json({ budget: serializeBudget(row) });
  } catch (error) {
    if (error instanceof ZodError) return zodError(error);
    if (error instanceof Response) return error;
    return serverError("PATCH /api/budgets/[id]", error);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const existing = await db.query.budgets.findFirst({
      where: and(eq(budgets.id, id), eq(budgets.userId, user.id)),
    });
    if (!existing) return fail("Budget not found", 404);

    await db.delete(budgets).where(and(eq(budgets.id, id), eq(budgets.userId, user.id)));
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError("DELETE /api/budgets/[id]", error);
  }
}

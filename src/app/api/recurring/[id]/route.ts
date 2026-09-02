import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { recurrings } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { recurringUpdate } from "@/lib/validate";
import { serializeRecurring } from "@/lib/serialize";
import { fail, serverError, zodError } from "@/lib/api";
import { toPaise } from "@/lib/money";
import { ZodError } from "zod";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = recurringUpdate.parse(await request.json());

    const existing = await db.query.recurrings.findFirst({
      where: and(eq(recurrings.id, id), eq(recurrings.userId, user.id)),
    });
    if (!existing) return fail("Rule not found", 404);

    const [row] = await db
      .update(recurrings)
      .set({
        ...(body.title != null ? { title: body.title } : {}),
        ...(body.amount != null ? { amount: toPaise(body.amount) } : {}),
        ...(body.type != null ? { type: body.type } : {}),
        ...(body.method != null ? { method: body.method } : {}),
        ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
        ...(body.accountId !== undefined ? { accountId: body.accountId } : {}),
        ...(body.merchant !== undefined ? { merchant: body.merchant } : {}),
        ...(body.frequency != null ? { frequency: body.frequency } : {}),
        ...(body.interval != null ? { interval: body.interval } : {}),
        ...(body.nextRun != null ? { nextRun: body.nextRun } : {}),
        ...(body.active != null ? { active: body.active } : {}),
      })
      .where(and(eq(recurrings.id, id), eq(recurrings.userId, user.id)))
      .returning();

    return NextResponse.json({ recurring: serializeRecurring(row) });
  } catch (error) {
    if (error instanceof ZodError) return zodError(error);
    if (error instanceof Response) return error;
    return serverError("PATCH /api/recurring/[id]", error);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const existing = await db.query.recurrings.findFirst({
      where: and(eq(recurrings.id, id), eq(recurrings.userId, user.id)),
    });
    if (!existing) return fail("Rule not found", 404);

    await db.delete(recurrings).where(and(eq(recurrings.id, id), eq(recurrings.userId, user.id)));
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError("DELETE /api/recurring/[id]", error);
  }
}

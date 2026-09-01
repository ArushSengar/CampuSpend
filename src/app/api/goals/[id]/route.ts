import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { goals } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { goalUpdate, contributeInput } from "@/lib/validate";
import { serializeGoal } from "@/lib/serialize";
import { fail, serverError, zodError } from "@/lib/api";
import { toPaise } from "@/lib/money";
import { ZodError } from "zod";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = goalUpdate.parse(await request.json());

    const existing = await db.query.goals.findFirst({
      where: and(eq(goals.id, id), eq(goals.userId, user.id)),
    });
    if (!existing) return fail("Goal not found", 404);

    const [row] = await db
      .update(goals)
      .set({
        ...(body.name != null ? { name: body.name } : {}),
        ...(body.emoji != null ? { emoji: body.emoji } : {}),
        ...(body.color != null ? { color: body.color } : {}),
        ...(body.targetAmount != null ? { targetAmount: toPaise(body.targetAmount) } : {}),
        ...(body.savedAmount != null ? { savedAmount: toPaise(body.savedAmount) } : {}),
        ...(body.deadline !== undefined ? { deadline: body.deadline } : {}),
        ...(body.priority != null ? { priority: body.priority } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(goals.id, id), eq(goals.userId, user.id)))
      .returning();

    return NextResponse.json({ goal: serializeGoal(row) });
  } catch (error) {
    if (error instanceof ZodError) return zodError(error);
    if (error instanceof Response) return error;
    return serverError("PATCH /api/goals/[id]", error);
  }
}

/** Add (or withdraw, with a negative amount) progress toward a goal. */
export async function POST(request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = contributeInput.parse(await request.json());

    const existing = await db.query.goals.findFirst({
      where: and(eq(goals.id, id), eq(goals.userId, user.id)),
    });
    if (!existing) return fail("Goal not found", 404);

    const saved = Math.max(0, existing.savedAmount + toPaise(body.amount));
    const [row] = await db
      .update(goals)
      .set({ savedAmount: saved, updatedAt: new Date() })
      .where(and(eq(goals.id, id), eq(goals.userId, user.id)))
      .returning();

    return NextResponse.json({ goal: serializeGoal(row) });
  } catch (error) {
    if (error instanceof ZodError) return zodError(error);
    if (error instanceof Response) return error;
    return serverError("POST /api/goals/[id]", error);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const existing = await db.query.goals.findFirst({
      where: and(eq(goals.id, id), eq(goals.userId, user.id)),
    });
    if (!existing) return fail("Goal not found", 404);

    await db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, user.id)));
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError("DELETE /api/goals/[id]", error);
  }
}

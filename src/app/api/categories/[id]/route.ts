import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { categoryUpdate } from "@/lib/validate";
import { fail, serverError, zodError } from "@/lib/api";
import { ZodError } from "zod";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = categoryUpdate.parse(await request.json());

    const existing = await db.query.categories.findFirst({
      where: and(eq(categories.id, id), eq(categories.userId, user.id)),
    });
    if (!existing) return fail("Category not found", 404);

    const [row] = await db
      .update(categories)
      .set({
        ...(body.name != null ? { name: body.name } : {}),
        ...(body.emoji != null ? { emoji: body.emoji } : {}),
        ...(body.color != null ? { color: body.color } : {}),
        ...(body.kind != null ? { kind: body.kind } : {}),
        ...(body.archived != null ? { archived: body.archived } : {}),
      })
      .where(and(eq(categories.id, id), eq(categories.userId, user.id)))
      .returning();

    return NextResponse.json({ category: row });
  } catch (error) {
    if (error instanceof ZodError) return zodError(error);
    if (error instanceof Response) return error;
    return serverError("PATCH /api/categories/[id]", error);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const existing = await db.query.categories.findFirst({
      where: and(eq(categories.id, id), eq(categories.userId, user.id)),
    });
    if (!existing) return fail("Category not found", 404);

    await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, user.id)));
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError("DELETE /api/categories/[id]", error);
  }
}

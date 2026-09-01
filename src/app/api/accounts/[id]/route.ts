import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { accountUpdate } from "@/lib/validate";
import { serializeAccount } from "@/lib/serialize";
import { fail, serverError, zodError } from "@/lib/api";
import { toPaise } from "@/lib/money";
import { ZodError } from "zod";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = accountUpdate.parse(await request.json());

    const existing = await db.query.accounts.findFirst({
      where: and(eq(accounts.id, id), eq(accounts.userId, user.id)),
    });
    if (!existing) return fail("Account not found", 404);

    if (body.isDefault) {
      await db.update(accounts).set({ isDefault: false }).where(eq(accounts.userId, user.id));
    }

    const [row] = await db
      .update(accounts)
      .set({
        ...(body.name != null ? { name: body.name } : {}),
        ...(body.type != null ? { type: body.type } : {}),
        ...(body.upiId !== undefined ? { upiId: body.upiId } : {}),
        ...(body.balance != null ? { balance: toPaise(body.balance) } : {}),
        ...(body.color != null ? { color: body.color } : {}),
        ...(body.icon != null ? { icon: body.icon } : {}),
        ...(body.isDefault != null ? { isDefault: body.isDefault } : {}),
        ...(body.archived != null ? { archived: body.archived } : {}),
      })
      .where(and(eq(accounts.id, id), eq(accounts.userId, user.id)))
      .returning();

    return NextResponse.json({ account: serializeAccount(row) });
  } catch (error) {
    if (error instanceof ZodError) return zodError(error);
    if (error instanceof Response) return error;
    return serverError("PATCH /api/accounts/[id]", error);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const existing = await db.query.accounts.findFirst({
      where: and(eq(accounts.id, id), eq(accounts.userId, user.id)),
    });
    if (!existing) return fail("Account not found", 404);

    await db.delete(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, user.id)));
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError("DELETE /api/accounts/[id]", error);
  }
}

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, transactions } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { transactionUpdate } from "@/lib/validate";
import { serializeTxn } from "@/lib/serialize";
import { fail, serverError, zodError } from "@/lib/api";
import { toPaise } from "@/lib/money";
import { ZodError } from "zod";

type Ctx = { params: Promise<{ id: string }> };

async function load(userId: string, id: string) {
  return db.query.transactions.findFirst({
    where: and(eq(transactions.id, id), eq(transactions.userId, userId)),
    with: {
      category: { columns: { id: true, name: true, slug: true, emoji: true, color: true } },
      account: { columns: { id: true, name: true, type: true, color: true, icon: true } },
    },
  });
}

/** Reverses the old balance effect, then applies the new one. */
async function reconcileBalance(userId: string, prev: { accountId: string | null; amount: number; type: string }, next: { accountId?: string | null | undefined; amount?: number | undefined; type?: string | undefined }) {
  const prevAccount = prev.accountId;
  const nextAccount = next.accountId === undefined ? prev.accountId : next.accountId;
  const nextAmount = next.amount ?? prev.amount;
  const nextType = next.type ?? prev.type;

  const adjust = async (accountId: string | null, delta: number) => {
    if (!accountId || delta === 0) return;
    const [acc] = await db.select().from(accounts).where(and(eq(accounts.id, accountId), eq(accounts.userId, userId))).limit(1);
    if (!acc) return;
    await db.update(accounts).set({ balance: acc.balance + delta }).where(eq(accounts.id, acc.id));
  };

  if (prevAccount) await adjust(prevAccount, prev.type === "INCOME" ? -prev.amount : prev.amount);
  await adjust(nextAccount, nextType === "INCOME" ? nextAmount : -nextAmount);
}

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const row = await load(user.id, id);
    if (!row) return fail("Transaction not found", 404);
    return NextResponse.json({ transaction: serializeTxn(row) });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError("GET /api/transactions/[id]", error);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = transactionUpdate.parse(await request.json());

    const existing = await db.query.transactions.findFirst({
      where: and(eq(transactions.id, id), eq(transactions.userId, user.id)),
    });
    if (!existing) return fail("Transaction not found", 404);

    await db
      .update(transactions)
      .set({
        ...(body.amount != null ? { amount: toPaise(body.amount) } : {}),
        ...(body.type != null ? { type: body.type } : {}),
        ...(body.method != null ? { method: body.method } : {}),
        ...(body.accountId !== undefined ? { accountId: body.accountId } : {}),
        ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
        ...(body.merchant !== undefined ? { merchant: body.merchant } : {}),
        ...(body.note !== undefined ? { note: body.note } : {}),
        ...(body.occurredAt != null ? { occurredAt: body.occurredAt } : {}),
        ...(body.splits !== undefined ? { splits: body.splits && body.splits.length ? JSON.stringify(body.splits) : null } : {}),
        ...(body.rawText !== undefined ? { rawText: body.rawText } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)));

    const amountChanged = body.amount != null && toPaise(body.amount) !== existing.amount;
    const accountChanged = body.accountId !== undefined && body.accountId !== existing.accountId;
    const typeChanged = body.type != null && body.type !== existing.type;
    if (amountChanged || accountChanged || typeChanged) {
      await reconcileBalance(
        user.id,
        { accountId: existing.accountId, amount: existing.amount, type: existing.type },
        {
          accountId: body.accountId,
          amount: body.amount != null ? toPaise(body.amount) : undefined,
          type: body.type,
        },
      );
    }

    const row = await load(user.id, id);
    return NextResponse.json({ transaction: row ? serializeTxn(row) : null });
  } catch (error) {
    if (error instanceof ZodError) return zodError(error);
    if (error instanceof Response) return error;
    return serverError("PATCH /api/transactions/[id]", error);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const existing = await db.query.transactions.findFirst({
      where: and(eq(transactions.id, id), eq(transactions.userId, user.id)),
    });
    if (!existing) return fail("Transaction not found", 404);

    await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, user.id)));
    // reverse the balance impact
    if (existing.accountId) {
      const [acc] = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, existing.accountId), eq(accounts.userId, user.id)))
        .limit(1);
      if (acc) {
        const delta = existing.type === "INCOME" ? -existing.amount : existing.amount;
        await db.update(accounts).set({ balance: acc.balance + delta }).where(eq(accounts.id, acc.id));
      }
    }
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError("DELETE /api/transactions/[id]", error);
  }
}

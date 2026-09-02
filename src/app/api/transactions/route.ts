import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { accounts, transactions } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { queryTransactions, applyDueRecurrings } from "@/lib/queries";
import { transactionInput } from "@/lib/validate";
import { serializeTxn } from "@/lib/serialize";
import { fail, serverError, zodError } from "@/lib/api";
import { toPaise } from "@/lib/money";
import { ZodError } from "zod";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    await applyDueRecurrings(user.id);

    const sp = new URL(request.url).searchParams;
    const get = (k: string) => sp.get(k);

    const filters = {
      from: get("from") ? new Date(get("from")!) : undefined,
      to: get("to") ? new Date(get("to")!) : undefined,
      type: (get("type") as "EXPENSE" | "INCOME" | null) ?? undefined,
      categoryId: get("category") ?? undefined,
      method: get("method") ?? undefined,
      accountId: get("account") ?? undefined,
      q: get("q") ?? undefined,
      min: get("min") ? toPaise(Number(get("min"))) : undefined,
      max: get("max") ? toPaise(Number(get("max"))) : undefined,
      sort: (get("sort") as "recent" | "oldest" | "largest" | "smallest" | null) ?? "recent",
      limit: Math.min(Number(get("limit") ?? 50), 500),
      offset: Number(get("offset") ?? 0),
    };

    const { rows, total } = await queryTransactions(user.id, filters);
    const totals = rows.reduce(
      (acc, t) => {
        if (t.type === "EXPENSE") acc.expense += t.amount;
        else acc.income += t.amount;
        return acc;
      },
      { expense: 0, income: 0 },
    );

    return NextResponse.json({
      transactions: rows.map(serializeTxn),
      total,
      totals: { expense: totals.expense / 100, income: totals.income / 100 },
      hasMore: (filters.offset ?? 0) + rows.length < total,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError("GET /api/transactions", error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = transactionInput.parse(await request.json());

    const [row] = await db
      .insert(transactions)
      .values({
        id: `txn_${crypto.randomUUID().slice(0, 20)}`,
        userId: user.id,
        amount: toPaise(body.amount),
        type: body.type,
        method: body.method,
        accountId: body.accountId ?? null,
        categoryId: body.categoryId ?? null,
        merchant: body.merchant ?? null,
        note: body.note ?? null,
        occurredAt: body.occurredAt ?? new Date(),
        source: body.source,
        rawText: body.rawText ?? null,
        confidence: body.confidence != null ? Math.round(body.confidence * 100) : null,
        splits: body.splits && body.splits.length ? JSON.stringify(body.splits) : null,
      })
      .returning();

    // keep the wallet balance honest
    if (row.accountId) {
      const delta = row.type === "INCOME" ? row.amount : -row.amount;
      const [acc] = await db.select().from(accounts).where(eq(accounts.id, row.accountId)).limit(1);
      if (acc) {
        await db
          .update(accounts)
          .set({ balance: acc.balance + delta })
          .where(and(eq(accounts.id, acc.id), eq(accounts.userId, user.id)));
      }
    }

    const created = await db.query.transactions.findFirst({
      where: eq(transactions.id, row.id),
      with: {
        category: { columns: { id: true, name: true, slug: true, emoji: true, color: true } },
        account: { columns: { id: true, name: true, type: true, color: true, icon: true } },
      },
    });

    return NextResponse.json({ transaction: created ? serializeTxn(created) : serializeTxn(row) }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return zodError(error);
    if (error instanceof Response) return error;
    return serverError("POST /api/transactions", error);
  }
}

export async function DELETE(request: Request) {
  // bulk delete: /api/transactions?ids=a,b,c
  try {
    const user = await requireUser();
    const ids = new URL(request.url).searchParams.get("ids");
    if (!ids) return fail("Provide ?ids=", 400);
    const list = ids.split(",").filter(Boolean).slice(0, 200);
    if (!list.length) return fail("Provide ?ids=", 400);

    await db.delete(transactions).where(and(eq(transactions.userId, user.id), inArray(transactions.id, list)));
    return NextResponse.json({ deleted: list.length, ids: list });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError("DELETE /api/transactions", error);
  }
}

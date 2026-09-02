import { and, asc, desc, eq, gte, like, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, budgets, categories, goals, recurrings, transactions, type Transaction } from "@/db/schema";
import type { AnalyticsTxn } from "@/lib/analytics";
import { advance } from "@/lib/dates";

export type TxnFilters = {
  from?: Date;
  to?: Date;
  type?: "EXPENSE" | "INCOME";
  categoryId?: string;
  method?: string;
  accountId?: string;
  q?: string;
  min?: number; // paise
  max?: number; // paise
  limit?: number;
  offset?: number;
  sort?: "recent" | "oldest" | "largest" | "smallest";
};

export async function getUserCategories(userId: string, kind?: "EXPENSE" | "INCOME") {
  const rows = await db.query.categories.findMany({
    where: kind ? and(eq(categories.userId, userId), eq(categories.kind, kind)) : eq(categories.userId, userId),
    orderBy: [asc(categories.sortOrder), asc(categories.name)],
  });
  return rows.filter((c) => !c.archived || kind === undefined);
}

export async function getUserAccounts(userId: string) {
  return db.query.accounts.findMany({
    where: eq(accounts.userId, userId),
    orderBy: [desc(accounts.isDefault), asc(accounts.name)],
  });
}

export async function queryTransactions(userId: string, filters: TxnFilters = {}) {
  const conditions = [eq(transactions.userId, userId)];
  if (filters.from) conditions.push(gte(transactions.occurredAt, filters.from));
  if (filters.to) conditions.push(lte(transactions.occurredAt, filters.to));
  if (filters.type) conditions.push(eq(transactions.type, filters.type));
  if (filters.categoryId) conditions.push(eq(transactions.categoryId, filters.categoryId));
  if (filters.method) conditions.push(eq(transactions.method, filters.method));
  if (filters.accountId) conditions.push(eq(transactions.accountId, filters.accountId));
  if (filters.min != null) conditions.push(gte(transactions.amount, filters.min));
  if (filters.max != null) conditions.push(lte(transactions.amount, filters.max));
  if (filters.q) {
    const term = `%${filters.q}%`;
    const search = or(like(transactions.merchant, term), like(transactions.note, term), like(transactions.rawText, term));
    if (search) conditions.push(search);
  }

  const order =
    filters.sort === "oldest"
      ? asc(transactions.occurredAt)
      : filters.sort === "largest"
        ? desc(transactions.amount)
        : filters.sort === "smallest"
          ? asc(transactions.amount)
          : desc(transactions.occurredAt);

  const rows = await db.query.transactions.findMany({
    where: and(...conditions),
    orderBy: [order, desc(transactions.createdAt)],
    limit: filters.limit ?? 500,
    offset: filters.offset ?? 0,
    with: {
      category: { columns: { id: true, name: true, slug: true, emoji: true, color: true, kind: true } },
      account: { columns: { id: true, name: true, type: true, color: true, icon: true } },
    },
  });

  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(transactions)
    .where(and(...conditions));

  return { rows, total: Number(count) };
}

/** Everything for a user, joined — small enough to analyse in memory. */
export async function loadAnalyticsTxns(userId: string): Promise<AnalyticsTxn[]> {
  const rows = await db.query.transactions.findMany({
    where: eq(transactions.userId, userId),
    with: { category: { columns: { id: true, name: true, slug: true, emoji: true, color: true, kind: true } } },
    orderBy: [asc(transactions.occurredAt)],
  });
  return rows.map(toAnalyticsTxn);
}

export function toAnalyticsTxn(t: Transaction & { category?: AnalyticsTxn["category"] | null }): AnalyticsTxn {
  return {
    id: t.id,
    amount: t.amount,
    type: t.type,
    method: t.method,
    occurredAt: t.occurredAt,
    merchant: t.merchant,
    note: t.note,
    accountId: t.accountId,
    categoryId: t.categoryId,
    splits: t.splits,
    confidence: t.confidence,
    source: t.source,
    category: t.category ?? null,
  };
}

export async function getUserBudgets(userId: string) {
  return db.query.budgets.findMany({
    where: eq(budgets.userId, userId),
    with: { category: true },
    orderBy: [desc(budgets.createdAt)],
  });
}

export async function getUserGoals(userId: string) {
  return db.query.goals.findMany({ where: eq(goals.userId, userId), orderBy: [desc(goals.createdAt)] });
}

export async function getUserRecurrings(userId: string) {
  return db.query.recurrings.findMany({
    where: eq(recurrings.userId, userId),
    with: { category: true },
    orderBy: [asc(recurrings.nextRun)],
  });
}

/**
 * Materialises any recurring rule whose `nextRun` has passed (idempotent: each
 * generated row is tagged with the rule id + the exact run date).
 */
export async function applyDueRecurrings(userId: string, now = new Date()) {
  const due = await db.query.recurrings.findMany({
    where: and(eq(recurrings.userId, userId), eq(recurrings.active, true), lte(recurrings.nextRun, now)),
  });
  const created: string[] = [];

  for (const rule of due) {
    let runDate = new Date(rule.nextRun);
    let guard = 0;
    while (runDate <= now && guard < 60) {
      const existing = await db.query.transactions.findFirst({
        where: and(
          eq(transactions.recurringId, rule.id),
          gte(transactions.occurredAt, new Date(runDate.getTime() - 3600000)),
          lte(transactions.occurredAt, new Date(runDate.getTime() + 3600000)),
        ),
        columns: { id: true },
      });
      if (!existing) {
        await db.insert(transactions).values({
          id: `txn_${crypto.randomUUID().slice(0, 20)}`,
          userId,
          amount: rule.amount,
          type: rule.type,
          method: rule.method,
          accountId: rule.accountId,
          categoryId: rule.categoryId,
          merchant: rule.merchant,
          note: rule.title,
          occurredAt: runDate,
          source: "RECURRING",
          recurringId: rule.id,
        });
        created.push(rule.id);
      }
      runDate = advance(runDate, rule.frequency, rule.interval);
      guard += 1;
    }
    await db
      .update(recurrings)
      .set({ nextRun: runDate, lastRun: new Date(runDate.getTime() - 1000) })
      .where(eq(recurrings.id, rule.id));
  }

  return created.length;
}

/** merchant → most-used category, learned from the user's confirmed history. */
export async function learnedCategoryMap(userId: string): Promise<Record<string, string>> {
  const rows = await db
    .select({
      merchant: transactions.merchant,
      slug: categories.slug,
      hits: sql<number>`count(*)`,
    })
    .from(transactions)
    .innerJoin(categories, eq(categories.id, transactions.categoryId))
    .where(and(eq(transactions.userId, userId), sql`${transactions.merchant} is not null`))
    .groupBy(transactions.merchant, categories.slug)
    .orderBy(desc(sql`count(*)`));

  const map: Record<string, string> = {};
  for (const row of rows) {
    if (!row.merchant) continue;
    const key = row.merchant.toLowerCase();
    if (!map[key]) map[key] = row.slug;
  }
  return map;
}

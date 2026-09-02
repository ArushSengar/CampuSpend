import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, budgets, goals, recurrings, transactions } from "@/db/schema";
import { newId } from "@/lib/ids";
import { buildDemoBundle } from "@/lib/demo";
import { DEFAULT_ACCOUNTS } from "@/lib/bootstrap";

export type DemoOptions = { now?: Date; seed?: number; replace?: boolean };

/** Current balances for the demo student's wallets (paise). */
const DEMO_BALANCES: Record<string, number> = {
  GPay: 324000, // ₹3,240
  "Cash in hand": 68000, // ₹680
  "Savings account": 2450000, // ₹24,500
};

/**
 * Loads (or reloads) the demo dataset for a user.
 * `replace: true` wipes their seeded rows first so "Reset demo" is idempotent.
 */
export async function applyDemoBundle(userId: string, opts: DemoOptions = {}) {
  const now = opts.now ?? new Date();
  const bundle = buildDemoBundle(now, opts.seed);

  const userCategories = await db.query.categories.findMany({
    where: (c, { eq }) => eq(c.userId, userId),
  });
  const userAccounts = await db.query.accounts.findMany({
    where: (a, { eq }) => eq(a.userId, userId),
  });

  const categoryBySlug = new Map(userCategories.map((c) => [c.slug, c.id]));
  const accountByKey = new Map(
    userAccounts.map((a) => [a.type === "CASH" ? "cash" : a.type === "BANK" ? "bank" : "upi", a.id]),
  );

  if (opts.replace) {
    await clearUserData(userId);
  }

  const rows = bundle.rows
    .filter((r) => r.occurredAt <= now)
    .map((r) => ({
      id: newId("txn_"),
      userId,
      amount: r.amount,
      type: r.type,
      method: r.method,
      accountId: accountByKey.get(r.accountKey) ?? null,
      categoryId: categoryBySlug.get(r.categorySlug) ?? null,
      merchant: r.merchant,
      note: r.note,
      occurredAt: r.occurredAt,
      source: r.source,
      rawText: r.rawText ?? null,
      confidence: r.confidence != null ? Math.round(r.confidence * 100) : null,
      splits: r.splits ? JSON.stringify(r.splits) : null,
    }));

  /**
   * Wallet balances are a snapshot of "what the demo student has right now" —
   * set them explicitly rather than deriving them, so no wallet lands at ₹0
   * just because five months of spending outweighs its opening balance.
   */
  const net = new Map<string, number>();
  for (const r of rows) {
    if (!r.accountId) continue;
    net.set(r.accountId, (net.get(r.accountId) ?? 0) + (r.type === "INCOME" ? r.amount : -r.amount));
  }
  const opening = new Map(DEFAULT_ACCOUNTS.map((a) => [a.name, a.balance]));
  for (const account of userAccounts) {
    const snapshot = DEMO_BALANCES[account.name];
    const balance = snapshot ?? Math.max(0, (opening.get(account.name) ?? 0) + (net.get(account.id) ?? 0));
    await db.update(accounts).set({ balance }).where(eq(accounts.id, account.id));
  }

  // chunked inserts keep SQLite happy with ~1k rows
  for (let i = 0; i < rows.length; i += 250) {
    await db.insert(transactions).values(rows.slice(i, i + 250));
  }

  await db.insert(budgets).values(
    bundle.budgets.map((b) => ({
      id: newId("bud_"),
      userId,
      categoryId: b.categorySlug ? (categoryBySlug.get(b.categorySlug) ?? null) : null,
      limit: b.limit,
      period: b.period,
    })),
  );

  await db.insert(goals).values(
    bundle.goals.map((g) => ({
      id: newId("gol_"),
      userId,
      name: g.name,
      emoji: g.emoji,
      color: g.color,
      targetAmount: g.targetAmount,
      savedAmount: g.savedAmount,
      deadline: g.deadline,
      priority: g.priority,
    })),
  );

  await db.insert(recurrings).values(
    bundle.recurrings.map((r) => ({
      id: newId("rec_"),
      userId,
      title: r.title,
      amount: r.amount,
      type: r.type,
      method: r.method,
      categoryId: categoryBySlug.get(r.categorySlug) ?? null,
      merchant: r.merchant,
      frequency: r.frequency,
      interval: r.interval,
      nextRun: r.nextRun,
    })),
  );

  return { transactions: rows.length, budgets: bundle.budgets.length, goals: bundle.goals.length };
}

/** Wipes every row belonging to a user, keeping their account + categories. */
export async function clearUserData(userId: string) {
  await db.delete(transactions).where(eq(transactions.userId, userId));
  await db.delete(budgets).where(eq(budgets.userId, userId));
  await db.delete(goals).where(eq(goals.userId, userId));
  await db.delete(recurrings).where(eq(recurrings.userId, userId));
  await db.update(accounts).set({ balance: 0 }).where(eq(accounts.userId, userId));
}

import { toPaise, toRupees } from "@/lib/money";

export type Split = { name: string; amount: number };

export type TxnDTO = {
  id: string;
  amount: number; // rupees
  type: "EXPENSE" | "INCOME";
  method: string;
  accountId: string | null;
  categoryId: string | null;
  merchant: string | null;
  note: string | null;
  occurredAt: string;
  source: string;
  rawText: string | null;
  confidence: number | null; // 0..1
  splits: Split[] | null;
  recurringId: string | null;
  createdAt: string;
  category: { id: string; name: string; slug: string; emoji: string; color: string } | null;
  account: { id: string; name: string; type: string; color: string; icon: string } | null;
};

type Row = {
  id: string;
  amount: number;
  type: string;
  method: string;
  accountId: string | null;
  categoryId: string | null;
  merchant: string | null;
  note: string | null;
  occurredAt: Date;
  source: string;
  rawText: string | null;
  confidence: number | null;
  splits: string | null;
  recurringId: string | null;
  createdAt: Date;
  category?: { id: string; name: string; slug: string; emoji: string; color: string } | null;
  account?: { id: string; name: string; type: string; color: string; icon: string } | null;
};

export function parseSplits(raw: string | null): Split[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.map((s) => ({ name: String(s?.name ?? ""), amount: Number(s?.amount ?? 0) })).filter((s) => s.name);
  } catch {
    return null;
  }
}

export function serializeTxn(row: Row): TxnDTO {
  return {
    id: row.id,
    amount: toRupees(row.amount),
    type: row.type === "INCOME" ? "INCOME" : "EXPENSE",
    method: row.method,
    accountId: row.accountId,
    categoryId: row.categoryId,
    merchant: row.merchant,
    note: row.note,
    occurredAt: row.occurredAt.toISOString(),
    source: row.source,
    rawText: row.rawText,
    confidence: row.confidence != null ? row.confidence / 100 : null,
    splits: parseSplits(row.splits),
    recurringId: row.recurringId,
    createdAt: row.createdAt.toISOString(),
    category: row.category ?? null,
    account: row.account ?? null,
  };
}

export function serializeBudget(b: {
  id: string;
  limit: number;
  period: string;
  rollover: boolean;
  categoryId: string | null;
  category?: { id: string; name: string; slug: string; emoji: string; color: string } | null;
}) {
  return {
    id: b.id,
    limit: toRupees(b.limit),
    period: b.period,
    rollover: b.rollover,
    categoryId: b.categoryId,
    category: b.category ?? null,
  };
}

export function serializeGoal(g: {
  id: string;
  name: string;
  emoji: string;
  color: string;
  targetAmount: number;
  savedAmount: number;
  deadline: Date | null;
  priority: string;
}) {
  return {
    id: g.id,
    name: g.name,
    emoji: g.emoji,
    color: g.color,
    targetAmount: toRupees(g.targetAmount),
    savedAmount: toRupees(g.savedAmount),
    deadline: g.deadline ? g.deadline.toISOString() : null,
    priority: g.priority,
  };
}

export function serializeRecurring(r: {
  id: string;
  title: string;
  amount: number;
  type: string;
  method: string;
  categoryId: string | null;
  accountId: string | null;
  merchant: string | null;
  frequency: string;
  interval: number;
  nextRun: Date;
  lastRun: Date | null;
  active: boolean;
  category?: { id: string; name: string; slug: string; emoji: string; color: string } | null;
}) {
  return {
    id: r.id,
    title: r.title,
    amount: toRupees(r.amount),
    type: r.type,
    method: r.method,
    categoryId: r.categoryId,
    accountId: r.accountId,
    merchant: r.merchant,
    frequency: r.frequency,
    interval: r.interval,
    nextRun: r.nextRun.toISOString(),
    lastRun: r.lastRun ? r.lastRun.toISOString() : null,
    active: r.active,
    category: r.category ?? null,
  };
}

export function serializeAccount(a: {
  id: string;
  name: string;
  type: string;
  upiId: string | null;
  balance: number;
  color: string;
  icon: string;
  isDefault: boolean;
  archived: boolean;
}) {
  return {
    id: a.id,
    name: a.name,
    type: a.type,
    upiId: a.upiId,
    balance: toRupees(a.balance),
    color: a.color,
    icon: a.icon,
    isDefault: a.isDefault,
    archived: a.archived,
  };
}

export { toPaise };

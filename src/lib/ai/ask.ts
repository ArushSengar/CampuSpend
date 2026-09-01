/**
 * The "ask anything" coach. Everything is answered from the user's real rows —
 * no model call, so the numbers are always true.
 */

import { addDays, endOfMonth, formatDay, MONTHS_SHORT, startOfDay, startOfMonth, startOfWeek, subMonths } from "@/lib/dates";
import { formatMoney, safePercent, toRupees } from "@/lib/money";
import {
  expensesIn,
  filterRange,
  incomeIn,
  isExpense,
  topMerchants,
  type AnalyticsCategory,
  type AnalyticsTxn,
  type Range,
} from "@/lib/analytics";

export type AskResult = {
  answer: string;
  bullets?: { label: string; value: string }[];
  followUps: string[];
};

type AskContext = {
  txns: AnalyticsTxn[];
  categories: AnalyticsCategory[];
  budgets: { id: string; limit: number; categoryId: string | null; category: AnalyticsCategory | null }[];
  goals: { name: string; emoji: string; targetAmount: number; savedAmount: number; deadline: Date | null }[];
  monthlyIncome: number;
  now: Date;
};

/* --------------------------------- parsing --------------------------------- */

function resolveRange(question: string, now: Date): { range: Range; label: string } {
  const q = question.toLowerCase();
  if (/today|aaj|tonight/.test(q)) return { range: { from: startOfDay(now), to: now }, label: "today" };
  if (/yesterday|kal/.test(q)) {
    const y = addDays(now, -1);
    return { range: { from: startOfDay(y), to: new Date(startOfDay(y).getTime() + 86399999) }, label: "yesterday" };
  }
  if (/this week|is week|week/.test(q) && !/last week/.test(q))
    return { range: { from: startOfWeek(now), to: now }, label: "this week" };
  if (/last week/.test(q)) {
    const start = addDays(startOfWeek(now), -7);
    return { range: { from: start, to: addDays(start, 6) }, label: "last week" };
  }
  if (/this year|this year|annual/.test(q))
    return { range: { from: new Date(now.getFullYear(), 0, 1), to: now }, label: `in ${now.getFullYear()}` };
  if (/last 7|past 7|7 days/.test(q)) return { range: { from: addDays(now, -6), to: now }, label: "in the last 7 days" };
  if (/last 30|past 30|30 days|this month|month/.test(q) && !/last month|previous month/.test(q))
    return { range: { from: startOfMonth(now), to: now }, label: "this month" };
  if (/last month|previous month|pichle/.test(q)) {
    const m = subMonths(now, 1);
    return { range: { from: startOfMonth(m), to: endOfMonth(m) }, label: "last month" };
  }
  const monthNamed = q.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/);
  if (monthNamed) {
    const idx = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(
      monthNamed[1].slice(0, 3),
    );
    if (idx >= 0) {
      const year = now.getMonth() >= idx ? now.getFullYear() : now.getFullYear() - 1;
      return { range: { from: new Date(year, idx, 1), to: endOfMonth(new Date(year, idx, 1)) }, label: `in ${MONTHS_SHORT[idx]}` };
    }
  }
  return { range: { from: startOfMonth(now), to: now }, label: "this month" };
}

function resolveCategory(question: string, categories: AnalyticsCategory[]): AnalyticsCategory | null {
  const q = question.toLowerCase();
  let best: { cat: AnalyticsCategory; len: number } | null = null;
  for (const cat of categories) {
    const name = cat.name.toLowerCase();
    const words = name.split(/[&/\s]+/).filter((w) => w.length > 2);
    const haystack = [name, cat.slug, ...words];
    for (const token of haystack) {
      if (token.length < 3) continue;
      if (new RegExp(`(^|[^a-z])${token}s?([^a-z]|$)`, "i").test(q)) {
        if (!best || token.length > best.len) best = { cat, len: token.length };
      }
    }
  }
  return best?.cat ?? null;
}

function resolveMerchant(question: string, txns: AnalyticsTxn[]): string | null {
  const q = question.toLowerCase();
  const merchants = new Set<string>();
  for (const t of txns) if (t.merchant) merchants.add(t.merchant);
  let best: string | null = null;
  for (const m of merchants) {
    if (new RegExp(`(^|[^a-z])${m.toLowerCase()}([^a-z]|$)`, "i").test(q)) {
      if (!best || m.length > best.length) best = m;
    }
  }
  return best;
}

/* ---------------------------------- answer --------------------------------- */

export function answerQuestion(question: string, ctx: AskContext): AskResult {
  const q = question.toLowerCase().trim();
  const { txns, now, categories, budgets, goals, monthlyIncome } = ctx;

  if (txns.length === 0) {
    return {
      answer: "You haven't logged anything yet, so there's nothing to analyse. Add a few transactions and ask me again — I'll answer from your real numbers.",
      followUps: ["How do I add an expense?", "What can you tell me?"],
    };
  }

  const { range, label } = resolveRange(q, now);
  const scoped = filterRange(txns, range);
  const cat = resolveCategory(q, categories);
  const merchant = resolveMerchant(q, txns);

  const filtered = scoped.filter((t) => {
    if (cat && t.categoryId !== cat.id) return false;
    if (merchant && t.merchant !== merchant) return false;
    return true;
  });

  const totalSpend = expensesIn(filtered, { from: new Date(2000, 0, 1), to: addDays(now, 1) });
  const totalIncome = incomeIn(filtered, { from: new Date(2000, 0, 1), to: addDays(now, 1) });
  const scopeLabel = [cat ? cat.name : null, merchant ?? null, label].filter(Boolean).join(" ");

  /* --- afford / budget questions --- */
  const afford = q.match(/(?:can i afford|afford|should i buy|budget for).*?(?:₹|rs\.?|inr)?\s*(\d+(?:[.,]\d+)?)\s*(k|l|lakh)?/);
  if (afford) {
    const raw = parseFloat(afford[1].replace(/,/g, ""));
    const amount = Math.round(raw * (afford[2] ? (afford[2].toLowerCase() === "l" ? 100000 : 1000) : 1) * 100);
    const monthIncome = monthlyIncome > 0 ? monthlyIncome : incomeIn(txns, { from: startOfMonth(now), to: now });
    const monthSpend = expensesIn(txns, { from: startOfMonth(now), to: now });
    const buffer = monthIncome - monthSpend;
    const overall = budgets.find((b) => !b.categoryId);
    const monthlyBudgetLeft = overall ? overall.limit - expensesIn(txns, { from: startOfMonth(now), to: now }) : buffer;
    const verdict = amount <= monthlyBudgetLeft * 0.5;
    return {
      answer: `${formatMoney(amount)} is ${verdict ? " comfortable" : " a stretch"} right now. You have ${formatMoney(
        monthlyBudgetLeft,
      )} left ${overall ? "against your monthly budget" : "of unspent money"} this month, and it's ${Math.round(
        safePercent(amount, Math.max(1, monthlyBudgetLeft)),
      )}% of that.`,
      bullets: [
        { label: "Left this month", value: formatMoney(monthlyBudgetLeft) },
        { label: "After this purchase", value: formatMoney(monthlyBudgetLeft - amount) },
        { label: "Avg daily spend", value: formatMoney(Math.round(monthSpend / Math.max(1, now.getDate()))) },
      ],
      followUps: ["Where can I cut back?", `How much did I spend ${label}?`],
    };
  }

  /* --- where can I cut --- */
  if (/cut|save money|reduce|kharcha kam|bachega|save more/.test(q)) {
    const monthRange = { from: startOfMonth(now), to: now };
    const byCat = new Map<string, { amount: number; count: number; name: string; emoji: string }>();
    for (const t of filterRange(txns, monthRange)) {
      if (!isExpense(t) || !t.category) continue;
      const e = byCat.get(t.category.id) ?? { amount: 0, count: 0, name: t.category.name, emoji: t.category.emoji };
      e.amount += t.amount;
      e.count += 1;
      byCat.set(t.category.id, e);
    }
    const ranked = [...byCat.values()].sort((a, b) => b.amount - a.amount).slice(0, 3);
    const total = ranked.reduce((a, c) => a + c.amount, 0);
    const cut15 = Math.round(total * 0.15);
    return {
      answer: `Your three biggest categories ${label} are ${ranked.map((r) => r.name).join(", ")} — together ${formatMoney(
        total,
      )}. Trimming 15% there frees ${formatMoney(cut15)} a month (${formatMoney(cut15 * 12)} a year) without touching the essentials.`,
      bullets: ranked.map((r) => ({ label: `${r.emoji} ${r.name}`, value: `${formatMoney(r.amount)} · ${r.count} txns` })),
      followUps: ["How much did I spend on food this month?", "Am I on track this month?"],
    };
  }

  /* --- top merchants --- */
  if (/top merchant|most spent|where does my money go|biggest expense|kahan|where do i spend/.test(q)) {
    const rows = topMerchants(filtered.length ? filtered : scoped, { from: new Date(2000, 0, 1), to: addDays(now, 1) }, 5);
    if (!rows.length) {
      return { answer: `No spending recorded ${label}.`, followUps: ["How much did I spend this month?"] };
    }
    const total = rows.reduce((a, r) => a + r.amount, 0);
    return {
      answer: `${rows[0].merchant} tops the list ${label} at ${formatMoney(rows[0].amount)} across ${rows[0].count} transactions. Here's your top ${rows.length}:`,
      bullets: rows.map((r) => ({ label: r.merchant, value: `${formatMoney(r.amount)} · ${r.count}×` })),
      followUps: [`How much did I spend on ${rows[0].merchant} last month?`, "Where can I cut back?"],
      ...(total > 0 ? {} : {}),
    };
  }

  /* --- goals --- */
  if (/goal|save for|target|bachat/.test(q) && goals.length) {
    const g = goals[0];
    const left = Math.max(0, g.targetAmount - g.savedAmount);
    return {
      answer: `${g.emoji} ${g.name} is ${Math.round(safePercent(g.savedAmount, g.targetAmount))}% funded — ${formatMoney(
        g.savedAmount,
      )} of ${formatMoney(g.targetAmount)}. ${left > 0 ? `${formatMoney(left)} to go.` : "Target reached 🎉"}`,
      bullets: [
        { label: "Saved", value: formatMoney(g.savedAmount) },
        { label: "Remaining", value: formatMoney(left) },
        ...(g.deadline ? [{ label: "Target date", value: formatDay(g.deadline) }] : []),
      ],
      followUps: ["How much can I save this month?", "Where can I cut back?"],
    };
  }

  /* --- on track --- */
  if (/on track|budget|how am i doing|status|kaisa chal/.test(q)) {
    const monthRange = { from: startOfMonth(now), to: now };
    const spend = expensesIn(txns, monthRange);
    const income = monthlyIncome > 0 ? monthlyIncome : incomeIn(txns, monthRange);
    const daysInMonth = endOfMonth(now).getDate();
    const projected = Math.round((spend / Math.max(1, now.getDate())) * daysInMonth);
    const overall = budgets.find((b) => !b.categoryId);
    const limit = overall?.limit ?? income;
    return {
      answer: limit > 0
        ? `${projected <= limit ? "Yes — you're on track." : "Not quite."} You've spent ${formatMoney(spend)} of roughly ${formatMoney(
            limit,
          )} ${label}. At today's pace you'll land near ${formatMoney(projected)} by ${formatDay(endOfMonth(now))} — ${Math.round(
            safePercent(projected, limit),
          )}% of the limit.`
        : `You've spent ${formatMoney(spend)} ${label}. Set a monthly budget and I can tell you whether that's on track.`,
      bullets: [
        { label: "Spent", value: formatMoney(spend) },
        { label: "Projected", value: formatMoney(projected) },
        { label: "Daily pace", value: formatMoney(Math.round(spend / Math.max(1, now.getDate()))) },
      ],
      followUps: ["Where can I cut back?", "How much did I spend on food this month?"],
    };
  }

  /* --- income --- */
  if (/income|earn|came in|credit|milte|mila|salary|stipend|pocket money/.test(q) && !/spend/.test(q)) {
    return {
      answer: `You recorded ${formatMoney(totalIncome)} of income ${scopeLabel}.`,
      bullets: [
        { label: "Income", value: formatMoney(totalIncome) },
        { label: "Expenses", value: formatMoney(totalSpend) },
        { label: "Net", value: formatMoney(totalIncome - totalSpend) },
      ],
      followUps: ["Am I on track this month?", "How much can I save this month?"],
    };
  }

  /* --- how many / count --- */
  if (/how many|kitne|count/.test(q)) {
    const n = filtered.filter(isExpense).length;
    return {
      answer: `${n} expense${n === 1 ? "" : "s"} recorded ${scopeLabel}${n ? `, totalling ${formatMoney(totalSpend)}` : ""}.`,
      followUps: ["Top merchants this month?", "Where can I cut back?"],
    };
  }

  /* --- default: spend for scope --- */
  if (totalSpend > 0 || totalIncome > 0) {
    const prev = resolveRange("last month", now);
    const prevSpend = expensesIn(
      txns.filter((t) => (cat ? t.categoryId === cat.id : true) && (merchant ? t.merchant === merchant : true)),
      prev.range,
    );
    const delta = prevSpend > 0 ? Math.round(((totalSpend - prevSpend) / prevSpend) * 100) : null;
    const share = safePercent(totalSpend, Math.max(1, expensesIn(txns, range)));
    const hasDelta = delta !== null && Math.abs(delta) >= 1;
    return {
      answer:
        `You spent ${formatMoney(totalSpend)}${cat || merchant ? " on " : " "}${scopeLabel}` +
        (hasDelta ? ` — ${(delta ?? 0) > 0 ? "up" : "down"} ${Math.abs(delta ?? 0)}% vs the previous period.` : ".") +
        (cat || merchant ? ` That's ${Math.round(share)}% of your total spending ${label}.` : ""),
      bullets: [
        { label: "Total", value: formatMoney(totalSpend) },
        { label: "Transactions", value: String(filtered.filter(isExpense).length) },
        ...(hasDelta ? [{ label: "vs previous", value: `${(delta ?? 0) > 0 ? "+" : ""}${delta}%` }] : []),
      ],
      followUps: [
        "Where can I cut back?",
        cat ? "Top merchants for this?" : "How much did I spend on food this month?",
        "Am I on track this month?",
      ],
    };
  }

  return {
    answer: `I couldn't find any spending matching “${question}” ${label}. Try asking about a category (food, transport, chai), a merchant (Zomato, Uber), or a period (this month, last week).`,
    followUps: [
      "How much did I spend this month?",
      "Top merchants this month?",
      "Where can I cut back?",
      "Am I on track this month?",
    ],
  };
}

export const askHelpers = { toRupees };

/**
 * CampuSpend's natural-language expense parser.
 *
 * Runs fully offline (no API key, no network): a layered rule engine tuned for
 * Hinglish / Indian college speech — "aaj chai pe 20 rupaye", "kal zomato 350",
 * "500 ka petrol", "mom sent 5000".
 *
 * Layer order: amount → date → direction → payment method → merchant → category.
 * If `OPENAI_API_KEY` / `GEMINI_API_KEY` is configured, an LLM pass runs first
 * and the rule engine fills any gaps (see ./llm.ts).
 */

import {
  EXPENSE_KEYWORDS,
  INCOME_KEYWORDS,
  KEYWORD_RULES,
  MERCHANT_LEXICON,
  METHOD_KEYWORDS,
  UNCATEGORISED_SLUG,
} from "@/lib/taxonomy";
import { addDays, addMonths, MONTHS_SHORT, startOfDay } from "@/lib/dates";

export type TxType = "EXPENSE" | "INCOME";
export type TxMethod = "UPI" | "CASH" | "CARD" | "BANK";

export type ParsedTransaction = {
  amount: number | null;
  type: TxType;
  method: TxMethod;
  categorySlug: string | null;
  merchant: string | null;
  note: string;
  title: string;
  occurredAt: string;
  confidence: number;
  reasons: string[];
  missing: string[];
  rawText: string;
};

export type ParseContext = {
  now?: Date;
  /** merchant (lowercased) → category slug, learned from the user's own history. */
  learned?: Record<string, string>;
  /** valid slugs for this user — unknown suggestions fall back to "other". */
  categorySlugs?: string[];
  /** account name → account id, so "from hdfc" can pick a wallet. */
  accounts?: { id: string; name: string; type: string }[];
  defaultMethod?: TxMethod;
};

type AmountMatch = { value: number; index: number; length: number; explicit: boolean };

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, wednesday: 3, wed: 3,
  thursday: 4, thu: 4, friday: 5, fri: 5, saturday: 6, sat: 6,
};

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8,
  september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* --------------------------------- amounts ---------------------------------- */

const SUFFIX_MULTIPLIER: Record<string, number> = {
  k: 1000, thousand: 1000, l: 100000, lac: 100000, lakh: 100000, cr: 10000000, crore: 10000000,
};

function findAmounts(text: string): AmountMatch[] {
  const out: AmountMatch[] = [];
  const push = (m: RegExpExecArray, value: number, explicit: boolean) => {
    out.push({ value, index: m.index, length: m[0].length, explicit });
  };

  // ₹120 / rs 120 / rs.120 / inr 120 / ₹ 1.5k
  const symbolRe = /(?:₹|rs\.?|inr|rupees|rupaye|rupee)\s*(\d+(?:[.,]\d{1,2})?)\s*(k|l|lac|lakh|cr|crore|thousand)?/gi;
  for (let m; (m = symbolRe.exec(text)); ) {
    const base = parseFloat(m[1].replace(/,/g, ""));
    push(m, base * (SUFFIX_MULTIPLIER[(m[2] ?? "").toLowerCase()] ?? 1), true);
  }

  // 120 rs / 120 rupees / 120/- / 120 buck / "500 ka"
  const suffixRe = /(\d+(?:[.,]\d{1,2})?)\s*(?:rs\.?|inr|rupees|rupaye|rupee|bucks|₹|\/-)(?!\d)/gi;
  for (let m; (m = suffixRe.exec(text)); ) {
    const base = parseFloat(m[1].replace(/,/g, ""));
    push(m, base, true);
  }

  // 1.2k / 2.5l — only when no explicit match already covers that span
  const compactRe = /(\d+(?:\.\d+)?)\s*(k|l|lac|lakh|cr|crore)\b/gi;
  for (let m; (m = compactRe.exec(text)); ) {
    if (out.some((a) => m.index >= a.index && m.index < a.index + a.length)) continue;
    push(m, parseFloat(m[1]) * SUFFIX_MULTIPLIER[m[2].toLowerCase()], true);
  }

  // bare number as a last resort (skip dates like 12/08 and years)
  const bareRe = /(?<![\d./-])(\d{1,7}(?:\.\d{1,2})?)(?![\d./-])(?!\s*(?:st|nd|rd|th)\b)/g;
  for (let m; (m = bareRe.exec(text)); ) {
    if (out.some((a) => m.index >= a.index && m.index < a.index + a.length)) continue;
    const value = parseFloat(m[1]);
    if (value >= 1900 && value <= 2100) continue; // looks like a year
    push(m, value, false);
  }

  // de-dup overlapping spans, prefer explicit
  return out
    .sort((a, b) => (b.explicit ? 1 : 0) - (a.explicit ? 1 : 0) || a.index - b.index)
    .filter((a, i, arr) => !arr.some((b, j) => j < i && a.index >= b.index && a.index < b.index + b.length))
    .sort((a, b) => a.index - b.index);
}

/* ----------------------------------- dates ---------------------------------- */

type DateResult = { date: Date; label: string; matched: string | null };

function resolveDate(text: string, now: Date): DateResult {
  const t = text.toLowerCase();
  const has = (...words: string[]) => words.some((w) => new RegExp(`(^|\\b)${escapeRe(w)}(\\b|$)`, "i").test(t));

  if (has("today", "aaj", "aj", "tonight", "this morning", "aaj hi")) {
    return { date: now, label: "today", matched: "today" };
  }
  if (has("yesterday", "kal", "last night", "yesterday night")) {
    return { date: addDays(now, -1), label: "yesterday", matched: "yesterday" };
  }
  if (has("parso", "day before yesterday")) {
    return { date: addDays(now, -2), label: "2 days ago", matched: "parso" };
  }

  const ago = t.match(/(\d+)\s*(day|days|week|weeks|month|months)\s*ago/);
  if (ago) {
    const n = parseInt(ago[1], 10);
    const unit = ago[2].startsWith("day") ? "d" : ago[2].startsWith("week") ? "w" : "m";
    const date = unit === "d" ? addDays(now, -n) : unit === "w" ? addDays(now, -7 * n) : addMonths(now, -n);
    return { date, label: `${n} ${ago[2]} ago`, matched: ago[0] };
  }

  if (has("last week")) return { date: addDays(now, -7), label: "last week", matched: "last week" };
  if (has("last month")) return { date: addMonths(now, -1), label: "last month", matched: "last month" };

  // "last monday" / "on friday"
  const wd = t.match(/\b(?:last|on|this)?\s*(sunday|sun|monday|mon|tuesday|tue|wednesday|wed|thursday|thu|friday|fri|saturday|sat)\b/);
  if (wd) {
    const target = WEEKDAYS[wd[1].toLowerCase()];
    const back = (now.getDay() - target + 7) % 7 || 7;
    const date = addDays(now, wd[0].trim().startsWith("this") && back === 7 ? 0 : -back);
    return { date, label: `last ${wd[1]}`, matched: wd[0] };
  }

  // 12 aug / 12th aug / aug 12
  const dmy = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:of\s*)?(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/);
  if (dmy) {
    const month = MONTHS[dmy[2].toLowerCase()];
    const date = new Date(now.getFullYear(), month, parseInt(dmy[1], 10), 12, 0, 0, 0);
    if (date > now) date.setFullYear(date.getFullYear() - 1);
    return { date, label: `${dmy[1]} ${dmy[2]}`, matched: dmy[0] };
  }
  const mdy = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s*(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (mdy) {
    const date = new Date(now.getFullYear(), MONTHS[mdy[1].toLowerCase()], parseInt(mdy[2], 10), 12, 0, 0, 0);
    if (date > now) date.setFullYear(date.getFullYear() - 1);
    return { date, label: `${mdy[2]} ${mdy[1]}`, matched: mdy[0] };
  }

  // "on 5th" / "5th" → that day of the current month
  const ordinal = t.match(/\b(?:on\s+)?(\d{1,2})(?:st|nd|rd|th)\b(?!\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))/);
  if (ordinal) {
    const day = parseInt(ordinal[1], 10);
    if (day >= 1 && day <= 31) {
      const date = new Date(now.getFullYear(), now.getMonth(), day, 12, 0, 0, 0);
      if (date > now) date.setMonth(date.getMonth() - 1);
      return { date, label: `${day} ${MONTHS_SHORT[date.getMonth()]}`, matched: ordinal[0] };
    }
  }

  // 12/08 or 12-08 (day/month)
  const numeric = t.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (numeric) {
    const day = parseInt(numeric[1], 10);
    const month = parseInt(numeric[2], 10) - 1;
    const year = numeric[3] ? (numeric[3].length === 2 ? 2000 + +numeric[3] : +numeric[3]) : now.getFullYear();
    if (day <= 31 && month >= 0 && month <= 11) {
      const date = new Date(year, month, day, 12, 0, 0, 0);
      return { date, label: `${day}/${month + 1}`, matched: numeric[0] };
    }
  }

  return { date: now, label: "today (assumed)", matched: null };
}

/* -------------------------------- direction --------------------------------- */

function resolveDirection(text: string): { type: TxType; keyword: string | null; score: number } {
  const t = text.toLowerCase();
  let income = 0;
  let expense = 0;
  let hit: string | null = null;

  for (const w of INCOME_KEYWORDS) {
    if (t.includes(w)) {
      income += w.includes(" ") ? 2 : 1;
      hit ??= w;
    }
  }
  for (const w of EXPENSE_KEYWORDS) {
    if (t.includes(w)) {
      expense += w.includes(" ") ? 2 : 1;
      hit ??= w;
    }
  }

  // Strong structural signals
  if (/^\s*(got|received|recv|credited|mila|milte)\b/.test(t)) income += 3;
  if (/^\s*(paid|spent|bought|paid for)\b/.test(t)) expense += 3;
  if (/\bfrom (mom|dad|mummy|papa|home|parents)\b/.test(t)) income += 3;
  if (/\b(mom|dad|mummy|papa|parents?|home|ghar)\s+(sent|gave|transferred|bheja|bheje)\b/.test(t)) income += 4;
  if (/\bto (mom|dad)\b/.test(t)) expense += 2;

  if (income === expense) return { type: "EXPENSE", keyword: null, score: 0 };
  return {
    type: income > expense ? "INCOME" : "EXPENSE",
    keyword: income > expense ? hit : hit,
    score: Math.abs(income - expense),
  };
}

/* ---------------------------------- method ---------------------------------- */

function resolveMethod(text: string, fallback: TxMethod): { method: TxMethod; keyword: string | null } {
  const t = text.toLowerCase();
  let best: { method: TxMethod; keyword: string } | null = null;
  for (const [method, words] of Object.entries(METHOD_KEYWORDS)) {
    for (const w of words) {
      if (new RegExp(`(^|\\b)${escapeRe(w)}(\\b|$)`, "i").test(t)) {
        if (!best || w.length > best.keyword.length) best = { method: method as TxMethod, keyword: w };
      }
    }
  }
  return best ? { method: best.method, keyword: best.keyword } : { method: fallback, keyword: null };
}

/* --------------------------------- merchant --------------------------------- */

function titleCase(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
    .slice(0, 40);
}

function matchBrand(text: string): { key: string; slug: string; label?: string } | null {
  const t = text.toLowerCase();
  const keys = Object.keys(MERCHANT_LEXICON).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (new RegExp(`(^|[^a-z])${escapeRe(key)}([^a-z]|$)`, "i").test(t)) {
      return { key, ...MERCHANT_LEXICON[key] };
    }
  }
  return null;
}

function extractMerchant(text: string, type: TxType): { merchant: string | null; source: string | null } {
  const brand = matchBrand(text);
  if (brand) return { merchant: brand.label ?? titleCase(brand.key), source: `matched “${brand.key}”` };

  // "mom sent 5000" / "pocket money from home" → the person is the source
  if (type === "INCOME") {
    const person = text.match(/\b(mom|dad|mummy|papa|mother|father|parents?|home|ghar)\b/i);
    if (person) {
      return { merchant: titleCase(person[1]) === "Parents" ? "Parents" : titleCase(person[1]), source: `“${person[1]}”` };
    }
  }

  const patterns = type === "INCOME" ? [/from\s+([a-z][a-z0-9 &'.]{1,25})/i] : [/at\s+([a-z][a-z0-9 &'.]{1,25})/i, /@\s*([a-z][a-z0-9 &'.]{1,25})/i, /to\s+([a-z][a-z0-9 &'.]{1,25})/i];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const cleaned = m[1].trim().replace(/\b(for|today|yesterday|kal|aaj|rs|rupees)$/i, "").trim();
      if (cleaned.length >= 2) return { merchant: titleCase(cleaned), source: `“${m[0].trim()}”` };
    }
  }
  return { merchant: null, source: null };
}

/* --------------------------------- category --------------------------------- */

function resolveCategory(
  text: string,
  type: TxType,
  ctx: ParseContext,
  merchant: string | null,
): { slug: string; reason: string; learned: boolean } {
  const t = text.toLowerCase();
  const valid = (slug: string | undefined | null) =>
    slug && (!ctx.categorySlugs || ctx.categorySlugs.includes(slug)) ? slug : null;

  // 1. learned from the user's own history
  if (merchant && ctx.learned) {
    const learned = ctx.learned[merchant.toLowerCase()];
    if (valid(learned)) return { slug: learned!, reason: `you usually file “${merchant}” here`, learned: true };
  }

  // 2. brand lexicon
  const brand = matchBrand(text);
  if (brand && valid(brand.slug)) {
    return { slug: brand.slug, reason: `merchant “${brand.label ?? brand.key}”`, learned: false };
  }

  // 3. keyword rules (longest match wins)
  let best: { slug: string; word: string; weight: number } | null = null;
  for (const rule of KEYWORD_RULES) {
    for (const word of rule.words) {
      const re = new RegExp(`(^|[^a-z])${escapeRe(word)}s?([^a-z]|$)`, "i");
      if (re.test(t)) {
        const weight = word.length + (word.includes(" ") ? 3 : 0);
        if (!best || weight > best.weight) best = { slug: rule.slug, word, weight };
      }
    }
  }
  if (best && valid(best.slug)) return { slug: best.slug, reason: `matched “${best.word}”`, learned: false };

  return {
    slug: valid(type === "INCOME" ? "other-income" : UNCATEGORISED_SLUG) ?? UNCATEGORISED_SLUG,
    reason: "no strong signal — guessed the default",
    learned: false,
  };
}

/* ----------------------------------- notes ---------------------------------- */

const STRIP_WORDS = [
  "i", "bought", "buy", "purchased", "purchase", "paid", "pay", "spent", "spend", "got", "received",
  "gave", "for", "of", "the", "a", "an", "to", "from", "at", "by", "with", "on", "in", "today", "yesterday",
  "tomorrow", "aaj", "kal", "parso", "with", "using", "via", "through", "rs", "inr", "rupees", "rupaye",
  "rupee", "bucks", "upi", "cash", "card", "gpay", "phonepe", "paytm", "online", "this", "morning",
  "night", "last", "week", "month", "please", "add", "expense", "income", "spent on", "ka", "ki", "ke",
  "me", "my", "pe", "se", "ko", "aur", "and",
];

function buildNote(text: string, merchant: string | null): string {
  let note = text
    .replace(/[₹]/g, " ")
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:rs\.?|inr|rupees|rupaye|rupee|bucks|k|l|lac|lakh|cr|crore)?\b/gi, " ")
    .replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, " ")
    .replace(/\b\d{1,2}(?:st|nd|rd|th)?\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/gi, " ")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = note
    .split(" ")
    .filter((w) => w && !STRIP_WORDS.includes(w.toLowerCase()))
    .filter((w) => !(merchant && merchant.toLowerCase().includes(w.toLowerCase())));

  note = words.join(" ").trim();
  if (note.length < 2) return "";
  return note.charAt(0).toUpperCase() + note.slice(1).slice(0, 120);
}

/* ---------------------------------- segments -------------------------------- */

/** Splits "chai 20 and auto 50" into ["chai 20", "auto 50"]. */
export function splitUtterance(text: string): string[] {
  const amounts = findAmounts(text);
  if (amounts.length <= 1) return [text.trim()];

  const parts: string[] = [];
  let cursor = 0;
  const SEPARATOR = /[,\n;+]|\band\b|\baur\b|\bthen\b/i;

  for (let i = 1; i < amounts.length; i++) {
    const prev = amounts[i - 1];
    const curr = amounts[i];
    const between = text.slice(prev.index + prev.length, curr.index);
    const sep = between.match(SEPARATOR);
    if (sep) {
      // cut right after the separator so trailing words ("auto") stay with the next item
      const prevEnd = prev.index + prev.length;
      parts.push(text.slice(cursor, prevEnd + sep.index!).trim());
      cursor = prevEnd + sep.index! + sep[0].length;
    } else if (between.trim().length === 0 || between.length > 12) {
      parts.push(text.slice(cursor, prev.index + prev.length).trim());
      cursor = curr.index;
    }
  }
  parts.push(text.slice(cursor).trim());
  const cleaned = parts.map((p) => p.trim()).filter(Boolean);
  return cleaned.length ? cleaned : [text.trim()];
}

/* ----------------------------------- main ----------------------------------- */

export function parseTransaction(rawText: string, ctx: ParseContext = {}): ParsedTransaction {
  const now = ctx.now ?? new Date();
  const text = rawText.trim().replace(/\s+/g, " ");
  const amounts = findAmounts(text);
  const amountMatch = amounts[0] ?? null;

  const date = resolveDate(text, now);
  const direction = resolveDirection(text);
  const method = resolveMethod(text, ctx.defaultMethod ?? "UPI");
  const merchant = extractMerchant(text, direction.type);
  const category = resolveCategory(text, direction.type, ctx, merchant.merchant);

  const note = buildNote(text, merchant.merchant);
  const title = merchant.merchant || note || (direction.type === "INCOME" ? "Income" : "Expense");

  const reasons: string[] = [];
  const missing: string[] = [];
  let confidence = 0.34;

  if (amountMatch) {
    confidence += amountMatch.explicit ? 0.3 : 0.2;
    reasons.push(`Amount ₹${amountMatch.value.toLocaleString("en-IN")}`);
  } else {
    missing.push("amount");
    reasons.push("No amount found — add one before saving");
  }

  if (date.matched) {
    confidence += 0.05;
    reasons.push(`Date: ${date.label}`);
  } else {
    reasons.push(`Date: ${date.label}`);
  }

  if (direction.score > 0) {
    confidence += Math.min(0.14, 0.05 * direction.score);
    reasons.push(`Type: ${direction.type === "INCOME" ? "income" : "expense"} (${direction.keyword})`);
  } else {
    reasons.push(`Type: ${direction.type === "INCOME" ? "income" : "expense"} (default)`);
  }

  if (method.keyword) {
    confidence += 0.06;
    reasons.push(`Method: ${method.method} (${method.keyword})`);
  } else {
    reasons.push(`Method: ${method.method} (your default)`);
  }

  if (merchant.merchant) {
    confidence += 0.08;
    reasons.push(`Merchant: ${merchant.merchant} — ${merchant.source}`);
  }

  if (category.reason.includes("usually") || category.reason.startsWith("merchant") || category.reason.startsWith("matched")) {
    confidence += category.learned ? 0.12 : 0.1;
    reasons.push(`Category: ${category.reason}`);
  } else {
    reasons.push(`Category: ${category.reason}`);
  }

  return {
    amount: amountMatch ? amountMatch.value : null,
    type: direction.type,
    method: method.method,
    categorySlug: category.slug,
    merchant: merchant.merchant,
    note,
    title,
    occurredAt: startOfDay(date.date).getTime() < startOfDay(now).getTime() || !date.matched
      ? withTimeOfDay(date.date, now, date.matched)
      : date.date.toISOString(),
    confidence: Math.min(0.97, Math.round(confidence * 100) / 100),
    reasons,
    missing,
    rawText: text,
  };
}

/** Keeps "today" entries at the current clock time; past dates at noon-ish. */
function withTimeOfDay(date: Date, now: Date, matched: string | null): string {
  if (!matched) {
    const d = new Date(now);
    return d.toISOString();
  }
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

export function parseMany(rawText: string, ctx: ParseContext = {}): ParsedTransaction[] {
  const parts = splitUtterance(rawText);
  return parts.map((part) => parseTransaction(part, ctx));
}

/** Quick sanity check used by the UI to disable the save button. */
export function isParsedValid(parsed: ParsedTransaction): boolean {
  return parsed.amount !== null && parsed.amount > 0;
}

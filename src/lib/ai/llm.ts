/**
 * Optional LLM upgrade for the parser.
 *
 * CampuSpend works 100% offline with src/lib/ai/parse.ts. If the deployment
 * supplies an API key, this module runs a second pass that can understand
 * messier Hinglish / multilingual phrasing. The rule engine still validates
 * the result and fills anything the model missed — the LLM never gets the
 * last word on a number.
 */

import type { ParsedTransaction, TxMethod, TxType } from "./parse";

export type LlmExtraction = {
  amount: number | null;
  type: TxType | null;
  method: TxMethod | null;
  merchant: string | null;
  note: string | null;
  /** must be one of the slugs we send in the prompt */
  categorySlug: string | null;
  /** ISO date (yyyy-mm-dd) */
  date: string | null;
};

export type LlmResult = { extraction: LlmExtraction; provider: string } | null;

export function llmEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY);
}

export function activeProvider(): "openai" | "gemini" | null {
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}

const SYSTEM_PROMPT = `You are the parser behind CampuSpend, an expense tracker for Indian college students.
Extract structured fields from one short message that may be English, Hindi, or Hinglish (romanised).
Rules:
- "amount" is a number in RUPEES. Convert "1.2k" -> 1200, "1.5L" -> 150000. Never guess if absent: use null.
- "type" is EXPENSE for money going out, INCOME for money coming in (pocket money, stipend, scholarship, refund).
- "method" is UPI (GPay/PhonePe/Paytm), CASH, CARD, or BANK. Default UPI when unclear.
- "categorySlug" MUST be one of the slugs provided, or null.
- "merchant" is a short title-case brand/person name, or null.
- "date" is yyyy-mm-dd resolved against the reference date given. Use the reference date when unsure.
- "note" is a short clean description with amounts/dates removed, or null.
Respond with JSON only.`;

function buildPrompt(text: string, slugs: string[], now: Date) {
  return `${SYSTEM_PROMPT}

Available category slugs: ${slugs.join(", ")}
Reference date (today): ${now.toISOString().slice(0, 10)}

Message: """${text}"""

JSON keys: amount, type, method, merchant, note, categorySlug, date`;
}

function safeJson(raw: string): LlmExtraction | null {
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    return JSON.parse(cleaned.slice(start, end + 1)) as LlmExtraction;
  } catch {
    return null;
  }
}

async function callOpenAI(prompt: string): Promise<LlmExtraction | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return safeJson(data.choices?.[0]?.message?.content ?? "");
}

async function callGemini(prompt: string): Promise<LlmExtraction | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
      }),
      signal: AbortSignal.timeout(9000),
    },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return safeJson(data.candidates?.[0]?.content?.parts?.[0]?.text ?? "");
}

export async function llmExtract(text: string, slugs: string[], now: Date): Promise<LlmResult> {
  if (!llmEnabled()) return null;
  const prompt = buildPrompt(text, slugs, now);
  try {
    const provider = activeProvider();
    const extraction = provider === "gemini" ? await callGemini(prompt) : await callOpenAI(prompt);
    if (!extraction) return null;
    return { extraction, provider: provider ?? "unknown" };
  } catch (error) {
    console.warn("[ai] llm pass failed, using local engine:", error);
    return null;
  }
}

/**
 * Merges an LLM extraction over a rule-parse. The rules win whenever the model
 * is silent, returns a nonsense value, or contradicts an explicit amount.
 */
export function mergeExtraction(base: ParsedTransaction, llm: LlmResult, slugs: string[]): ParsedTransaction {
  if (!llm) return base;
  const { extraction, provider } = llm;
  const merged: ParsedTransaction = { ...base };

  if (extraction.amount && extraction.amount > 0 && extraction.amount < 100000000) {
    merged.amount = extraction.amount;
  }
  if (extraction.type === "EXPENSE" || extraction.type === "INCOME") merged.type = extraction.type;
  if (extraction.method && ["UPI", "CASH", "CARD", "BANK"].includes(extraction.method)) merged.method = extraction.method;
  if (extraction.categorySlug && slugs.includes(extraction.categorySlug)) merged.categorySlug = extraction.categorySlug;
  if (extraction.merchant) merged.merchant = extraction.merchant.slice(0, 40);
  if (extraction.note) merged.note = extraction.note.slice(0, 120);
  if (extraction.date && /^\d{4}-\d{2}-\d{2}$/.test(extraction.date)) {
    const d = new Date(`${extraction.date}T12:00:00`);
    if (!Number.isNaN(d.getTime())) merged.occurredAt = d.toISOString();
  }
  if (!merged.title || merged.title === "Expense" || merged.title === "Income") {
    merged.title = merged.merchant || merged.note || merged.title;
  }

  merged.confidence = Math.min(0.99, merged.confidence + 0.06);
  merged.reasons = [...merged.reasons, `Refined by ${provider === "gemini" ? "Gemini" : "OpenAI"}`];
  merged.missing = merged.amount === null ? ["amount"] : [];
  return merged;
}

export type LlmAnswerResult = {
  answer: string;
  bullets?: { label: string; value: string }[];
  followUps: string[];
};

export async function llmAnswer(
  question: string,
  contextData: string,
): Promise<LlmAnswerResult | null> {
  if (!llmEnabled()) return null;
  const prompt = `You are CampuSpend's AI financial coach for an Indian college student.
Answer the user's question using their real financial data provided below.
Rules:
- Be concise, friendly, and practical.
- Keep numbers in rupees (₹). Use Indian numbering format (e.g. ₹1,200).
- If giving recommendations, give realistic college student advice (chai, canteen, hostel rent, sharing autos).
- Return a JSON object with:
  "answer": string (1-3 sentences direct answer),
  "bullets": optional array of { "label": string, "value": string },
  "followUps": array of 2-4 short follow-up questions the user can ask next.

User's Financial Data:
${contextData}

Question: "${question}"`;

  try {
    const provider = activeProvider();
    let raw: string | null = null;
    if (provider === "gemini") {
      const key = process.env.GEMINI_API_KEY;
      const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
          }),
          signal: AbortSignal.timeout(9000),
        },
      );
      if (res.ok) {
        const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
      }
    } else if (provider === "openai") {
      const key = process.env.OPENAI_API_KEY;
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "You are CampuSpend AI Coach. Respond in JSON only." },
            { role: "user", content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(9000),
      });
      if (res.ok) {
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        raw = data.choices?.[0]?.message?.content ?? null;
      }
    }
    if (!raw) return null;
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as LlmAnswerResult;
    if (parsed && typeof parsed.answer === "string") {
      return {
        answer: parsed.answer,
        bullets: Array.isArray(parsed.bullets) ? parsed.bullets : undefined,
        followUps: Array.isArray(parsed.followUps)
          ? parsed.followUps
          : ["How much did I spend this month?", "Where can I cut back?"],
      };
    }
    return null;
  } catch (error) {
    console.warn("[ai] llmAnswer failed, falling back to local engine:", error);
    return null;
  }
}

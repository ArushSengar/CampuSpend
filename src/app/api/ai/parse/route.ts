import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { getUserCategories, learnedCategoryMap } from "@/lib/queries";
import { parseInput } from "@/lib/validate";
import { parseMany, type ParsedTransaction } from "@/lib/ai/parse";
import { llmExtract, mergeExtraction } from "@/lib/ai/llm";
import { serverError, zodError } from "@/lib/api";
import { ZodError } from "zod";

export const runtime = "nodejs";

/**
 * Turns "chai 20 yesterday and auto 50 cash" into ready-to-save transactions.
 * Uses the offline rule engine, optionally refined by an LLM if a key is set.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { text } = parseInput.parse(await request.json());

    const [categories, learned] = await Promise.all([getUserCategories(user.id), learnedCategoryMap(user.id)]);
    const slugs = categories.map((c) => c.slug);
    const slugToId = new Map(categories.map((c) => [c.slug, c.id]));

    const parsed = parseMany(text, { learned, categorySlugs: slugs });

    // Optional LLM refinement (only when a key is configured)
    let enriched: ParsedTransaction[] = parsed;
    if (process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY) {
      enriched = await Promise.all(
        parsed.map(async (p) => mergeExtraction(p, await llmExtract(p.rawText, slugs, new Date()), slugs)),
      );
    }

    const results = enriched.map((p) => ({
      amount: p.amount,
      type: p.type,
      method: p.method,
      categoryId: p.categorySlug ? (slugToId.get(p.categorySlug) ?? null) : null,
      categorySlug: p.categorySlug,
      merchant: p.merchant,
      note: p.note,
      title: p.title,
      occurredAt: p.occurredAt,
      confidence: p.confidence,
      reasons: p.reasons,
      missing: p.missing,
      rawText: p.rawText,
    }));

    return NextResponse.json({
      results,
      engine: process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY ? "llm+rules" : "local-rules",
    });
  } catch (error) {
    if (error instanceof ZodError) return zodError(error);
    if (error instanceof Response) return error;
    return serverError("POST /api/ai/parse", error);
  }
}

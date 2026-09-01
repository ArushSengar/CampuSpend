import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { activeProvider, llmEnabled } from "@/lib/ai/llm";
import { serverError } from "@/lib/api";

/** Reports which parser is live, so Settings can tell the truth. */
export async function GET() {
  try {
    await requireUser();
    const provider = activeProvider();
    return NextResponse.json({
      provider: provider ?? "local",
      llmEnabled: llmEnabled(),
      label: provider === "gemini" ? "Gemini" : provider === "openai" ? "OpenAI" : "Offline rule engine",
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError("GET /api/ai/status", error);
  }
}

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { buildOverview } from "@/lib/overview";
import { serverError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Everything the dashboard needs, in one round trip. */
export async function GET() {
  try {
    const user = await requireUser();
    const overview = await buildOverview(user.id, user.name, user.monthlyIncome);
    return NextResponse.json(overview);
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError("GET /api/overview", error);
  }
}

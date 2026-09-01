import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { applyDemoBundle, clearUserData } from "@/lib/demo-apply";
import { serverError } from "@/lib/api";

/** POST /api/demo { action: "load" | "reset" | "clear" } */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json().catch(() => ({}))) as { action?: string };
    const action = body.action ?? "load";

    if (action === "clear") {
      await clearUserData(user.id);
      return NextResponse.json({ ok: true, action });
    }

    if (action === "reset") await clearUserData(user.id);
    const result = await applyDemoBundle(user.id, { replace: false });

    const [updated] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    return NextResponse.json({ ok: true, action, ...result, monthlyIncome: updated?.monthlyIncome ?? 0 });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError("POST /api/demo", error);
  }
}

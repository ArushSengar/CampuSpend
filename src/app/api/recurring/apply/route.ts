import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { applyDueRecurrings } from "@/lib/queries";
import { serverError } from "@/lib/api";

/** Materialises any recurring rule that has come due. Safe to call repeatedly. */
export async function POST() {
  try {
    const user = await requireUser();
    const created = await applyDueRecurrings(user.id);
    return NextResponse.json({ created });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError("POST /api/recurring/apply", error);
  }
}

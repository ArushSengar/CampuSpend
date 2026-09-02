import { NextResponse } from "next/server";
import { db } from "@/db";
import { recurrings } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { getUserRecurrings } from "@/lib/queries";
import { recurringInput } from "@/lib/validate";
import { serializeRecurring } from "@/lib/serialize";
import { serverError, zodError } from "@/lib/api";
import { toPaise } from "@/lib/money";
import { ZodError } from "zod";

export async function GET() {
  try {
    const user = await requireUser();
    const rows = await getUserRecurrings(user.id);
    return NextResponse.json({ recurrings: rows.map(serializeRecurring) });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError("GET /api/recurring", error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = recurringInput.parse(await request.json());

    const [row] = await db
      .insert(recurrings)
      .values({
        id: `rec_${crypto.randomUUID().slice(0, 20)}`,
        userId: user.id,
        title: body.title,
        amount: toPaise(body.amount),
        type: body.type,
        method: body.method,
        categoryId: body.categoryId ?? null,
        accountId: body.accountId ?? null,
        merchant: body.merchant ?? null,
        frequency: body.frequency,
        interval: body.interval,
        nextRun: body.nextRun,
        active: body.active,
      })
      .returning();

    return NextResponse.json({ recurring: serializeRecurring(row) }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return zodError(error);
    if (error instanceof Response) return error;
    return serverError("POST /api/recurring", error);
  }
}

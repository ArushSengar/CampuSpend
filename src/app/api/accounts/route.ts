import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { accountInput } from "@/lib/validate";
import { serializeAccount } from "@/lib/serialize";
import { serverError, zodError } from "@/lib/api";
import { toPaise } from "@/lib/money";
import { ZodError } from "zod";

export async function GET() {
  try {
    const user = await requireUser();
    const rows = await db.query.accounts.findMany({ where: eq(accounts.userId, user.id) });
    return NextResponse.json({ accounts: rows.map(serializeAccount) });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError("GET /api/accounts", error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = accountInput.parse(await request.json());

    if (body.isDefault) {
      await db.update(accounts).set({ isDefault: false }).where(eq(accounts.userId, user.id));
    }

    const [row] = await db
      .insert(accounts)
      .values({
        id: `acc_${crypto.randomUUID().slice(0, 20)}`,
        userId: user.id,
        name: body.name,
        type: body.type,
        upiId: body.upiId ?? null,
        balance: toPaise(body.balance),
        color: body.color,
        icon: body.icon,
        isDefault: body.isDefault,
      })
      .returning();

    return NextResponse.json({ account: serializeAccount(row) }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return zodError(error);
    if (error instanceof Response) return error;
    return serverError("POST /api/accounts", error);
  }
}

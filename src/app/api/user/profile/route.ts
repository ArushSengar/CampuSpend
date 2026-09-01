import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { publicUser } from "@/lib/user";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { profileUpdate } from "@/lib/validate";
import { serverError, zodError } from "@/lib/api";
import { toPaise } from "@/lib/money";
import { ZodError } from "zod";

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = profileUpdate.parse(await request.json());

    const [row] = await db
      .update(users)
      .set({
        ...(body.name != null ? { name: body.name } : {}),
        ...(body.college !== undefined ? { college: body.college } : {}),
        ...(body.monthlyIncome != null ? { monthlyIncome: toPaise(body.monthlyIncome) } : {}),
        ...(body.avatarHue != null ? { avatarHue: body.avatarHue } : {}),
        ...(body.aiProvider != null ? { aiProvider: body.aiProvider } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning();

    return NextResponse.json({ user: publicUser(row) });
  } catch (error) {
    if (error instanceof ZodError) return zodError(error);
    if (error instanceof Response) return error;
    return serverError("PATCH /api/user/profile", error);
  }
}

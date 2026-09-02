import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { publicUser } from "@/lib/user";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { loginSchema } from "@/lib/validate";
import { fail, serverError, zodError } from "@/lib/api";
import { ZodError } from "zod";

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await request.json());
    const user = await db.query.users.findFirst({ where: eq(users.email, body.email.toLowerCase()) });

    if (!user) return fail("No account found for that email", 404);
    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) return fail("That password doesn't match", 401);

    await createSession(user.id);
    return NextResponse.json({ user: publicUser(user) });
  } catch (error) {
    if (error instanceof ZodError) return zodError(error);
    return serverError("login", error);
  }
}

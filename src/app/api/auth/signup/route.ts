import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { signupSchema } from "@/lib/validate";
import { createUserWithDefaults } from "@/lib/bootstrap";
import { applyDemoBundle } from "@/lib/demo-apply";
import { fail, serverError, zodError } from "@/lib/api";
import { publicUser } from "@/lib/user";
import { ZodError } from "zod";

export async function POST(request: Request) {
  try {
    const body = signupSchema.parse(await request.json());
    const email = body.email.toLowerCase();

    const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) return fail("An account with that email already exists", 409);

    const userId = await createUserWithDefaults({
      name: body.name,
      email,
      passwordHash: await hashPassword(body.password),
      college: body.college ?? null,
    });

    if (body.loadDemo) await applyDemoBundle(userId);
    await createSession(userId);

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return NextResponse.json({ user: publicUser(user) }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return zodError(error);
    return serverError("signup", error);
  }
}


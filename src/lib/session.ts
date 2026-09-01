import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { users, type User } from "@/db/schema";

export const SESSION_COOKIE = "campuspend_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET is missing or too short. Add it to .env");
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * Is this request being served over HTTPS? The dev server has no idea when a
 * TLS-terminating proxy (the Arena preview, ngrok, a load balancer) is in
 * front of it, so the forwarded protocol is the only reliable signal.
 */
async function isSecureRequest(): Promise<boolean> {
  if (process.env.COOKIE_SECURE === "1") return true;
  if (process.env.COOKIE_SECURE === "0") return false;
  try {
    const forwarded = (await headers()).get("x-forwarded-proto");
    if (forwarded) return forwarded.split(",")[0].trim() === "https";
  } catch {
    // called outside a request scope — fall through to the default
  }
  return process.env.NODE_ENV === "production";
}

/**
 * Cookie attributes for the session.
 *
 * Over plain HTTP (localhost) `SameSite=Lax` is correct and needs no Secure
 * flag. Over HTTPS the app may be running inside a cross-site iframe — the
 * Arena preview, an embedded demo — where a Lax cookie is a third-party
 * cookie and gets dropped, so login silently bounces back to /login.
 * `SameSite=None; Secure; Partitioned` (CHIPS) is the combination browsers
 * allow for embedded apps even when third-party cookies are blocked.
 */
async function sessionCookieOptions() {
  const secure = await isSecureRequest();
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? ("none" as const) : ("lax" as const),
    partitioned: secure,
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}

/** Writes the session cookie (server actions / route handlers). */
export async function createSession(userId: string): Promise<void> {
  const token = await signSessionToken(userId);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, await sessionCookieOptions());
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  // Same attributes, or the browser won't match the cookie it has to remove.
  store.set(SESSION_COOKIE, "", { ...(await sessionCookieOptions()), maxAge: 0 });
}

/** Resolves the signed-in user, or null. Safe to call from any server context. */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const userId = await verifySessionToken(token);
    if (!userId) return null;
    await ensureSchema();
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return user ?? null;
  } catch {
    return null;
  }
}

/** For route handlers: throws a Response when unauthenticated. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return user;
}

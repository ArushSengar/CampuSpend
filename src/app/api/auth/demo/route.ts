import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { users } from "@/db/schema";
import { createSession } from "@/lib/session";
import { DEMO_CREDENTIALS } from "@/lib/demo";

/**
 * Signs the visitor into the demo account and sends them on their way.
 *
 * While there is no login screen, this is the front door: the proxy sends
 * anyone without a session here instead of to /login. Delete this route (and
 * point the proxy back at /login) when real auth returns.
 */
export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("next");
  const next = requested && requested.startsWith("/") && !requested.startsWith("//") ? requested : "/dashboard";

  await ensureSchema();
  const [demo] = await db.select().from(users).where(eq(users.email, DEMO_CREDENTIALS.email)).limit(1);

  if (!demo) {
    return NextResponse.json(
      { error: "Demo account is missing. Run `npm run db:seed` to create it." },
      { status: 500 },
    );
  }

  await createSession(demo.id);
  return NextResponse.redirect(new URL(next, request.url));
}

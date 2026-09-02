import { NextResponse } from "next/server";

/**
 * Next 16 proxy (formerly middleware).
 *
 * Currently a deliberate pass-through. The login and signup screens are
 * parked, so guests are resolved to the demo account inside getCurrentUser()
 * rather than being bounced anywhere — a redirect here would spin forever in
 * any browser (or embedded preview) that won't store the session cookie.
 *
 * When the auth screens come back, this is where the gate goes: verify the
 * signed session cookie with verifySessionToken() and redirect guests hitting
 * PROTECTED_PREFIXES to /login?next=<path>. Data access still re-checks with
 * requireUser() inside every route handler either way.
 */
export async function proxy() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)"],
};

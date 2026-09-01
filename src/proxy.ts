import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

const PUBLIC_PAGES = ["/login", "/signup"];
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/transactions",
  "/insights",
  "/budgets",
  "/goals",
  "/recurring",
  "/accounts",
  "/settings",
];

/**
 * Next 16 proxy (formerly middleware). A cheap gate that verifies the signed
 * session cookie so protected pages never render for guests. Data access still
 * re-checks with requireUser() inside every route handler.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const userId = token ? await verifySessionToken(token) : null;

  if (PUBLIC_PAGES.includes(pathname)) {
    return userId ? NextResponse.redirect(new URL("/dashboard", request.url)) : NextResponse.next();
  }

  if (!userId && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)"],
};

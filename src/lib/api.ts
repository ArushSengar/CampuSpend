import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { requireUser } from "@/lib/session";
import type { User } from "@/db/schema";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function zodError(error: ZodError) {
  const first = error.issues[0];
  return fail(first?.message ?? "Invalid input", 422, {
    issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  });
}

export function serverError(label: string, error: unknown) {
  console.error(`[api] ${label}:`, error);
  const message = error instanceof Error ? error.message : "Something went wrong";
  return fail(message, 500);
}

/** Wraps a route handler so thrown `Response`s (401) and Zod errors are handled. */
export function handler<T extends unknown[]>(
  fn: (user: User, ...args: T) => Promise<Response>,
): (...args: T) => Promise<Response> {
  return async (...args: T) => {
    try {
      const user = await requireUser();
      return await fn(user, ...args);
    } catch (error) {
      if (error instanceof Response) return error;
      if (error instanceof ZodError) return zodError(error);
      return serverError("handler", error);
    }
  };
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const raw = await request.json().catch(() => ({}));
  return schema.parse(raw);
}

export function searchParams(request: Request): URLSearchParams {
  return new URL(request.url).searchParams;
}

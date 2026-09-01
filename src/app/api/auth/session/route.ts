import { NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/session";
import { publicUser } from "@/lib/user";

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user: user ? publicUser(user) : null });
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    return NextResponse.json({ user: publicUser(user), body: await request.text() });
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
}

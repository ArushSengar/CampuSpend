import { NextResponse } from "next/server";
import { db } from "@/db";
import { goals } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { goalInput } from "@/lib/validate";
import { serializeGoal } from "@/lib/serialize";
import { serverError, zodError } from "@/lib/api";
import { toPaise } from "@/lib/money";
import { ZodError } from "zod";

export async function GET() {
  try {
    const user = await requireUser();
    const rows = await db.query.goals.findMany({
      where: (g, { eq }) => eq(g.userId, user.id),
      orderBy: (g) => [g.createdAt],
    });
    return NextResponse.json({ goals: rows.map(serializeGoal) });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError("GET /api/goals", error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = goalInput.parse(await request.json());

    const [row] = await db
      .insert(goals)
      .values({
        id: `gol_${crypto.randomUUID().slice(0, 20)}`,
        userId: user.id,
        name: body.name,
        emoji: body.emoji,
        color: body.color,
        targetAmount: toPaise(body.targetAmount),
        savedAmount: toPaise(body.savedAmount),
        deadline: body.deadline ?? null,
        priority: body.priority,
      })
      .returning();

    return NextResponse.json({ goal: serializeGoal(row) }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return zodError(error);
    if (error instanceof Response) return error;
    return serverError("POST /api/goals", error);
  }
}

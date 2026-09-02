import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { categoryInput } from "@/lib/validate";
import { serverError, zodError } from "@/lib/api";
import { slugify } from "@/lib/ids";
import { CATEGORY_COLORS } from "@/lib/taxonomy";
import { ZodError } from "zod";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const kind = new URL(request.url).searchParams.get("kind");
    const rows = await db.query.categories.findMany({
      where: kind ? and(eq(categories.userId, user.id), eq(categories.kind, kind)) : eq(categories.userId, user.id),
      orderBy: (c) => [c.sortOrder, c.name],
    });
    return NextResponse.json({ categories: rows });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError("GET /api/categories", error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = categoryInput.parse(await request.json());

    const existing = await db.query.categories.findMany({ where: eq(categories.userId, user.id) });
    const slugs = existing.map((c) => c.slug);
    let slug = slugify(body.name);
    if (slugs.includes(slug)) {
      let n = 2;
      while (slugs.includes(`${slug}-${n}`)) n++;
      slug = `${slug}-${n}`;
    }

    const [row] = await db
      .insert(categories)
      .values({
        id: `cat_${crypto.randomUUID().slice(0, 20)}`,
        userId: user.id,
        name: body.name,
        slug,
        emoji: body.emoji,
        color: body.color || CATEGORY_COLORS[existing.length % CATEGORY_COLORS.length],
        kind: body.kind,
        sortOrder: existing.length + 1,
      })
      .returning();

    return NextResponse.json({ category: row }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return zodError(error);
    if (error instanceof Response) return error;
    return serverError("POST /api/categories", error);
  }
}

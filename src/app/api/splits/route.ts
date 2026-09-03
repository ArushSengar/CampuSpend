import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, categories, transactions } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { fail, serverError } from "@/lib/api";
import { toPaise, toRupees } from "@/lib/money";
import { serializeTxn, parseSplits } from "@/lib/serialize";
import { z } from "zod";

const settleSchema = z.object({
  friendName: z.string().min(1, "Friend name is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  accountId: z.string().nullable().optional(),
  note: z.string().optional(),
  type: z.enum(["RECEIVE", "PAY"]).default("RECEIVE"),
});

export async function GET() {
  try {
    const user = await requireUser();

    // Query all transactions that have splits or are settlements
    const allRows = await db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, user.id),
        sql`(${transactions.splits} IS NOT NULL OR ${transactions.source} = 'SETTLEMENT')`,
      ),
      orderBy: [desc(transactions.occurredAt)],
      with: {
        category: { columns: { id: true, name: true, slug: true, emoji: true, color: true } },
        account: { columns: { id: true, name: true, type: true, color: true, icon: true } },
      },
    });

    const friendMap = new Map<
      string,
      {
        name: string;
        totalOwed: number; // in rupees
        totalSettled: number; // in rupees
        netBalance: number; // in rupees (>0 they owe user, <0 user owes them)
        txns: {
          id: string;
          occurredAt: string;
          title: string;
          totalAmount: number;
          friendShare: number;
          type: "EXPENSE" | "INCOME" | "SETTLEMENT";
          note: string | null;
        }[];
      }
    >();

    const getFriend = (name: string) => {
      const cleanName = name.trim();
      const key = cleanName.toLowerCase();
      if (!friendMap.has(key)) {
        friendMap.set(key, {
          name: cleanName,
          totalOwed: 0,
          totalSettled: 0,
          netBalance: 0,
          txns: [],
        });
      }
      return friendMap.get(key)!;
    };

    for (const row of allRows) {
      if (row.source === "SETTLEMENT") {
        const friendMatch = row.note?.match(/Settlement (?:from|to) (.+)/i);
        const name = friendMatch ? friendMatch[1] : (row.merchant ?? "Friend");
        const f = getFriend(name);
        const amountRs = toRupees(row.amount);

        if (row.type === "INCOME") {
          f.totalSettled += amountRs;
          f.netBalance -= amountRs;
          f.txns.push({
            id: row.id,
            occurredAt: row.occurredAt.toISOString(),
            title: `Settled payment from ${f.name}`,
            totalAmount: amountRs,
            friendShare: amountRs,
            type: "SETTLEMENT",
            note: row.note,
          });
        } else {
          f.netBalance += amountRs;
          f.txns.push({
            id: row.id,
            occurredAt: row.occurredAt.toISOString(),
            title: `Settled payment to ${f.name}`,
            totalAmount: amountRs,
            friendShare: amountRs,
            type: "SETTLEMENT",
            note: row.note,
          });
        }
        continue;
      }

      const splits = parseSplits(row.splits);
      if (!splits || splits.length === 0) continue;

      const totalAmountRs = toRupees(row.amount);
      const title = row.merchant || row.note || row.category?.name || "Expense";

      for (const s of splits) {
        if (!s.name) continue;
        const f = getFriend(s.name);
        const share = Number(s.amount);

        f.totalOwed += share;
        f.netBalance += share;
        f.txns.push({
          id: row.id,
          occurredAt: row.occurredAt.toISOString(),
          title,
          totalAmount: totalAmountRs,
          friendShare: share,
          type: "EXPENSE",
          note: row.note,
        });
      }
    }

    const friends = Array.from(friendMap.values()).sort(
      (a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance),
    );

    const totalOwedToYou = friends
      .filter((f) => f.netBalance > 0)
      .reduce((sum, f) => sum + f.netBalance, 0);

    const totalYouOwe = friends
      .filter((f) => f.netBalance < 0)
      .reduce((sum, f) => sum + Math.abs(f.netBalance), 0);

    return NextResponse.json({
      summary: {
        totalOwedToYou,
        totalYouOwe,
        netBalance: totalOwedToYou - totalYouOwe,
        activeFriendsCount: friends.filter((f) => Math.abs(f.netBalance) > 0).length,
      },
      friends,
      transactions: allRows.map(serializeTxn),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError("GET /api/splits", error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = settleSchema.parse(await request.json());

    const refundCat = await db.query.categories.findFirst({
      where: and(eq(categories.userId, user.id), eq(categories.slug, "refunds")),
    });

    const isReceive = body.type === "RECEIVE";
    const amountPaise = toPaise(body.amount);

    const [row] = await db
      .insert(transactions)
      .values({
        id: `txn_${crypto.randomUUID().slice(0, 20)}`,
        userId: user.id,
        amount: amountPaise,
        type: isReceive ? "INCOME" : "EXPENSE",
        method: "UPI",
        accountId: body.accountId ?? null,
        categoryId: refundCat?.id ?? null,
        merchant: body.friendName,
        note: body.note || `Settlement ${isReceive ? "from" : "to"} ${body.friendName}`,
        occurredAt: new Date(),
        source: "SETTLEMENT",
        rawText: `Settled ₹${body.amount} with ${body.friendName}`,
        confidence: 100,
        splits: null,
      })
      .returning();

    if (row.accountId) {
      const delta = isReceive ? amountPaise : -amountPaise;
      const [acc] = await db.select().from(accounts).where(eq(accounts.id, row.accountId)).limit(1);
      if (acc) {
        await db
          .update(accounts)
          .set({ balance: acc.balance + delta })
          .where(and(eq(accounts.id, acc.id), eq(accounts.userId, user.id)));
      }
    }

    return NextResponse.json({ success: true, settlementId: row.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(error.issues.map((i) => i.message).join(", "), 400);
    }
    if (error instanceof Response) return error;
    return serverError("POST /api/splits", error);
  }
}

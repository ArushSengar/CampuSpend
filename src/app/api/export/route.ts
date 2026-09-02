import { requireUser } from "@/lib/session";
import { queryTransactions } from "@/lib/queries";
import { toRupees } from "@/lib/money";
import { serverError } from "@/lib/api";

/** GET /api/export?from=&to= → CSV of every transaction. */
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const sp = new URL(request.url).searchParams;
    const { rows } = await queryTransactions(user.id, {
      from: sp.get("from") ? new Date(sp.get("from")!) : undefined,
      to: sp.get("to") ? new Date(sp.get("to")!) : undefined,
      limit: 500,
      offset: 0,
      sort: "recent",
    });

    const header = ["date", "type", "amount_inr", "method", "category", "merchant", "note", "account", "source"];
    const escape = (v: string | null | undefined) => {
      const s = (v ?? "").replace(/"/g, '""');
      return `"${s}"`;
    };

    const lines = rows.map((t) =>
      [
        escape(t.occurredAt.toISOString().slice(0, 10)),
        escape(t.type),
        escape(toRupees(t.amount).toString()),
        escape(t.method),
        escape(t.category?.name ?? ""),
        escape(t.merchant ?? ""),
        escape(t.note ?? ""),
        escape(t.account?.name ?? ""),
        escape(t.source),
      ].join(","),
    );

    const csv = [header.join(","), ...lines].join("\n");
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="campuspend-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError("GET /api/export", error);
  }
}

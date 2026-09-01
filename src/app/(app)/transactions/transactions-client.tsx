"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Download,
  Filter,
  LoaderCircle,
  Plus,
  Receipt,
  Search,
  SearchX,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Segmented, Select } from "@/components/ui/input";
import { Badge, EmptyState, Skeleton } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { AiQuickAdd } from "@/components/ai/quick-add";
import { TransactionFeed } from "@/components/transactions/transaction-feed";
import { TransactionForm, draftFromTxn, type TxnDTO } from "@/components/transactions/transaction-form";
import { useAppData } from "@/components/providers/app-data";
import { useShell } from "@/components/shell/app-shell";
import { api, qs } from "@/lib/client/api";
import { useAsyncData } from "@/lib/client/use-async-data";
import { downloadFile } from "@/lib/client/download";
import { formatMoney } from "@/lib/money";
import { startOfMonth } from "@/lib/dates";
import { cn } from "@/lib/cn";

type RangeKey = "month" | "last30" | "last90" | "all" | "custom";

const RANGES: { value: RangeKey; label: string }[] = [
  { value: "month", label: "This month" },
  { value: "last30", label: "30 days" },
  { value: "last90", label: "90 days" },
  { value: "all", label: "All time" },
];

const SORTS = [
  { value: "recent", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "largest", label: "Largest" },
  { value: "smallest", label: "Smallest" },
];

const EMPTY_PAGE: { transactions: TxnDTO[]; total: number } = { transactions: [], total: 0 };

export function TransactionsClient() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { accounts, expenseCategories } = useAppData();
  const { openTransactionForm } = useShell();

  const [items, setItems] = useState<TxnDTO[]>([]);
  const [total, setTotal] = useState(0);

  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 320);
  const [range, setRange] = useState<RangeKey>("month");
  const [type, setType] = useState<"ALL" | "EXPENSE" | "INCOME">("ALL");
  const [method, setMethod] = useState("ALL");
  const [categoryId, setCategoryId] = useState(params.get("category") ?? "ALL");
  const [accountId, setAccountId] = useState("ALL");
  const [sort, setSort] = useState("recent");
  const [limit, setLimit] = useState(40);
  const [showFilters, setShowFilters] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [deleting, setDeleting] = useState<TxnDTO | null>(null);
  const [editing, setEditing] = useState<TxnDTO | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const filters = useMemo(() => {
    const now = new Date();
    switch (range) {
      case "month":
        return { from: startOfMonth(now).toISOString(), to: undefined };
      case "last30":
        return { from: new Date(now.getTime() - 30 * 86400000).toISOString(), to: undefined };
      case "last90":
        return { from: new Date(now.getTime() - 90 * 86400000).toISOString(), to: undefined };
      default:
        return { from: undefined, to: undefined };
    }
  }, [range]);

  const query = useMemo(
    () =>
      qs({
        ...filters,
        type: type === "ALL" ? undefined : type,
        method: method === "ALL" ? undefined : method,
        category: categoryId === "ALL" ? undefined : categoryId,
        account: accountId === "ALL" ? undefined : accountId,
        q: debouncedQ || undefined,
        sort,
        limit,
      }),
    [filters, type, method, categoryId, accountId, debouncedQ, sort, limit],
  );

  const { data: page, error: fetchError, loading, reload } = useAsyncData<{ transactions: TxnDTO[]; total: number }>(
    `/api/transactions${query}`,
    EMPTY_PAGE,
  );

  // Adopt server data during render (the sanctioned "adjust state on prop
  // change" pattern) so optimistic edits below stay authoritative.
  const [syncedKey, setSyncedKey] = useState<string | null>(null);
  if (!loading && syncedKey !== query && !fetchError) {
    setSyncedKey(query);
    setItems(page.transactions);
    setTotal(page.total);
  }
  const error = fetchError;
  const load = reload;
  const loadingMore = loading && items.length > 0;

  const totals = useMemo(() => {
    let expense = 0;
    let income = 0;
    for (const t of items) {
      if (t.type === "EXPENSE") expense += t.amount;
      else income += t.amount;
    }
    return { expense, income, net: income - expense };
  }, [items]);

  /* ------------------------------ optimistic ops ----------------------------- */

  const removeTxn = async (t: TxnDTO) => {
    const snapshot = items;
    setItems((prev) => prev.filter((x) => x.id !== t.id));
    setPendingIds((p) => new Set(p).add(t.id));
    try {
      await api.del(`/api/transactions/${t.id}`);
      setTotal((n) => Math.max(0, n - 1));
      toast.success("Deleted", t.merchant ?? "Transaction removed");
      router.refresh();
    } catch (e) {
      setItems(snapshot);
      toast.error("Couldn't delete", e instanceof Error ? e.message : undefined);
    } finally {
      setPendingIds((p) => {
        const next = new Set(p);
        next.delete(t.id);
        return next;
      });
    }
  };

  const bulkDelete = async () => {
    const ids = [...selected];
    const snapshot = items;
    setItems((prev) => prev.filter((x) => !ids.includes(x.id)));
    setSelected(new Set());
    setBulkDeleting(true);
    try {
      await api.del(`/api/transactions?ids=${ids.join(",")}`);
      toast.success(`Deleted ${ids.length} transactions`);
      router.refresh();
    } catch (e) {
      setItems(snapshot);
      toast.error("Bulk delete failed", e instanceof Error ? e.message : undefined);
    } finally {
      setBulkDeleting(false);
      setConfirmBulk(false);
    }
  };

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const activeFilters =
    type !== "ALL" || method !== "ALL" || categoryId !== "ALL" || accountId !== "ALL" || debouncedQ.length > 0 || range !== "month";

  return (
    <div className="mx-auto max-w-[84rem] space-y-4">
      <div className="animate-fade-up">
        <AiQuickAdd variant="compact" onSaved={() => void load()} />
      </div>

      {/* -------------------------------- toolbar ------------------------------- */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search merchant, note, category…"
          leftIcon={<Search className="h-4 w-4" />}
          className="h-10 min-w-[12rem] flex-1"
          rightSlot={
            q ? (
              <button onClick={() => setQ("")} className="grid h-6 w-6 place-items-center rounded text-subtle hover:text-fg">
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null
          }
        />
        <Segmented value={range} onChange={setRange} options={RANGES} />
        <Select value={sort} onChange={(e) => setSort(e.target.value)} className="h-10 w-32">
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
        <Button
          variant={showFilters ? "primary" : "secondary"}
          onClick={() => setShowFilters((v) => !v)}
          leftIcon={<Filter className="h-4 w-4" />}
        >
          Filters
          {activeFilters ? (
            <span className="ml-1 rounded-full bg-primary-soft px-1.5 text-[0.65rem] font-bold text-primary">•</span>
          ) : null}
        </Button>
        <Button variant="secondary" size="icon" title="Export CSV" onClick={() => downloadFile(`/api/export${qs(filters)}`)}>
          <Download className="h-4 w-4" />
        </Button>
        <Button onClick={() => openTransactionForm()} leftIcon={<Plus className="h-4 w-4" />}>
          Add
        </Button>
      </div>

      {showFilters ? (
        <Card className="animate-fade-up grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Type</p>
            <Segmented
              value={type}
              onChange={setType}
              options={[
                { value: "ALL", label: "All" },
                { value: "EXPENSE", label: "Expense" },
                { value: "INCOME", label: "Income" },
              ]}
            />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Method</p>
            <Select value={method} onChange={(e) => setMethod(e.target.value)} className="h-9">
              <option value="ALL">All methods</option>
              <option value="UPI">UPI</option>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="BANK">Bank</option>
            </Select>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Category</p>
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="h-9">
              <option value="ALL">All categories</option>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Account</p>
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="h-9">
              <option value="ALL">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
        </Card>
      ) : null}

      {/* -------------------------------- summary ------------------------------- */}
      <div className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <Receipt className="h-4 w-4 text-subtle" />
          <span className="tabular font-semibold text-fg">{total}</span>
          <span className="text-muted">transactions</span>
        </div>
        <span className="h-4 w-px bg-border" />
        <div className="text-sm">
          <span className="text-muted">Out </span>
          <span className="tabular font-semibold text-danger">{formatMoney(totals.expense * 100)}</span>
        </div>
        <div className="text-sm">
          <span className="text-muted">In </span>
          <span className="tabular font-semibold text-success">{formatMoney(totals.income * 100)}</span>
        </div>
        <div className="text-sm">
          <span className="text-muted">Net </span>
          <span className={cn("tabular font-semibold", totals.net >= 0 ? "text-success" : "text-danger")}>
            {formatMoney(Math.abs(totals.net) * 100)}
          </span>
        </div>

        {selected.size > 0 ? (
          <div className="ml-auto flex items-center gap-2">
            <Badge tone="primary">{selected.size} selected</Badge>
            <Button size="xs" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button size="xs" variant="danger" onClick={() => setConfirmBulk(true)} loading={bulkDeleting} leftIcon={<Trash2 className="h-3.5 w-3.5" />}>
              Delete
            </Button>
          </div>
        ) : null}
      </div>

      {/* ---------------------------------- list -------------------------------- */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-9 w-9 rounded-xl" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-2.5 w-28" />
                </div>
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={<SearchX className="h-5 w-5" />}
            title="Couldn't load transactions"
            description={error}
            action={
              <Button size="sm" variant="secondary" onClick={() => void load()}>
                Try again
              </Button>
            }
          />
        ) : (
          <>
            <div className="max-h-[62vh] overflow-y-auto">
              <TransactionFeed
                transactions={items}
                pendingIds={pendingIds}
                selectedIds={selected}
                onToggleSelect={toggleSelect}
                onEdit={(t) => setEditing(t)}
                onDelete={(t) => setDeleting(t)}
                emptyTitle={activeFilters ? "No transactions match these filters" : "No transactions yet"}
                emptyDescription={
                  activeFilters
                    ? "Try widening the date range or clearing the search."
                    : "Log your first spend — or just type “chai 20” into the AI bar."
                }
                emptyAction={
                  <Button size="sm" variant="secondary" onClick={() => openTransactionForm()}>
                    Add a transaction
                  </Button>
                }
              />
            </div>

            {items.length < total ? (
              <div className="border-t border-border p-3 text-center">
                <Button
                  variant="secondary"
                  size="sm"
                  loading={loadingMore}
                  onClick={() => setLimit((l) => l + 40)}
                  leftIcon={loadingMore ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                >
                  Load {Math.min(40, total - items.length)} more
                </Button>
              </div>
            ) : items.length > 0 ? (
              <p className="border-t border-border py-3 text-center text-xs text-subtle">
                That&apos;s everything — {total} transaction{total === 1 ? "" : "s"}.
              </p>
            ) : null}
          </>
        )}
      </Card>

      {/* --------------------------------- dialogs ------------------------------ */}
      <TransactionForm
        open={Boolean(editing)}
        draft={editing ? draftFromTxn(editing) : null}
        onClose={() => setEditing(null)}
        onSaved={(txn) => {
          setItems((prev) => prev.map((x) => (txn && x.id === txn.id ? txn : x)));
          setEditing(null);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          const target = deleting;
          setDeleting(null);
          if (target) await removeTxn(target);
        }}
        title="Delete this transaction?"
        message={`${deleting?.merchant ?? "This entry"} · ${formatMoney((deleting?.amount ?? 0) * 100)} will be removed and the wallet balance restored.`}
      />

      <ConfirmDialog
        open={confirmBulk}
        onClose={() => setConfirmBulk(false)}
        onConfirm={bulkDelete}
        loading={bulkDeleting}
        title={`Delete ${selected.size} transactions?`}
        message="This can't be undone. Balances will be restored automatically."
        confirmLabel={`Delete ${selected.size}`}
      />
    </div>
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebounced(value), delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, delay]);
  return debounced;
}

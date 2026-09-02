"use client";

import { useState } from "react";
import { Banknote, Check, Landmark, Pencil, Repeat, Sparkles, Trash2, Wallet, Receipt } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { formatTime, relativeDayLabel } from "@/lib/dates";
import type { TxnDTO } from "./transaction-form";
import { Skeleton } from "@/components/ui/feedback";
import { EmptyState } from "@/components/ui/feedback";

const METHOD_ICON = {
  UPI: Wallet,
  CASH: Banknote,
  CARD: Landmark,
  BANK: Landmark,
} as const;

const METHOD_LABEL = { UPI: "UPI", CASH: "Cash", CARD: "Card", BANK: "Bank" } as const;

export function TransactionRow({
  txn,
  onEdit,
  onDelete,
  pending,
  compact,
  selected,
  onToggleSelect,
}: {
  txn: TxnDTO;
  onEdit?: (t: TxnDTO) => void;
  onDelete?: (t: TxnDTO) => void;
  pending?: boolean;
  compact?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const MethodIcon = METHOD_ICON[txn.method as keyof typeof METHOD_ICON] ?? Wallet;
  const income = txn.type === "INCOME";

  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 border-b border-border/60 px-4 transition-colors last:border-0 hover:bg-surface-2/70",
        compact ? "py-2.5" : "py-3",
        pending && "opacity-50",
        open && "bg-surface-2",
      )}
    >
      {onToggleSelect ? (
        <button
          onClick={() => onToggleSelect(txn.id)}
          aria-label={selected ? "Deselect" : "Select"}
          className={cn(
            "grid h-5 w-5 shrink-0 place-items-center rounded-md border transition",
            selected ? "border-primary bg-primary text-primary-fg" : "border-border-strong bg-surface hover:border-primary",
          )}
        >
          {selected ? <Check className="h-3 w-3" /> : null}
        </button>
      ) : null}

      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base"
        style={{ background: txn.category ? `${txn.category.color}22` : "var(--surface-3)" }}
      >
        {txn.category?.emoji ?? (income ? "💰" : "🧾")}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium text-fg">
            {txn.merchant || txn.note || txn.category?.name || (income ? "Income" : "Expense")}
          </p>
          {txn.source === "AI" ? (
            <span title={`Logged by AI from “${txn.rawText ?? ""}”`}>
              <Sparkles className="h-3 w-3 text-primary" />
            </span>
          ) : null}
          {txn.recurringId ? <Repeat className="h-3 w-3 text-subtle" /> : null}
          {txn.splits?.length ? (
            <span className="rounded bg-surface-3 px-1 text-[0.6rem] font-medium text-muted">
              split ×{txn.splits.length}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-[0.7rem] text-subtle">
          <span>{txn.category?.name ?? "Uncategorised"}</span>
          <span className="text-border-strong">•</span>
          <MethodIcon className="h-2.5 w-2.5" />
          <span>{METHOD_LABEL[txn.method as keyof typeof METHOD_LABEL] ?? txn.method}</span>
          {txn.account ? (
            <>
              <span className="text-border-strong">•</span>
              <span className="truncate">{txn.account.name}</span>
            </>
          ) : null}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className={cn("tabular text-sm font-semibold", income ? "text-success" : "text-fg")}>
          {income ? "+" : "−"}
          {formatMoney(txn.amount * 100)}
        </p>
        <p className="text-[0.68rem] text-subtle">{formatTime(txn.occurredAt)}</p>
      </div>

      {onEdit || onDelete ? (
        <div className="relative shrink-0">
          <button
            onClick={() => setOpen((v) => !v)}
            className="grid h-7 w-7 place-items-center rounded-lg text-subtle opacity-0 transition hover:bg-surface-3 hover:text-fg focus:opacity-100 group-hover:opacity-100"
            aria-label="Row actions"
          >
            ⋯
          </button>
          {open ? (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-8 z-40 w-32 animate-pop-in overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-pop">
                {onEdit ? (
                  <button
                    onClick={() => {
                      setOpen(false);
                      onEdit(txn);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-fg hover:bg-surface-2"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                ) : null}
                {onDelete ? (
                  <button
                    onClick={() => {
                      setOpen(false);
                      onDelete(txn);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-danger hover:bg-danger-soft"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function TransactionFeed({
  transactions,
  onEdit,
  onDelete,
  pendingIds,
  selectedIds,
  onToggleSelect,
  groupByDay = true,
  emptyTitle = "No transactions yet",
  emptyDescription = "Add one manually or just type “chai 20” in the AI bar.",
  emptyAction,
  compact,
}: {
  transactions: TxnDTO[];
  onEdit?: (t: TxnDTO) => void;
  onDelete?: (t: TxnDTO) => void;
  pendingIds?: Set<string>;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  groupByDay?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  compact?: boolean;
}) {
  if (!transactions.length) {
    return (
      <EmptyState
        icon={<Receipt className="h-5 w-5" />}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  if (!groupByDay) {
    return (
      <div>
        {transactions.map((t) => (
          <TransactionRow
            key={t.id}
            txn={t}
            onEdit={onEdit}
            onDelete={onDelete}
            pending={pendingIds?.has(t.id)}
            compact={compact}
            selected={selectedIds?.has(t.id)}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>
    );
  }

  const groups: { label: string; items: TxnDTO[] }[] = [];
  for (const t of transactions) {
    const label = relativeDayLabel(t.occurredAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(t);
    else groups.push({ label, items: [t] });
  }

  return (
    <div>
      {groups.map((g) => (
        <div key={g.label}>
          <div className="sticky top-0 z-10 flex items-center justify-between border-y border-border bg-surface-2/80 px-4 py-1.5 backdrop-blur">
            <span className="text-[0.68rem] font-semibold uppercase tracking-wider text-subtle">{g.label}</span>
            <span className="tabular text-[0.68rem] text-subtle">
              −{formatMoney(g.items.filter((i) => i.type === "EXPENSE").reduce((a, i) => a + i.amount, 0) * 100)}
            </span>
          </div>
          {g.items.map((t) => (
            <TransactionRow
              key={t.id}
              txn={t}
              onEdit={onEdit}
              onDelete={onDelete}
              pending={pendingIds?.has(t.id)}
              compact={compact}
              selected={selectedIds?.has(t.id)}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function TransactionFeedSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-2.5 w-24" />
          </div>
          <div className="space-y-1.5 text-right">
            <Skeleton className="ml-auto h-3 w-16" />
            <Skeleton className="ml-auto h-2.5 w-10" />
          </div>
        </div>
      ))}
    </div>
  );
}

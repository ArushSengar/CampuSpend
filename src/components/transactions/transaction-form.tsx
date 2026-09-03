"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Landmark, Wallet, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Segmented, Select, Switch } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useAppData } from "@/components/providers/app-data";
import { api } from "@/lib/client/api";
import { toDateInput } from "@/lib/dates";
import { cn } from "@/lib/cn";

export type TxnDTO = {
  id: string;
  amount: number;
  type: "EXPENSE" | "INCOME";
  method: string;
  accountId: string | null;
  categoryId: string | null;
  merchant: string | null;
  note: string | null;
  occurredAt: string;
  source: string;
  rawText: string | null;
  confidence: number | null;
  splits: { name: string; amount: number }[] | null;
  recurringId?: string | null;
  category: { id: string; name: string; slug: string; emoji: string; color: string } | null;
  account: { id: string; name: string; type: string; color: string; icon: string } | null;
};

export type TxnDraft = {
  id?: string;
  amount: string;
  type: "EXPENSE" | "INCOME";
  method: string;
  accountId: string | null;
  categoryId: string | null;
  merchant: string;
  note: string;
  occurredAt: string;
  split: boolean;
  splits: { name: string; amount: string }[];
};

const METHODS = [
  { value: "UPI", label: "UPI", icon: Wallet },
  { value: "CASH", label: "Cash", icon: Banknote },
  { value: "CARD", label: "Card", icon: Landmark },
  { value: "BANK", label: "Bank", icon: Landmark },
];

export function emptyDraft(defaults?: Partial<TxnDraft>): TxnDraft {
  return {
    amount: "",
    type: "EXPENSE",
    method: "UPI",
    accountId: null,
    categoryId: null,
    merchant: "",
    note: "",
    occurredAt: toDateInput(new Date()),
    split: false,
    splits: [],
    ...defaults,
  };
}

export function draftFromTxn(t: TxnDTO): TxnDraft {
  return {
    id: t.id,
    amount: String(t.amount),
    type: t.type,
    method: t.method,
    accountId: t.accountId,
    categoryId: t.categoryId,
    merchant: t.merchant ?? "",
    note: t.note ?? "",
    occurredAt: toDateInput(t.occurredAt),
    split: Boolean(t.splits?.length),
    splits: (t.splits ?? []).map((s) => ({ name: s.name, amount: String(s.amount) })),
  };
}

export function TransactionForm({
  open,
  onClose,
  draft: initialDraft,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  draft?: TxnDraft | null;
  onSaved?: (txn?: TxnDTO) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const { expenseCategories, incomeCategories, accounts, defaultAccountId } = useAppData();

  const [draft, setDraft] = useState<TxnDraft>(() => emptyDraft({ accountId: defaultAccountId }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formKey, setFormKey] = useState<string | null>(null);
  const nextKey = open ? `${initialDraft?.id ?? "new"}:${defaultAccountId ?? ""}` : null;
  if (formKey !== nextKey) {
    setFormKey(nextKey);
    if (open) {
      setDraft(initialDraft ?? emptyDraft({ accountId: defaultAccountId }));
      setError(null);
    }
  }

  const set = <K extends keyof TxnDraft>(key: K, value: TxnDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const categories = draft.type === "INCOME" ? incomeCategories : expenseCategories;
  const amount = Number(draft.amount);

  const submit = async () => {
    if (!amount || amount <= 0) {
      setError("Enter an amount greater than ₹0.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        amount,
        type: draft.type,
        method: draft.method,
        accountId: draft.accountId,
        categoryId: draft.categoryId,
        merchant: draft.merchant.trim() || null,
        note: draft.note.trim() || null,
        occurredAt: new Date(`${draft.occurredAt}T12:00:00`).toISOString(),
        source: "MANUAL" as const,
        splits: draft.split
          ? draft.splits.filter((s) => s.name.trim()).map((s) => ({ name: s.name.trim(), amount: Number(s.amount) || 0 }))
          : null,
      };

      const res = draft.id
        ? await api.patch<{ transaction: TxnDTO }>(`/api/transactions/${draft.id}`, payload)
        : await api.post<{ transaction: TxnDTO }>("/api/transactions", payload);

      toast.success(draft.id ? "Transaction updated" : "Transaction added", `${res.transaction.merchant ?? "Entry"} · ₹${amount.toLocaleString("en-IN")}`);
      onSaved?.(res.transaction);
      onClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={draft.id ? "Edit Entry" : "Log Transaction"}
      description="Record an expense or income entry"
      size="md"
      footer={
        <div className="flex items-center justify-between gap-2">
          <p className="text-[0.68rem] text-subtle">{draft.split ? "Splitting with roommates" : "Solo entry"}</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit} loading={saving}>
              {draft.id ? "Save" : "Add Entry"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {error ? (
          <div className="rounded-2xl border border-danger/40 bg-danger-soft/30 p-2.5 text-xs text-danger font-medium">
            {error}
          </div>
        ) : null}

        <Segmented
          size="sm"
          value={draft.type}
          onChange={(v) => set("type", v)}
          options={[
            { value: "EXPENSE", label: "Expense" },
            { value: "INCOME", label: "Income" },
          ]}
          className="w-full [&>button]:flex-1"
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Amount" required className="sm:col-span-1">
            <Input
              type="number"
              step="0.01"
              min="0"
              autoFocus
              placeholder="0"
              value={draft.amount}
              onChange={(e) => set("amount", e.target.value)}
              leftIcon={<span className="text-xs font-bold text-subtle">₹</span>}
              className="h-10 text-base font-black tabular"
            />
          </Field>
          <Field label="Date" required>
            <Input type="date" value={draft.occurredAt} onChange={(e) => set("occurredAt", e.target.value)} className="h-10 text-xs" />
          </Field>
        </div>

        <Field label="Category">
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-0.5">
            {categories.map((c) => {
              const active = draft.categoryId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => set("categoryId", active ? null : c.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition pressable",
                    active
                      ? "border-primary bg-primary text-white shadow-sm"
                      : "border-border/80 bg-surface-2/60 text-muted hover:text-fg",
                  )}
                >
                  <span>{c.emoji}</span>
                  {c.name}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Method">
            <div className="grid grid-cols-4 gap-1">
              {METHODS.map((m) => {
                const active = draft.method === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => {
                      set("method", m.value);
                      const match = accounts.find((a) => a.type === m.value);
                      if (match) set("accountId", match.id);
                    }}
                    className={cn(
                      "flex items-center justify-center rounded-2xl border py-1.5 text-xs font-bold transition pressable",
                      active
                        ? "border-primary bg-primary-soft text-primary shadow-sm"
                        : "border-border/80 bg-surface-2/60 text-muted hover:text-fg",
                    )}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Wallet / Account">
            <Select
              value={draft.accountId ?? ""}
              onChange={(e) => set("accountId", e.target.value || null)}
              className="h-9.5 text-xs"
            >
              <option value="">Auto Wallet</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Merchant / Payee">
            <Input
              value={draft.merchant}
              onChange={(e) => set("merchant", e.target.value)}
              placeholder="e.g. Swiggy, Canteen"
              className="h-9 text-xs"
            />
          </Field>
          <Field label="Note">
            <Input
              value={draft.note}
              onChange={(e) => set("note", e.target.value)}
              placeholder="e.g. Chai with friends"
              className="h-9 text-xs"
            />
          </Field>
        </div>

        {/* Roommate Split Section */}
        <div className="rounded-2xl border border-border/80 bg-surface-2/40 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-fg">Split with Roommates</p>
              <p className="text-[0.65rem] text-muted">Track who owes you for this expense</p>
            </div>
            <Switch
              checked={draft.split}
              onChange={(v) => {
                set("split", v);
                if (v && draft.splits.length === 0) {
                  set("splits", [{ name: "", amount: "" }]);
                }
              }}
            />
          </div>

          {draft.split ? (
            <div className="mt-3 space-y-2 border-t border-border/60 pt-2.5">
              {draft.splits.map((s, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    placeholder="Friend's Name"
                    value={s.name}
                    onChange={(e) => {
                      const next = [...draft.splits];
                      next[idx] = { ...next[idx], name: e.target.value };
                      set("splits", next);
                    }}
                    className="h-8.5 text-xs flex-1"
                  />
                  <Input
                    type="number"
                    placeholder="₹ Share"
                    value={s.amount}
                    onChange={(e) => {
                      const next = [...draft.splits];
                      next[idx] = { ...next[idx], amount: e.target.value };
                      set("splits", next);
                    }}
                    className="h-8.5 text-xs w-24"
                    leftIcon={<span className="text-[0.65rem] text-subtle">₹</span>}
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      set(
                        "splits",
                        draft.splits.filter((_, i) => i !== idx),
                      );
                    }}
                    className="h-8.5 w-8.5"
                  >
                    <Trash2 className="h-3 w-3 text-danger" />
                  </Button>
                </div>
              ))}
              <Button
                variant="ghost"
                size="xs"
                onClick={() => set("splits", [...draft.splits, { name: "", amount: "" }])}
                leftIcon={<Plus className="h-3 w-3" />}
                className="text-xs text-primary font-bold"
              >
                Add Person
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

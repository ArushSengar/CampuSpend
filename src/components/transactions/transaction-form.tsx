"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Landmark, Receipt, Wallet } from "lucide-react";
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

  // Reset the form whenever it is (re)opened for a different transaction.
  // Adjusting state during render — React re-runs the component immediately.
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
      title={draft.id ? "Edit transaction" : "Add transaction"}
      description={draft.id ? "Update the details below." : "Or just type it out in the AI bar — CampuSpend will file it for you."}
      icon={<Receipt className="h-4 w-4" />}
      footer={
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-subtle">{draft.split ? "Splitting with friends" : "Only yours"}</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} loading={saving}>
              {draft.id ? "Save changes" : "Add transaction"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <Segmented
          value={draft.type}
          onChange={(v) => set("type", v)}
          options={[
            { value: "EXPENSE", label: "💸 Expense" },
            { value: "INCOME", label: "💰 Income" },
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
              leftIcon={<span className="text-sm font-semibold text-subtle">₹</span>}
              className="h-11 text-lg font-semibold tabular"
            />
          </Field>
          <Field label="Date" required>
            <Input type="date" value={draft.occurredAt} onChange={(e) => set("occurredAt", e.target.value)} className="h-11" />
          </Field>
        </div>

        <Field label="Category">
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => {
              const active = draft.categoryId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => set("categoryId", active ? null : c.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition",
                    active
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-surface-2 text-muted hover:border-border-strong hover:text-fg",
                  )}
                >
                  <span>{c.emoji}</span>
                  {c.name}
                </button>
              );
            })}
            {!categories.length ? <p className="text-xs text-subtle">Create categories in Settings.</p> : null}
          </div>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Payment method" hint="UPI or cash?">
            <div className="grid grid-cols-4 gap-1.5">
              {METHODS.map((m) => {
                const active = draft.method === m.value;
                const Icon = m.icon;
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
                      "flex flex-col items-center gap-1 rounded-xl border py-2 text-[0.7rem] font-medium transition",
                      active
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border bg-surface-2 text-muted hover:text-fg",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Account">
            <Select value={draft.accountId ?? ""} onChange={(e) => set("accountId", e.target.value || null)} className="h-10">
              <option value="">No account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · ₹{a.balance.toLocaleString("en-IN")}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Merchant / person">
            <Input value={draft.merchant} onChange={(e) => set("merchant", e.target.value)} placeholder="Zomato, Mom, Hostel…" />
          </Field>
          <Field label="Note">
            <Input value={draft.note} onChange={(e) => set("note", e.target.value)} placeholder="What was it for?" />
          </Field>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-3">
          <Switch
            checked={draft.split}
            onChange={(v) => {
              set("split", v);
              if (v && !draft.splits.length) set("splits", [{ name: "", amount: "" }]);
            }}
            label="Split with friends"
            description="Track who owes you what — your share is what counts toward budgets."
          />
          {draft.split ? (
            <div className="mt-3 space-y-2">
              {draft.splits.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="Name"
                    value={s.name}
                    onChange={(e) => {
                      const next = [...draft.splits];
                      next[i] = { ...next[i], name: e.target.value };
                      set("splits", next);
                    }}
                    className="h-9"
                  />
                  <Input
                    type="number"
                    placeholder="Their share ₹"
                    value={s.amount}
                    onChange={(e) => {
                      const next = [...draft.splits];
                      next[i] = { ...next[i], amount: e.target.value };
                      set("splits", next);
                    }}
                    className="h-9 w-32"
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => set("splits", draft.splits.filter((_, idx) => idx !== i))}
                  >
                    ✕
                  </Button>
                </div>
              ))}
              <Button variant="ghost" size="xs" onClick={() => set("splits", [...draft.splits, { name: "", amount: "" }])}>
                + Add person
              </Button>
            </div>
          ) : null}
        </div>

        {error ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p> : null}
      </div>
    </Modal>
  );
}

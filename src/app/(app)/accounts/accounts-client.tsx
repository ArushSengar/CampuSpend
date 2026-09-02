"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, CreditCard, Landmark, Pencil, Plus, Smartphone, Trash2, WalletCards } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Badge, EmptyState } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { useAppData } from "@/components/providers/app-data";
import { api } from "@/lib/client/api";
import { formatMoney } from "@/lib/money";
import { ACCOUNT_TYPES } from "@/lib/taxonomy";
import { cn } from "@/lib/cn";

type Account = {
  id: string;
  name: string;
  type: string;
  upiId: string | null;
  balance: number;
  color: string;
  icon: string;
  isDefault: boolean;
  archived: boolean;
};

const ICONS: Record<string, typeof Smartphone> = { Smartphone, Banknote, Landmark, CreditCard };

export function AccountsClient() {
  const router = useRouter();
  const toast = useToast();
  const { accounts, reload } = useAppData();
  const [refreshing, setRefreshing] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingNow, setDeletingNow] = useState(false);

  const [form, setForm] = useState({
    name: "",
    type: "UPI",
    upiId: "",
    balance: "",
    color: "#6366f1",
    isDefault: false,
  });

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      await reload();
    } catch (e) {
      toast.error("Couldn't refresh accounts", e instanceof Error ? e.message : undefined);
    } finally {
      setRefreshing(false);
    }
  }, [reload, toast]);

  const netWorth = useMemo(() => accounts.reduce((a, acc) => a + acc.balance, 0), [accounts]);
  const byType = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of accounts) map.set(a.type, (map.get(a.type) ?? 0) + a.balance);
    return map;
  }, [accounts]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", type: "UPI", upiId: "", balance: "", color: "#6366f1", isDefault: accounts.length === 0 });
    setModalOpen(true);
  };

  const openEdit = (a: Account) => {
    setEditing(a);
    setForm({
      name: a.name,
      type: a.type,
      upiId: a.upiId ?? "",
      balance: String(a.balance),
      color: a.color,
      isDefault: a.isDefault,
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Name the account");
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      type: form.type,
      upiId: form.upiId.trim() || null,
      balance: Number(form.balance) || 0,
      color: form.color,
      isDefault: form.isDefault,
    };
    try {
      if (editing) {
        await api.patch<{ account: Account }>(`/api/accounts/${editing.id}`, payload);
      } else {
        await api.post<{ account: Account }>("/api/accounts", payload);
      }
      toast.success(editing ? "Account updated" : "Account added");
      setModalOpen(false);
      await reload();
      router.refresh();
    } catch (e) {
      toast.error("Couldn't save account", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setDeletingNow(true);
    try {
      await api.del(`/api/accounts/${deleting.id}`);
      toast.success("Account removed");
      setDeleting(null);
      await reload();
      router.refresh();
    } catch (e) {
      toast.error("Couldn't delete", e instanceof Error ? e.message : undefined);
    } finally {
      setDeletingNow(false);
    }
  };

  return (
    <div className="mx-auto max-w-[84rem] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-subtle">Total across wallets</p>
            <p className="tabular text-xl font-bold text-fg">{formatMoney(netWorth * 100)}</p>
          </div>
          {["UPI", "CASH", "BANK", "CARD"].map((type) =>
            byType.get(type) ? (
              <Badge key={type} tone="neutral">
                {type} {formatMoney((byType.get(type) ?? 0) * 100)}
              </Badge>
            ) : null,
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void load()} loading={refreshing}>
            Refresh
          </Button>
          <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
            Add account
          </Button>
        </div>
      </div>

      {!accounts.length ? (
        <Card>
          <EmptyState
            icon={<WalletCards className="h-5 w-5" />}
            title="No accounts yet"
            description="Add your GPay/PhonePe wallet, your cash in hand and your bank — balances update as you log transactions."
            action={
              <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
                Add your first account
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((a) => {
            const Icon = ICONS[a.icon] ?? Smartphone;
            const typeMeta = ACCOUNT_TYPES.find((t) => t.value === a.type);
            return (
              <Card key={a.id} className="animate-fade-up relative overflow-hidden p-4">
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-10" style={{ background: a.color }} />
                <div className="relative flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
                      style={{ background: `${a.color}22`, color: a.color }}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-fg">
                        {a.name}
                        {a.isDefault ? <Badge tone="primary">default</Badge> : null}
                      </p>
                      <p className="truncate text-[0.68rem] text-subtle">{a.upiId ?? typeMeta?.hint ?? a.type}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(a)} aria-label="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(a)} aria-label="Delete">
                      <Trash2 className="h-3.5 w-3.5 text-danger" />
                    </Button>
                  </div>
                </div>

                <p className="tabular relative mt-4 text-2xl font-bold text-fg">{formatMoney(a.balance * 100)}</p>
                <p className="mt-0.5 text-[0.68rem] text-subtle">{typeMeta?.label ?? a.type}</p>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit account" : "Add account"}
        description="Balances move automatically as you log income and expenses."
        icon={<WalletCards className="h-4 w-4" />}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              {editing ? "Save changes" : "Add account"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Account name" required>
            <Input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="GPay" />
          </Field>

          <Field label="Type" required>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {ACCOUNT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: t.value }))}
                  className={cn(
                    "rounded-xl border px-2 py-2 text-xs font-medium transition",
                    form.type === t.value ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface-2 text-muted hover:text-fg",
                  )}
                >
                  <span className="mr-1">{t.emoji}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="UPI ID" hint={form.type === "UPI" ? "optional" : undefined}>
              <Input
                value={form.upiId}
                onChange={(e) => setForm((f) => ({ ...f, upiId: e.target.value }))}
                placeholder="you@okhdfcbank"
                disabled={form.type !== "UPI"}
              />
            </Field>
            <Field label="Current balance">
              <Input
                type="number"
                value={form.balance}
                onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))}
                leftIcon={<span className="text-sm font-semibold text-subtle">₹</span>}
                placeholder="0"
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Colour">
              <div className="flex flex-wrap gap-1.5">
                {["#6366f1", "#22c55e", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className={cn("h-8 w-8 rounded-lg border-2 transition", form.color === c ? "border-fg scale-110" : "border-transparent")}
                    style={{ background: c }}
                    aria-label={`Colour ${c}`}
                  />
                ))}
              </div>
            </Field>
            <Field label="Default account">
              <Select value={form.isDefault ? "yes" : "no"} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.value === "yes" }))}>
                <option value="no">No</option>
                <option value="yes">Use by default</option>
              </Select>
            </Field>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={deletingNow}
        title="Delete this account?"
        message="Transactions logged to it are kept — they'll just show without a wallet."
      />
    </div>
  );
}

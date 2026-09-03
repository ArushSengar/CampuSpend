"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, CreditCard, Landmark, Pencil, Plus, Smartphone, Trash2, WalletCards } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/feedback";
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
    color: "#0071e3",
    isDefault: false,
  });

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      await reload();
    } catch (e) {
      toast.error("Refresh failed", e instanceof Error ? e.message : undefined);
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
    setForm({ name: "", type: "UPI", upiId: "", balance: "", color: "#0071e3", isDefault: accounts.length === 0 });
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
      toast.error("Save failed", e instanceof Error ? e.message : undefined);
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
      toast.error("Delete failed", e instanceof Error ? e.message : undefined);
    } finally {
      setDeletingNow(false);
    }
  };

  return (
    <div className="mx-auto max-w-[84rem] space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-wider text-subtle">Total Liquid Balance</p>
            <p className="tabular text-2xl font-black text-fg">{formatMoney(netWorth * 100)}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["UPI", "CASH", "BANK", "CARD"].map((type) =>
              byType.get(type) ? (
                <span
                  key={type}
                  className="rounded-full border border-border/80 bg-surface-2/80 px-2.5 py-0.5 text-[0.65rem] font-bold text-muted"
                >
                  {type} {formatMoney((byType.get(type) ?? 0) * 100)}
                </span>
              ) : null,
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => void load()} loading={refreshing} className="text-xs">
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate} leftIcon={<Plus className="h-3.5 w-3.5" />} className="text-xs">
            Add Wallet
          </Button>
        </div>
      </div>

      {!accounts.length ? (
        <Card>
          <EmptyState
            icon={<WalletCards className="h-5 w-5" />}
            title="No wallets yet"
            description="Add your GPay/PhonePe, Cash in hand, or Bank accounts."
            action={
              <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
                Add Wallet
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((a) => {
            const Icon = ICONS[a.icon] ?? Smartphone;
            const typeMeta = ACCOUNT_TYPES.find((t) => t.value === a.type);
            return (
              <Card key={a.id} className="animate-fade-up relative overflow-hidden p-4.5">
                <div
                  className="absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-10 blur-xl"
                  style={{ background: a.color }}
                />
                <div className="relative flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl shadow-sm border border-border/40"
                      style={{ background: `${a.color}20`, color: a.color }}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-xs font-bold text-fg">
                        {a.name}
                        {a.isDefault ? (
                          <span className="rounded-full bg-primary-soft px-1.5 py-0.2 text-[0.6rem] font-bold text-primary">
                            Default
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-[0.65rem] text-subtle">{a.upiId ?? typeMeta?.hint ?? a.type}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(a)} aria-label="Edit">
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(a)} aria-label="Delete">
                      <Trash2 className="h-3 w-3 text-danger" />
                    </Button>
                  </div>
                </div>

                <p className="tabular relative mt-3.5 text-2xl font-black text-fg">{formatMoney(a.balance * 100)}</p>
                <p className="mt-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-subtle">{typeMeta?.label ?? a.type}</p>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Account" : "Add Account"}
        description="Balances update automatically with each transaction."
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} loading={saving}>
              {editing ? "Save" : "Add"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5">
          <Field label="Account Name" required>
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
                    "rounded-2xl border px-2.5 py-2 text-xs font-semibold transition pressable",
                    form.type === t.value
                      ? "border-primary bg-primary-soft text-primary shadow-sm"
                      : "border-border/80 bg-surface-2/60 text-muted hover:text-fg",
                  )}
                >
                  <span className="mr-1">{t.emoji}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Starting Balance (₹)">
            <Input
              type="number"
              value={form.balance}
              onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))}
              placeholder="0"
              leftIcon={<span className="text-xs text-subtle">₹</span>}
            />
          </Field>

          <Field label="UPI ID / Account Handle">
            <Input
              value={form.upiId}
              onChange={(e) => setForm((f) => ({ ...f, upiId: e.target.value }))}
              placeholder="user@oksbi"
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={deletingNow}
        title="Remove account?"
        message={`Delete "${deleting?.name}"? Your past transactions will remain in ledger.`}
      />
    </div>
  );
}

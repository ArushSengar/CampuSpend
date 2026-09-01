"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Pencil, Play, Plus, Repeat, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch } from "@/components/ui/input";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Badge, EmptyState, Skeleton } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { useAppData } from "@/components/providers/app-data";
import { api } from "@/lib/client/api";
import { useAsyncData } from "@/lib/client/use-async-data";
import { formatMoney } from "@/lib/money";
import { daysUntil, formatDay, toDateInput } from "@/lib/dates";
import { cn } from "@/lib/cn";

type Rule = {
  id: string;
  title: string;
  amount: number;
  type: string;
  method: string;
  categoryId: string | null;
  accountId: string | null;
  merchant: string | null;
  frequency: string;
  interval: number;
  nextRun: string;
  lastRun: string | null;
  active: boolean;
  category: { id: string; name: string; slug: string; emoji: string; color: string } | null;
};

const FREQUENCIES = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
];

export function RecurringClient() {
  const router = useRouter();
  const toast = useToast();
  const { categories, accounts } = useAppData();

  const { data, loading, reload } = useAsyncData<{ recurrings: Rule[] }>("/api/recurring", { recurrings: [] });
  const [rules, setRules] = useState<Rule[]>([]);
  const [synced, setSynced] = useState(false);
  const [applying, setApplying] = useState(false);
  if (!loading && !synced && data.recurrings.length > 0) {
    setSynced(true);
    setRules(data.recurrings);
  }

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [deleting, setDeleting] = useState<Rule | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingNow, setDeletingNow] = useState(false);

  const [form, setForm] = useState({
    title: "",
    amount: "",
    type: "EXPENSE",
    method: "UPI",
    categoryId: "",
    accountId: "",
    merchant: "",
    frequency: "MONTHLY",
    interval: "1",
    nextRun: toDateInput(new Date()),
    active: true,
  });

  const load = useCallback(() => reload(), [reload]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      title: "",
      amount: "",
      type: "EXPENSE",
      method: "UPI",
      categoryId: categories.find((c) => c.kind === "EXPENSE")?.id ?? "",
      accountId: accounts[0]?.id ?? "",
      merchant: "",
      frequency: "MONTHLY",
      interval: "1",
      nextRun: toDateInput(new Date()),
      active: true,
    });
    setModalOpen(true);
  };

  const openEdit = (r: Rule) => {
    setEditing(r);
    setForm({
      title: r.title,
      amount: String(r.amount),
      type: r.type,
      method: r.method,
      categoryId: r.categoryId ?? "",
      accountId: r.accountId ?? "",
      merchant: r.merchant ?? "",
      frequency: r.frequency,
      interval: String(r.interval),
      nextRun: toDateInput(r.nextRun),
      active: r.active,
    });
    setModalOpen(true);
  };

  const save = async () => {
    const amount = Number(form.amount);
    if (!form.title.trim()) return toast.error("Give the rule a title");
    if (!amount || amount <= 0) return toast.error("Set an amount");

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      amount,
      type: form.type,
      method: form.method,
      categoryId: form.categoryId || null,
      accountId: form.accountId || null,
      merchant: form.merchant.trim() || null,
      frequency: form.frequency,
      interval: Number(form.interval) || 1,
      nextRun: new Date(`${form.nextRun}T09:00:00`).toISOString(),
      active: form.active,
    };
    const snapshot = rules;
    try {
      if (editing) {
        const res = await api.patch<{ recurring: Rule }>(`/api/recurring/${editing.id}`, payload);
        setRules((prev) => prev.map((r) => (r.id === editing.id ? res.recurring : r)));
      } else {
        const res = await api.post<{ recurring: Rule }>("/api/recurring", payload);
        setRules((prev) => [res.recurring, ...prev]);
      }
      toast.success(editing ? "Rule updated" : "Recurring rule created");
      setModalOpen(false);
      router.refresh();
    } catch (e) {
      setRules(snapshot);
      toast.error("Couldn't save rule", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (rule: Rule) => {
    const snapshot = rules;
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, active: !r.active } : r)));
    try {
      const res = await api.patch<{ recurring: Rule }>(`/api/recurring/${rule.id}`, { active: !rule.active });
      setRules((prev) => prev.map((r) => (r.id === rule.id ? res.recurring : r)));
    } catch (e) {
      setRules(snapshot);
      toast.error("Couldn't update", e instanceof Error ? e.message : undefined);
    }
  };

  const runNow = async () => {
    setApplying(true);
    try {
      const res = await api.post<{ created: number }>("/api/recurring/apply");
      toast.success(res.created ? `Logged ${res.created} recurring transaction${res.created === 1 ? "" : "s"}` : "Nothing due right now");
      await load();
      router.refresh();
    } catch (e) {
      toast.error("Couldn't apply rules", e instanceof Error ? e.message : undefined);
    } finally {
      setApplying(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    const snapshot = rules;
    setRules((prev) => prev.filter((r) => r.id !== deleting.id));
    setDeletingNow(true);
    try {
      await api.del(`/api/recurring/${deleting.id}`);
      toast.success("Rule deleted");
      setDeleting(null);
      router.refresh();
    } catch (e) {
      setRules(snapshot);
      toast.error("Couldn't delete", e instanceof Error ? e.message : undefined);
    } finally {
      setDeletingNow(false);
    }
  };

  const monthlyTotal = rules
    .filter((r) => r.active && r.type === "EXPENSE")
    .reduce((a, r) => a + (r.frequency === "MONTHLY" ? r.amount : r.frequency === "WEEKLY" ? r.amount * 4 : r.frequency === "DAILY" ? r.amount * 30 : r.amount / 12), 0);

  return (
    <div className="mx-auto max-w-[84rem] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {loading ? (
            <Skeleton className="h-5 w-56" />
          ) : (
            <>
              <p className="text-sm text-muted">
                <span className="tabular font-semibold text-fg">{rules.filter((r) => r.active).length}</span> active rules
              </p>
              <Badge tone="info">{formatMoney(monthlyTotal * 100)}/month of fixed costs</Badge>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={runNow} loading={applying} leftIcon={<Play className="h-4 w-4" />}>
            Run due now
          </Button>
          <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
            New rule
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-card" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Repeat className="h-5 w-5" />}
            title="No recurring rules"
            description="Hostel rent, mess bills, recharges, subscriptions — set them once and CampuSpend logs them automatically when they're due."
            action={
              <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
                Add your first rule
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {rules.map((r) => {
            const days = daysUntil(r.nextRun);
            const due = days <= 0;
            return (
              <Card key={r.id} className={cn("animate-fade-up flex flex-wrap items-center gap-4 p-4", !r.active && "opacity-60")}>
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg"
                  style={{ background: r.category ? `${r.category.color}22` : "var(--surface-3)" }}
                >
                  {r.category?.emoji ?? (r.type === "INCOME" ? "💰" : "🔁")}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-fg">{r.title}</p>
                    <Badge tone={r.type === "INCOME" ? "success" : "neutral"}>{r.type === "INCOME" ? "Income" : "Expense"}</Badge>
                    <Badge tone="neutral">{r.method}</Badge>
                    {!r.active ? <Badge tone="warning">Paused</Badge> : null}
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[0.68rem] text-subtle">
                    <span>
                      Every {r.interval > 1 ? `${r.interval} ` : ""}
                      {r.frequency.toLowerCase().replace("ly", "s").replace("dailys", "days").replace("weeklys", "weeks").replace("months", "month").replace("yearlys", "years")}
                    </span>
                    <span className="text-border-strong">•</span>
                    <span className={cn("flex items-center gap-1", due && r.active && "font-semibold text-warning")}>
                      <CalendarDays className="h-3 w-3" />
                      {due ? "Due now" : `Next ${formatDay(r.nextRun)} (${days}d)`}
                    </span>
                    {r.merchant ? (
                      <>
                        <span className="text-border-strong">•</span>
                        <span>{r.merchant}</span>
                      </>
                    ) : null}
                  </p>
                </div>

                <p className={cn("tabular shrink-0 text-base font-semibold", r.type === "INCOME" ? "text-success" : "text-fg")}>
                  {r.type === "INCOME" ? "+" : "−"}
                  {formatMoney(r.amount * 100)}
                </p>

                <div className="flex shrink-0 items-center gap-2">
                  <Switch checked={r.active} onChange={() => toggleActive(r)} />
                  <Button variant="ghost" size="icon-sm" onClick={() => openEdit(r)} aria-label="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(r)} aria-label="Delete">
                    <Trash2 className="h-3.5 w-3.5 text-danger" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit rule" : "New recurring rule"}
        description="Due rules are logged automatically whenever you open the app."
        icon={<Repeat className="h-4 w-4" />}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              {editing ? "Save changes" : "Create rule"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Title" required>
            <Input autoFocus value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Hostel rent" />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Amount" required>
              <Input
                type="number"
                min="1"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                leftIcon={<span className="text-sm font-semibold text-subtle">₹</span>}
                placeholder="4500"
              />
            </Field>
            <Field label="Merchant">
              <Input value={form.merchant} onChange={(e) => setForm((f) => ({ ...f, merchant: e.target.value }))} placeholder="Hostel Warden" />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Type">
              <Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                <option value="EXPENSE">Expense</option>
                <option value="INCOME">Income</option>
              </Select>
            </Field>
            <Field label="Method">
              <Select value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}>
                <option value="UPI">UPI</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="BANK">Bank</option>
              </Select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Category">
              <Select value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}>
                <option value="">No category</option>
                {categories
                  .filter((c) => (form.type === "INCOME" ? c.kind === "INCOME" : c.kind === "EXPENSE"))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji} {c.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Account">
              <Select value={form.accountId} onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}>
                <option value="">No account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Frequency">
              <Select value={form.frequency} onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}>
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Every">
              <Input type="number" min="1" max="24" value={form.interval} onChange={(e) => setForm((f) => ({ ...f, interval: e.target.value }))} />
            </Field>
            <Field label="Next run" required>
              <Input type="date" value={form.nextRun} onChange={(e) => setForm((f) => ({ ...f, nextRun: e.target.value }))} />
            </Field>
          </div>

          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <Switch checked={form.active} onChange={(v) => setForm((f) => ({ ...f, active: v }))} label="Active" description="Paused rules stay saved but stop generating transactions." />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={deletingNow}
        title="Delete this rule?"
        message="Transactions it already created are kept; future ones won't be generated."
      />
    </div>
  );
}

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
    if (!form.title.trim()) return toast.error("Enter subscription title");
    if (!amount || amount <= 0) return toast.error("Enter amount");

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
      nextRun: new Date(`${form.nextRun}T12:00:00`).toISOString(),
      active: form.active,
    };

    try {
      if (editing) {
        const res = await api.patch<{ recurring: Rule }>(`/api/recurring/${editing.id}`, payload);
        setRules((prev) => prev.map((r) => (r.id === editing.id ? res.recurring : r)));
        toast.success("Rule updated");
      } else {
        const res = await api.post<{ recurring: Rule }>("/api/recurring", payload);
        setRules((prev) => [res.recurring, ...prev]);
        toast.success("Rule created");
      }
      setModalOpen(false);
      load();
      router.refresh();
    } catch (e) {
      toast.error("Save failed", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (r: Rule) => {
    const next = !r.active;
    setRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, active: next } : x)));
    try {
      await api.patch(`/api/recurring/${r.id}`, { active: next });
      toast.info(next ? "Rule active" : "Rule paused");
    } catch {
      setRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, active: r.active } : x)));
      toast.error("Failed to update status");
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setDeletingNow(true);
    const id = deleting.id;
    try {
      await api.del(`/api/recurring/${id}`);
      setRules((prev) => prev.filter((r) => r.id !== id));
      toast.success("Rule deleted");
      setDeleting(null);
      load();
      router.refresh();
    } catch (e) {
      toast.error("Delete failed", e instanceof Error ? e.message : undefined);
    } finally {
      setDeletingNow(false);
    }
  };

  const runNow = async () => {
    setApplying(true);
    try {
      const res = await api.post<{ created: number }>("/api/recurring/run");
      if (res.created > 0) {
        toast.success(`Logged ${res.created} due items`);
      } else {
        toast.info("No items due right now");
      }
      load();
      router.refresh();
    } catch (e) {
      toast.error("Run failed", e instanceof Error ? e.message : undefined);
    } finally {
      setApplying(false);
    }
  };

  const monthlyTotal = rules
    .filter((r) => r.active && r.type === "EXPENSE")
    .reduce(
      (a, r) =>
        a +
        (r.frequency === "MONTHLY"
          ? r.amount
          : r.frequency === "WEEKLY"
            ? r.amount * 4
            : r.frequency === "DAILY"
              ? r.amount * 30
              : r.amount / 12),
      0,
    );

  return (
    <div className="mx-auto max-w-[84rem] space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {loading ? (
            <Skeleton className="h-5 w-48 rounded-full" />
          ) : (
            <>
              <p className="text-xs font-bold text-fg">
                <span className="tabular text-sm font-black text-primary">{rules.filter((r) => r.active).length}</span> Fixed Rules
              </p>
              <Badge tone="info">{formatMoney(monthlyTotal * 100)}/mo</Badge>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={runNow} loading={applying} leftIcon={<Play className="h-3 w-3" />} className="text-xs">
            Run Due
          </Button>
          <Button size="sm" onClick={openCreate} leftIcon={<Plus className="h-3.5 w-3.5" />} className="text-xs">
            New Rule
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Repeat className="h-5 w-5" />}
            title="No recurring rules"
            description="Rent, mess fees, mobile recharges, and subscriptions auto-log when due."
            action={
              <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
                Add Rule
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {rules.map((r) => {
            const days = daysUntil(r.nextRun);
            const due = days <= 0;
            return (
              <Card
                key={r.id}
                className={cn(
                  "animate-fade-up flex flex-wrap items-center gap-3.5 p-3.5",
                  !r.active && "opacity-50",
                )}
              >
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-base shadow-sm border border-border/40"
                  style={{ background: r.category ? `${r.category.color}20` : "var(--surface-3)" }}
                >
                  {r.category?.emoji ?? (r.type === "INCOME" ? "💰" : "🔁")}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-xs font-bold text-fg">{r.title}</p>
                    <Badge tone={r.type === "INCOME" ? "success" : "neutral"}>
                      {r.type === "INCOME" ? "In" : "Out"}
                    </Badge>
                    <span className="rounded-full bg-surface-2 px-2 py-0.2 text-[0.65rem] font-bold text-muted">
                      {r.method}
                    </span>
                    {!r.active ? <Badge tone="warning">Paused</Badge> : null}
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[0.65rem] text-subtle">
                    <span>
                      Every {r.interval > 1 ? `${r.interval} ` : ""}
                      {r.frequency.toLowerCase()}
                    </span>
                    <span>•</span>
                    <span className={cn("flex items-center gap-1", due && r.active && "font-bold text-warning")}>
                      <CalendarDays className="h-3 w-3" />
                      {due ? "Due now" : `Next ${formatDay(r.nextRun)} (${days}d)`}
                    </span>
                    {r.merchant ? (
                      <>
                        <span>•</span>
                        <span>{r.merchant}</span>
                      </>
                    ) : null}
                  </p>
                </div>

                <p
                  className={cn(
                    "tabular shrink-0 text-base font-black",
                    r.type === "INCOME" ? "text-success" : "text-fg",
                  )}
                >
                  {r.type === "INCOME" ? "+" : "−"}
                  {formatMoney(r.amount * 100)}
                </p>

                <div className="flex shrink-0 items-center gap-2">
                  <Switch checked={r.active} onChange={() => toggleActive(r)} />
                  <Button variant="ghost" size="icon-sm" onClick={() => openEdit(r)} aria-label="Edit">
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(r)} aria-label="Delete">
                    <Trash2 className="h-3 w-3 text-danger" />
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
        title={editing ? "Edit Rule" : "New Rule"}
        description="Auto-log regular bills and income."
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} loading={saving}>
              {editing ? "Save" : "Create"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5">
          <Field label="Title" required>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Hostel Rent, Spotify"
            />
          </Field>

          <Field label="Amount (₹)" required>
            <Input
              type="number"
              min="1"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="1000"
              leftIcon={<span className="text-xs text-subtle">₹</span>}
            />
          </Field>

          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Category">
              <Select
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Frequency">
              <Select
                value={form.frequency}
                onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
              >
                {FREQUENCIES.map((freq) => (
                  <option key={freq.value} value={freq.value}>
                    {freq.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Next Run Date">
            <Input
              type="date"
              value={form.nextRun}
              onChange={(e) => setForm((f) => ({ ...f, nextRun: e.target.value }))}
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={deletingNow}
        title="Delete recurring rule?"
        message={`Delete "${deleting?.title}"? Past logged entries remain in your ledger.`}
      />
    </div>
  );
}

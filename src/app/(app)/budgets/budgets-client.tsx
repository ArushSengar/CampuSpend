"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChartPie, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Badge, EmptyState, ProgressBar, Skeleton } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { useAppData } from "@/components/providers/app-data";
import { api } from "@/lib/client/api";
import { useAsyncData } from "@/lib/client/use-async-data";
import { formatMoney } from "@/lib/money";
import { endOfMonth } from "@/lib/dates";
import { cn } from "@/lib/cn";

type BudgetStatus = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  limit: number;
  spent: number;
  remaining: number;
  percent: number;
  status: "safe" | "watch" | "over";
  categoryId: string | null;
  period: string;
};

type Budget = {
  id: string;
  limit: number;
  period: string;
  rollover: boolean;
  categoryId: string | null;
  category: { id: string; name: string; slug: string; emoji: string; color: string } | null;
};

export function BudgetsClient() {
  const router = useRouter();
  const toast = useToast();
  const { expenseCategories } = useAppData();

  const { data, loading, reload } = useAsyncData<{ budgets: Budget[]; status: BudgetStatus[] }>("/api/budgets", {
    budgets: [],
    status: [],
  });
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [status, setStatus] = useState<BudgetStatus[]>([]);
  const [synced, setSynced] = useState(false);
  if (!loading && !synced && data.budgets.length + data.status.length > 0) {
    setSynced(true);
    setBudgets(data.budgets);
    setStatus(data.status);
  }

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [deleting, setDeleting] = useState<Budget | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingNow, setDeletingNow] = useState(false);

  const [form, setForm] = useState({ categoryId: "", limit: "", period: "MONTHLY" });

  const load = useCallback(() => {
    reload();
  }, [reload]);

  const statusById = useMemo(() => new Map(status.map((s) => [s.id, s])), [status]);
  const uncapped = expenseCategories.filter((c) => !budgets.some((b) => b.categoryId === c.id));

  const openCreate = () => {
    setEditing(null);
    setForm({ categoryId: uncapped[0]?.id ?? "", limit: "", period: "MONTHLY" });
    setModalOpen(true);
  };

  const openEdit = (b: Budget) => {
    setEditing(b);
    setForm({ categoryId: b.categoryId ?? "", limit: String(b.limit), period: b.period });
    setModalOpen(true);
  };

  const save = async () => {
    const limit = Number(form.limit);
    if (!limit || limit <= 0) {
      toast.error("Enter a monthly limit");
      return;
    }
    setSaving(true);
    const payload = { limit, period: form.period, categoryId: form.categoryId || null };
    const snapshot = budgets;
    try {
      if (editing) {
        const res = await api.patch<{ budget: Budget }>(`/api/budgets/${editing.id}`, payload);
        setBudgets((prev) => prev.map((b) => (b.id === editing.id ? res.budget : b)));
      } else {
        const res = await api.post<{ budget: Budget }>("/api/budgets", payload);
        setBudgets((prev) => [res.budget, ...prev]);
      }
      toast.success(editing ? "Budget updated" : "Budget created", `${formatMoney(limit * 100)} / ${form.period.toLowerCase()}`);
      setModalOpen(false);
      router.refresh();
      void load();
    } catch (e) {
      setBudgets(snapshot);
      toast.error("Couldn't save budget", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    const snapshot = budgets;
    setBudgets((prev) => prev.filter((b) => b.id !== deleting.id));
    setDeletingNow(true);
    try {
      await api.del(`/api/budgets/${deleting.id}`);
      toast.success("Budget deleted");
      setDeleting(null);
      router.refresh();
      void load();
    } catch (e) {
      setBudgets(snapshot);
      toast.error("Couldn't delete", e instanceof Error ? e.message : undefined);
    } finally {
      setDeletingNow(false);
    }
  };

  const [now] = useState(() => new Date());
  const daysLeft = Math.max(0, Math.round((endOfMonth(now).getTime() - now.getTime()) / 86400000));

  return (
    <div className="mx-auto max-w-[84rem] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {loading ? (
            <>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-32" />
            </>
          ) : (
            <>
              <p className="text-sm text-muted">
                <span className="tabular font-semibold text-fg">{budgets.length}</span> budget{budgets.length === 1 ? "" : "s"}
              </p>
              <Badge tone={status.some((s) => s.status === "over") ? "danger" : "success"}>
                {status.filter((s) => s.status === "over").length} over · {status.filter((s) => s.status === "watch").length} close
              </Badge>
              <span className="text-xs text-subtle">{daysLeft} days left this month</span>
            </>
          )}
        </div>
        <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
          New budget
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-card" />
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ChartPie className="h-5 w-5" />}
            title="No budgets yet"
            description="Set a cap per category — Food, Delivery, Transport — and CampuSpend will warn you before you cross it."
            action={
              <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
                Create your first budget
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {budgets.map((b) => {
            const s = statusById.get(b.id);
            const pct = s?.percent ?? 0;
            const state = s?.status ?? "safe";
            const spent = s?.spent ?? 0;
            const limitPaise = b.limit * 100;
            return (
              <Card key={b.id} className="animate-fade-up p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg"
                      style={{ background: `${b.category?.color ?? "#6366f1"}22` }}
                    >
                      {b.category?.emoji ?? "🎯"}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-fg">{b.category?.name ?? "Overall spending"}</p>
                      <p className="text-[0.68rem] text-subtle">{b.period === "WEEKLY" ? "Every week" : "Every month"}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(b)} aria-label="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(b)} aria-label="Delete">
                      <Trash2 className="h-3.5 w-3.5 text-danger" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex items-end justify-between gap-2">
                  <div>
                    <p className="tabular text-xl font-bold text-fg">{formatMoney(spent)}</p>
                    <p className="text-[0.68rem] text-subtle">of {formatMoney(limitPaise)}</p>
                  </div>
                  <Badge
                    tone={state === "over" ? "danger" : state === "watch" ? "warning" : "success"}
                    className="shrink-0"
                  >
                    {state === "over" ? "Over budget" : state === "watch" ? "Close to limit" : "On track"}
                  </Badge>
                </div>

                <div className="mt-3">
                  <ProgressBar value={pct} tone={state === "over" ? "danger" : state === "watch" ? "warning" : "success"} height={8} />
                  <div className="mt-1.5 flex justify-between text-[0.68rem] text-subtle">
                    <span>{Math.round(pct)}% used</span>
                    <span className={cn(state === "over" && "font-semibold text-danger")}>
                      {state === "over"
                        ? `${formatMoney(Math.abs(s?.remaining ?? 0))} over`
                        : `${formatMoney(s?.remaining ?? 0)} left`}
                    </span>
                  </div>
                </div>

                {state !== "over" && daysLeft > 0 ? (
                  <p className="mt-3 border-t border-border pt-2.5 text-[0.68rem] text-subtle">
                    Safe to spend <span className="font-semibold text-fg">{formatMoney(Math.round((s?.remaining ?? 0) / Math.max(1, daysLeft)))}</span> a day
                    for the rest of the month.
                  </p>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit budget" : "New budget"}
        description="Caps are checked automatically every time you log a transaction."
        icon={<Target className="h-4 w-4" />}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              {editing ? "Save changes" : "Create budget"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Category" hint="leave empty for an overall cap">
            <Select value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}>
              <option value="">Overall spending (all categories)</option>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Monthly limit" required hint="₹">
            <Input
              type="number"
              min="1"
              autoFocus
              placeholder="5000"
              value={form.limit}
              onChange={(e) => setForm((f) => ({ ...f, limit: e.target.value }))}
              leftIcon={<span className="text-sm font-semibold text-subtle">₹</span>}
              className="h-11 text-lg font-semibold tabular"
            />
          </Field>
          <Field label="Period">
            <Select value={form.period} onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}>
              <option value="MONTHLY">Monthly</option>
              <option value="WEEKLY">Weekly</option>
            </Select>
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={deletingNow}
        title="Delete this budget?"
        message={`The ${deleting?.category?.name ?? "overall"} cap will be removed. Your transactions stay untouched.`}
      />
    </div>
  );
}

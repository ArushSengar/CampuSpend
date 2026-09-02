"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Badge, EmptyState, ProgressBar, Skeleton } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client/api";
import { useAsyncData } from "@/lib/client/use-async-data";
import { formatMoney, safePercent } from "@/lib/money";
import { daysUntil, formatDay, toDateInput } from "@/lib/dates";
import { cn } from "@/lib/cn";

type Goal = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  targetAmount: number;
  savedAmount: number;
  deadline: string | null;
  priority: string;
};

const PRESETS = ["🎯", "💻", "🏖️", "🛟", "🎓", "🚗", "📱", "🎸", "🏠", "🎁"];
const QUICK_ADD = [100, 500, 1000];

export function GoalsClient() {
  const router = useRouter();
  const toast = useToast();

  const { data, loading } = useAsyncData<{ goals: Goal[] }>("/api/goals", { goals: [] });
  const [goals, setGoals] = useState<Goal[]>([]);
  const [synced, setSynced] = useState(false);
  if (!loading && !synced && data.goals.length > 0) {
    setSynced(true);
    setGoals(data.goals);
  }

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [deleting, setDeleting] = useState<Goal | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingNow, setDeletingNow] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    emoji: "🎯",
    color: "#22c55e",
    targetAmount: "",
    savedAmount: "",
    deadline: "",
    priority: "MEDIUM",
  });


  const totals = useMemo(
    () => ({
      target: goals.reduce((a, g) => a + g.targetAmount, 0),
      saved: goals.reduce((a, g) => a + g.savedAmount, 0),
    }),
    [goals],
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", emoji: "🎯", color: "#22c55e", targetAmount: "", savedAmount: "", deadline: "", priority: "MEDIUM" });
    setModalOpen(true);
  };

  const openEdit = (g: Goal) => {
    setEditing(g);
    setForm({
      name: g.name,
      emoji: g.emoji,
      color: g.color,
      targetAmount: String(g.targetAmount),
      savedAmount: String(g.savedAmount),
      deadline: g.deadline ? toDateInput(g.deadline) : "",
      priority: g.priority,
    });
    setModalOpen(true);
  };

  const save = async () => {
    const target = Number(form.targetAmount);
    if (!form.name.trim()) return toast.error("Give the goal a name");
    if (!target || target <= 0) return toast.error("Set a target amount");

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      emoji: form.emoji,
      color: form.color,
      targetAmount: target,
      savedAmount: Number(form.savedAmount) || 0,
      deadline: form.deadline ? new Date(`${form.deadline}T12:00:00`).toISOString() : null,
      priority: form.priority,
    };
    const snapshot = goals;
    try {
      if (editing) {
        const res = await api.patch<{ goal: Goal }>(`/api/goals/${editing.id}`, payload);
        setGoals((prev) => prev.map((g) => (g.id === editing.id ? res.goal : g)));
      } else {
        const res = await api.post<{ goal: Goal }>("/api/goals", payload);
        setGoals((prev) => [res.goal, ...prev]);
      }
      toast.success(editing ? "Goal updated" : "Goal created");
      setModalOpen(false);
      router.refresh();
    } catch (e) {
      setGoals(snapshot);
      toast.error("Couldn't save goal", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  /** Optimistic contribution: the bar moves before the server replies. */
  const contribute = async (goal: Goal, rupees: number) => {
    const snapshot = goals;
    const optimisticSaved = Math.min(goal.targetAmount * 100, goal.savedAmount * 100 + rupees * 100) / 100;
    setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, savedAmount: optimisticSaved } : g)));
    setPendingId(goal.id);
    try {
      const res = await api.post<{ goal: Goal }>(`/api/goals/${goal.id}`, { amount: rupees });
      setGoals((prev) => prev.map((g) => (g.id === goal.id ? res.goal : g)));
      toast.success(`Added ${formatMoney(rupees * 100)}`, `${res.goal.name} · ${Math.round(safePercent(res.goal.savedAmount, res.goal.targetAmount))}% funded`);
      router.refresh();
    } catch (e) {
      setGoals(snapshot);
      toast.error("Couldn't update goal", e instanceof Error ? e.message : undefined);
    } finally {
      setPendingId(null);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    const snapshot = goals;
    setGoals((prev) => prev.filter((g) => g.id !== deleting.id));
    setDeletingNow(true);
    try {
      await api.del(`/api/goals/${deleting.id}`);
      toast.success("Goal deleted");
      setDeleting(null);
      router.refresh();
    } catch (e) {
      setGoals(snapshot);
      toast.error("Couldn't delete", e instanceof Error ? e.message : undefined);
    } finally {
      setDeletingNow(false);
    }
  };

  return (
    <div className="mx-auto max-w-[84rem] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {loading ? (
            <Skeleton className="h-5 w-48" />
          ) : (
            <>
              <p className="text-sm text-muted">
                <span className="tabular font-semibold text-fg">{formatMoney(totals.saved * 100)}</span> saved toward{" "}
                <span className="tabular font-semibold text-fg">{formatMoney(totals.target * 100)}</span>
              </p>
              <Badge tone="success">{Math.round(safePercent(totals.saved, totals.target))}% overall</Badge>
            </>
          )}
        </div>
        <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
          New goal
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-card" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Target className="h-5 w-5" />}
            title="No goals yet"
            description="A laptop, a Goa trip, an emergency buffer — naming your savings makes them happen."
            action={
              <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
                Set your first goal
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {goals.map((g) => {
            const pct = safePercent(g.savedAmount, g.targetAmount);
            const remaining = Math.max(0, g.targetAmount - g.savedAmount);
            const days = g.deadline ? daysUntil(g.deadline) : null;
            const perMonth = days && days > 0 ? Math.round((remaining * 100) / Math.max(1, Math.round(days / 30))) / 100 : null;
            const complete = pct >= 100;
            const pending = pendingId === g.id;

            return (
              <Card key={g.id} className={cn("animate-fade-up p-4 transition", pending && "opacity-70")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl"
                      style={{ background: `${g.color}22` }}
                    >
                      {g.emoji}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-fg">{g.name}</p>
                      <p className="flex items-center gap-1 text-[0.68rem] text-subtle">
                        {g.deadline ? (
                          <>
                            <CalendarDays className="h-3 w-3" />
                            {formatDay(g.deadline)}
                            {days != null ? <span>· {days > 0 ? `${days}d left` : "overdue"}</span> : null}
                          </>
                        ) : (
                          "No deadline"
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(g)} aria-label="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(g)} aria-label="Delete">
                      <Trash2 className="h-3.5 w-3.5 text-danger" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-end justify-between">
                    <p className="tabular text-xl font-bold text-fg">{formatMoney(g.savedAmount * 100)}</p>
                    <p className="text-[0.68rem] text-subtle">of {formatMoney(g.targetAmount * 100)}</p>
                  </div>
                  <div className="mt-2">
                    <ProgressBar value={pct} tone={complete ? "success" : "primary"} height={8} />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[0.68rem]">
                    <span className="font-semibold text-primary">{Math.round(pct)}% funded</span>
                    <span className="text-subtle">
                      {complete ? "Target reached 🎉" : `${formatMoney(remaining * 100)} to go`}
                    </span>
                  </div>
                </div>

                {perMonth && !complete ? (
                  <p className="mt-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-[0.68rem] text-muted">
                    Saving <span className="font-semibold text-fg">{formatMoney(perMonth * 100)}</span>/month hits this in time.
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
                  {QUICK_ADD.map((amount) => (
                    <Button key={amount} size="xs" variant="secondary" onClick={() => contribute(g, amount)} disabled={pending}>
                      +₹{amount}
                    </Button>
                  ))}
                  <Button
                    size="xs"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => {
                      const value = window.prompt("Add to this goal (₹)", "500");
                      const amount = Number(value);
                      if (value && amount > 0) void contribute(g, amount);
                    }}
                  >
                    Custom
                  </Button>
                  {g.savedAmount > 0 ? (
                    <Button
                      size="xs"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => void contribute(g, -Math.min(g.savedAmount, 100))}
                      title="Withdraw"
                    >
                      −₹{Math.min(g.savedAmount, 100)}
                    </Button>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit goal" : "New goal"}
        description="Track progress toward something that matters."
        icon={<Target className="h-4 w-4" />}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              {editing ? "Save changes" : "Create goal"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Goal name" required>
            <Input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="New laptop fund" />
          </Field>

          <Field label="Icon">
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, emoji: e }))}
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-xl border text-lg transition",
                    form.emoji === e ? "border-primary bg-primary-soft" : "border-border bg-surface-2 hover:bg-surface-3",
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Target amount" required>
              <Input
                type="number"
                min="1"
                value={form.targetAmount}
                onChange={(e) => setForm((f) => ({ ...f, targetAmount: e.target.value }))}
                leftIcon={<span className="text-sm font-semibold text-subtle">₹</span>}
                placeholder="65000"
              />
            </Field>
            <Field label="Already saved" hint="optional">
              <Input
                type="number"
                min="0"
                value={form.savedAmount}
                onChange={(e) => setForm((f) => ({ ...f, savedAmount: e.target.value }))}
                leftIcon={<span className="text-sm font-semibold text-subtle">₹</span>}
                placeholder="0"
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Target date" hint="optional">
              <Input type="date" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} />
            </Field>
            <Field label="Priority">
              <Select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </Select>
            </Field>
          </div>

          <Field label="Colour">
            <div className="flex flex-wrap gap-1.5">
              {["#22c55e", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6", "#6366f1"].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  className={cn(
                    "h-8 w-8 rounded-lg border-2 transition",
                    form.color === c ? "border-fg scale-110" : "border-transparent",
                  )}
                  style={{ background: c }}
                  aria-label={`Colour ${c}`}
                />
              ))}
            </div>
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={deletingNow}
        title="Delete this goal?"
        message={`${deleting?.name} will be removed. Money you already logged stays in your transactions.`}
      />
    </div>
  );
}

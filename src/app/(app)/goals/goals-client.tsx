"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
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
    color: "#0071e3",
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
    setForm({
      name: "",
      emoji: "🎯",
      color: "#0071e3",
      targetAmount: "",
      savedAmount: "",
      deadline: "",
      priority: "MEDIUM",
    });
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
    if (!form.name.trim()) return toast.error("Enter goal name");
    if (!target || target <= 0) return toast.error("Enter target amount");

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

    try {
      if (editing) {
        const res = await api.patch<{ goal: Goal }>(`/api/goals/${editing.id}`, payload);
        setGoals((prev) => prev.map((g) => (g.id === editing.id ? res.goal : g)));
        toast.success("Goal updated");
      } else {
        const res = await api.post<{ goal: Goal }>("/api/goals", payload);
        setGoals((prev) => [res.goal, ...prev]);
        toast.success("Goal created");
      }
      setModalOpen(false);
      router.refresh();
    } catch (e) {
      toast.error("Save failed", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const contribute = async (goal: Goal, delta: number) => {
    const nextSaved = Math.max(0, goal.savedAmount + delta);
    setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, savedAmount: nextSaved } : g)));
    setPendingId(goal.id);
    try {
      await api.patch(`/api/goals/${goal.id}`, { savedAmount: nextSaved });
      toast.success(
        delta > 0
          ? `+₹${delta} saved to ${goal.name}`
          : `Withdrew ₹${Math.abs(delta)} from ${goal.name}`,
      );
      router.refresh();
    } catch (e) {
      setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, savedAmount: goal.savedAmount } : g)));
      toast.error("Contribution failed", e instanceof Error ? e.message : undefined);
    } finally {
      setPendingId(null);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setDeletingNow(true);
    const id = deleting.id;
    try {
      await api.del(`/api/goals/${id}`);
      setGoals((prev) => prev.filter((g) => g.id !== id));
      toast.success("Goal deleted");
      setDeleting(null);
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
        <div className="flex items-center gap-3">
          {loading ? (
            <>
              <Skeleton className="h-5 w-32 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </>
          ) : (
            <>
              <p className="text-xs font-bold text-fg">
                <span className="tabular text-sm font-black text-primary">{goals.length}</span> Goals
              </p>
              <span className="text-xs text-muted">
                {formatMoney(totals.saved * 100)} saved of {formatMoney(totals.target * 100)}
              </span>
              <Badge tone="success">{Math.round(safePercent(totals.saved, totals.target))}% funded</Badge>
            </>
          )}
        </div>
        <Button onClick={openCreate} leftIcon={<Plus className="h-3.5 w-3.5" />} size="sm" className="text-xs">
          New Goal
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-3xl" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Target className="h-5 w-5" />}
            title="No savings goals"
            description="Create goals for trips, gadgets, or an emergency buffer."
            action={
              <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
                Create Goal
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {goals.map((g) => {
            const pct = safePercent(g.savedAmount, g.targetAmount);
            const remaining = Math.max(0, g.targetAmount - g.savedAmount);
            const days = g.deadline ? daysUntil(g.deadline) : null;
            const complete = pct >= 100;
            const pending = pendingId === g.id;

            return (
              <Card key={g.id} className={cn("animate-fade-up p-4.5 transition", pending && "opacity-70")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-lg shadow-sm border border-border/40"
                      style={{ background: `${g.color}20` }}
                    >
                      {g.emoji}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-fg">{g.name}</p>
                      <p className="flex items-center gap-1 text-[0.65rem] text-subtle">
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
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(g)} aria-label="Delete">
                      <Trash2 className="h-3 w-3 text-danger" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3.5">
                  <div className="flex items-end justify-between">
                    <p className="tabular text-xl font-black text-fg">{formatMoney(g.savedAmount * 100)}</p>
                    <p className="text-[0.65rem] text-subtle">of {formatMoney(g.targetAmount * 100)}</p>
                  </div>
                  <div className="mt-2">
                    <ProgressBar value={pct} tone={complete ? "success" : "primary"} height={6} />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[0.65rem]">
                    <span className="font-bold text-primary">{Math.round(pct)}% funded</span>
                    <span className="text-subtle">
                      {complete ? "Target reached 🎉" : `${formatMoney(remaining * 100)} to go`}
                    </span>
                  </div>
                </div>

                {/* Quick Add contribution buttons */}
                <div className="mt-3.5 flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
                  {QUICK_ADD.map((amount) => (
                    <Button
                      key={amount}
                      size="xs"
                      variant="secondary"
                      onClick={() => contribute(g, amount)}
                      disabled={pending}
                      className="text-xs h-7 px-2.5 font-bold"
                    >
                      +₹{amount}
                    </Button>
                  ))}
                  {g.savedAmount > 0 ? (
                    <Button
                      size="xs"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => void contribute(g, -Math.min(g.savedAmount, 100))}
                      className="text-xs h-7 px-2 text-subtle"
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
        title={editing ? "Edit Goal" : "New Goal"}
        description="Set a target and deadline"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} loading={saving}>
              Save
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5">
          <Field label="Goal Name" required>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Goa Trip"
            />
          </Field>

          <Field label="Target Amount (₹)" required>
            <Input
              type="number"
              min="1"
              value={form.targetAmount}
              onChange={(e) => setForm((f) => ({ ...f, targetAmount: e.target.value }))}
              placeholder="e.g. 10000"
              leftIcon={<span className="text-xs text-subtle">₹</span>}
            />
          </Field>

          <Field label="Already Saved (₹)">
            <Input
              type="number"
              min="0"
              value={form.savedAmount}
              onChange={(e) => setForm((f) => ({ ...f, savedAmount: e.target.value }))}
              placeholder="0"
              leftIcon={<span className="text-xs text-subtle">₹</span>}
            />
          </Field>

          <Field label="Target Date">
            <Input
              type="date"
              value={form.deadline}
              onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={deletingNow}
        title="Delete goal?"
        message={`Delete goal "${deleting?.name}"? Your logged transactions will not be altered.`}
      />
    </div>
  );
}

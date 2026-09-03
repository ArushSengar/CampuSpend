"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Cpu,
  Database,
  Download,
  Layers,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Badge, Skeleton } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { useAppData } from "@/components/providers/app-data";
import { api } from "@/lib/client/api";
import { useAsyncData } from "@/lib/client/use-async-data";
import { downloadFile } from "@/lib/client/download";
import { formatMoney } from "@/lib/money";
import { CATEGORY_COLORS } from "@/lib/taxonomy";
import { cn } from "@/lib/cn";

type Category = {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  color: string;
  kind: string;
  archived: boolean;
};

const EMOJI_CHOICES = [
  "🍛", "☕", "🛵", "🛒", "🚌", "🏠", "🎓", "📚", "📶", "🎬", "🛍️", "💊",
  "🎉", "🧳", "🎁", "🧺", "🧼", "🧾", "💰", "💼", "⏱️", "🏆", "↩️", "🧑‍💻",
];

export function SettingsClient() {
  const router = useRouter();
  const toast = useToast();
  const { user, categories, setCategories, reload } = useAppData();

  const [profile, setProfile] = useState({
    name: user.name,
    college: user.college ?? "",
    monthlyIncome: String(user.monthlyIncome),
    avatarHue: user.avatarHue,
  });
  const [savingProfile, setSavingProfile] = useState(false);

  const [catModal, setCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catForm, setCatForm] = useState({ name: "", emoji: "🧾", color: "#0071e3", kind: "EXPENSE" });
  const [catSaving, setCatSaving] = useState(false);
  const [deletingCat, setDeletingCat] = useState<Category | null>(null);

  const [dataAction, setDataAction] = useState<null | "load" | "reset" | "clear">(null);
  const [dataBusy, setDataBusy] = useState(false);

  const { data: aiStatus, loading: aiLoading } = useAsyncData<{ llmEnabled: boolean; label: string }>(
    "/api/ai/status",
    { llmEnabled: false, label: "Offline Rule Engine" },
  );
  const llmActive = aiStatus.llmEnabled;
  const engineLabel = aiLoading ? "Checking…" : aiStatus.label;

  const expenseCats = useMemo(() => categories.filter((c) => c.kind === "EXPENSE"), [categories]);
  const incomeCats = useMemo(() => categories.filter((c) => c.kind === "INCOME"), [categories]);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await api.patch("/api/user/profile", {
        name: profile.name,
        college: profile.college || null,
        monthlyIncome: Number(profile.monthlyIncome) || 0,
        avatarHue: profile.avatarHue,
      });
      toast.success("Profile saved");
      router.refresh();
    } catch (e) {
      toast.error("Save failed", e instanceof Error ? e.message : undefined);
    } finally {
      setSavingProfile(false);
    }
  };

  const openCat = (c?: Category) => {
    setEditingCat(c ?? null);
    setCatForm(
      c
        ? { name: c.name, emoji: c.emoji, color: c.color, kind: c.kind }
        : { name: "", emoji: "🧾", color: CATEGORY_COLORS[expenseCats.length % CATEGORY_COLORS.length], kind: "EXPENSE" },
    );
    setCatModal(true);
  };

  const saveCat = async () => {
    if (!catForm.name.trim()) return toast.error("Name the category");
    setCatSaving(true);
    try {
      if (editingCat) {
        const res = await api.patch<{ category: Category }>(`/api/categories/${editingCat.id}`, catForm);
        setCategories(categories.map((c) => (c.id === editingCat.id ? res.category : c)));
        toast.success("Category updated");
      } else {
        const res = await api.post<{ category: Category }>("/api/categories", catForm);
        setCategories([...categories, res.category]);
        toast.success("Category created");
      }
      setCatModal(false);
      await reload();
      router.refresh();
    } catch (e) {
      toast.error("Save failed", e instanceof Error ? e.message : undefined);
    } finally {
      setCatSaving(false);
    }
  };

  const toggleArchive = async (c: Category) => {
    const next = !c.archived;
    try {
      await api.patch(`/api/categories/${c.id}`, { archived: next });
      setCategories(categories.map((x) => (x.id === c.id ? { ...x, archived: next } : x)));
      toast.info(next ? "Category hidden" : "Category restored");
    } catch {
      toast.error("Could not update");
    }
  };

  const removeCat = async () => {
    if (!deletingCat) return;
    setDataBusy(true);
    try {
      await api.del(`/api/categories/${deletingCat.id}`);
      setCategories(categories.filter((c) => c.id !== deletingCat.id));
      toast.success("Category removed");
      setDeletingCat(null);
      await reload();
      router.refresh();
    } catch (e) {
      toast.error("Delete failed", e instanceof Error ? e.message : undefined);
    } finally {
      setDataBusy(false);
    }
  };

  const runDataAction = async () => {
    if (!dataAction) return;
    setDataBusy(true);
    try {
      if (dataAction === "load") {
        await api.post("/api/seed", { action: "load" });
        toast.success("Demo dataset loaded");
      } else if (dataAction === "reset") {
        await api.post("/api/seed", { action: "reset" });
        toast.success("Reset to demo data");
      } else {
        await api.post("/api/seed", { action: "clear" });
        toast.success("All data cleared");
      }
      setDataAction(null);
      await reload();
      router.refresh();
    } catch (e) {
      toast.error("Action failed", e instanceof Error ? e.message : undefined);
    } finally {
      setDataBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[84rem] space-y-5">
      {/* Profile */}
      <Card>
        <CardHeader title="Student Profile" subtitle="Your avatar & monthly budget target" icon={<User className="h-4 w-4" />} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3.5 sm:col-span-2">
            <span
              className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-xl font-black text-white shadow-md"
              style={{ background: `linear-gradient(135deg, hsl(${profile.avatarHue} 80% 55%), hsl(${profile.avatarHue + 40} 80% 45%))` }}
            >
              {profile.name ? profile.name.slice(0, 2).toUpperCase() : "ME"}
            </span>
            <div className="flex-1 space-y-1">
              <p className="text-xs font-bold text-fg">Avatar Accent Color</p>
              <input
                type="range"
                min="0"
                max="360"
                value={profile.avatarHue}
                onChange={(e) => setProfile((p) => ({ ...p, avatarHue: Number(e.target.value) }))}
                className="h-2 w-full max-w-xs cursor-pointer appearance-none rounded-full bg-gradient-to-r from-red-500 via-green-500 via-blue-500 to-red-500"
                aria-label="Avatar colour"
              />
            </div>
          </div>

          <Field label="Name">
            <Input value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} />
          </Field>
          <Field label="College / Campus">
            <Input value={profile.college} onChange={(e) => setProfile((p) => ({ ...p, college: e.target.value }))} placeholder="IIT Bombay / BITS Pilani" />
          </Field>
          <Field label="Expected Monthly Budget (₹)" hint="Pocket money + allowance">
            <Input
              type="number"
              min="0"
              value={profile.monthlyIncome}
              onChange={(e) => setProfile((p) => ({ ...p, monthlyIncome: e.target.value }))}
              leftIcon={<span className="text-xs text-subtle">₹</span>}
            />
          </Field>
          <div className="flex items-end">
            <p className="pb-1 text-xs text-muted">
              Current budget base: <span className="font-bold text-fg">{formatMoney(Number(profile.monthlyIncome || 0) * 100)}</span>/mo
            </p>
          </div>

          <div className="sm:col-span-2 pt-1">
            <Button size="sm" onClick={saveProfile} loading={savingProfile} leftIcon={<Check className="h-3.5 w-3.5" />} className="text-xs">
              Save Profile
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader
          title="Categories"
          subtitle="Taxonomy used by the AI engine"
          icon={<Layers className="h-4 w-4" />}
          action={
            <Button size="xs" onClick={() => openCat()} leftIcon={<Plus className="h-3.5 w-3.5" />} className="text-xs">
              Add Category
            </Button>
          }
        />
        <CardBody className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-subtle">Expense Categories</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {expenseCats.map((c) => (
                <CategoryRow key={c.id} c={c} onEdit={() => openCat(c)} onDelete={() => setDeletingCat(c)} onArchive={() => toggleArchive(c)} />
              ))}
              {!expenseCats.length ? <Skeleton className="h-10 rounded-2xl" /> : null}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-subtle">Income Categories</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {incomeCats.map((c) => (
                <CategoryRow key={c.id} c={c} onEdit={() => openCat(c)} onDelete={() => setDeletingCat(c)} onArchive={() => toggleArchive(c)} />
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* AI Engine */}
      <Card>
        <CardHeader title="AI Engine" subtitle="Natural language parser configuration" icon={<Cpu className="h-4 w-4" />} />
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/80 bg-surface-2/60 p-3.5">
            <span className="grid h-8.5 w-8.5 place-items-center rounded-xl bg-primary-soft text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-fg">{engineLabel}</p>
              <p className="text-[0.68rem] text-muted">
                {llmActive
                  ? "Cloud LLM active with offline rule engine fallback."
                  : "On-device Hinglish parser. Fast, offline, zero data leaves your machine."}
              </p>
            </div>
            <Badge tone={llmActive ? "primary" : "success"}>{llmActive ? "LLM Active" : "On-Device"}</Badge>
          </div>
        </CardBody>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader title="Data & Storage" subtitle="Export or reset records" icon={<Database className="h-4 w-4" />} />
        <CardBody className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-surface-2/40 p-3.5">
            <div>
              <p className="text-xs font-bold text-fg">Export CSV</p>
              <p className="text-[0.68rem] text-muted">Download all logged transactions.</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => downloadFile("/api/export")}
              leftIcon={<Download className="h-3.5 w-3.5" />}
              className="text-xs"
            >
              Export
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-surface-2/40 p-3.5">
            <div>
              <p className="text-xs font-bold text-fg">Load Demo Dataset</p>
              <p className="text-[0.68rem] text-muted">Add realistic semester spending samples.</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setDataAction("load")} leftIcon={<Sparkles className="h-3.5 w-3.5" />} className="text-xs">
              Load Demo
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-surface-2/40 p-3.5">
            <div>
              <p className="text-xs font-bold text-fg">Reset to Demo</p>
              <p className="text-[0.68rem] text-muted">Wipe current ledger and load fresh demo set.</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setDataAction("reset")} leftIcon={<RefreshCw className="h-3.5 w-3.5" />} className="text-xs">
              Reset
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/40 bg-danger-soft/30 p-3.5">
            <div>
              <p className="text-xs font-bold text-fg">Clear All Transactions</p>
              <p className="text-[0.68rem] text-muted">Removes all entries, budgets, and goals.</p>
            </div>
            <Button variant="danger" size="sm" onClick={() => setDataAction("clear")} leftIcon={<Trash2 className="h-3.5 w-3.5" />} className="text-xs">
              Clear All
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Category Modal */}
      <Modal
        open={catModal}
        onClose={() => setCatModal(false)}
        title={editingCat ? "Edit Category" : "New Category"}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCatModal(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={saveCat} loading={catSaving}>
              {editingCat ? "Save" : "Create"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5">
          <Field label="Name" required>
            <Input autoFocus value={catForm.name} onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))} placeholder="Society Fees" />
          </Field>

          <Field label="Type">
            <Select value={catForm.kind} onChange={(e) => setCatForm((f) => ({ ...f, kind: e.target.value }))}>
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
            </Select>
          </Field>

          <Field label="Emoji">
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
              {EMOJI_CHOICES.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setCatForm((f) => ({ ...f, emoji: e }))}
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-xl border text-base transition pressable",
                    catForm.emoji === e ? "border-primary bg-primary-soft" : "border-border/80 bg-surface-2/60 hover:bg-surface-3",
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingCat)}
        onClose={() => setDeletingCat(null)}
        onConfirm={removeCat}
        loading={dataBusy}
        title="Delete category?"
        message="Transactions under this category will become uncategorized."
      />

      <ConfirmDialog
        open={Boolean(dataAction)}
        onClose={() => setDataAction(null)}
        onConfirm={runDataAction}
        loading={dataBusy}
        title={
          dataAction === "clear"
            ? "Clear all data?"
            : dataAction === "reset"
              ? "Reset to demo dataset?"
              : "Load demo data?"
        }
        message={
          dataAction === "clear"
            ? "Every transaction, budget, and goal will be deleted."
            : dataAction === "reset"
              ? "Your data will be replaced with fresh student demo data."
              : "Demo transactions will be added to your current ledger."
        }
        confirmLabel={dataAction === "clear" ? "Clear" : dataAction === "reset" ? "Reset" : "Load Demo"}
      />
    </div>
  );
}

function CategoryRow({
  c,
  onEdit,
  onDelete,
  onArchive,
}: {
  c: Category;
  onEdit: () => void;
  onDelete: () => void;
  onArchive: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-2xl border border-border/80 bg-surface-2/60 px-3 py-2 transition hover:border-border",
        c.archived && "opacity-50",
      )}
    >
      <span
        className="grid h-7.5 w-7.5 shrink-0 place-items-center rounded-xl text-sm shadow-sm"
        style={{ background: `${c.color}25` }}
      >
        {c.emoji}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs font-bold text-fg">{c.name}</span>
      {c.archived ? <Badge tone="neutral">hidden</Badge> : null}
      <div className="flex shrink-0 gap-0.5 opacity-0 transition group-hover:opacity-100">
        <Button variant="ghost" size="icon-sm" onClick={onArchive} title={c.archived ? "Unhide" : "Hide"}>
          {c.archived ? <RefreshCw className="h-3 w-3" /> : <LoaderCircle className="h-3 w-3 rotate-45" />}
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onEdit} title="Edit">
          <Pencil className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onDelete} title="Delete">
          <Trash2 className="h-3 w-3 text-danger" />
        </Button>
      </div>
    </div>
  );
}

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
  const [catForm, setCatForm] = useState({ name: "", emoji: "🧾", color: "#6366f1", kind: "EXPENSE" });
  const [catSaving, setCatSaving] = useState(false);
  const [deletingCat, setDeletingCat] = useState<Category | null>(null);

  const [dataAction, setDataAction] = useState<null | "load" | "reset" | "clear">(null);
  const [dataBusy, setDataBusy] = useState(false);

  const { data: aiStatus, loading: aiLoading } = useAsyncData<{ llmEnabled: boolean; label: string }>("/api/ai/status", { llmEnabled: false, label: "Offline rule engine" });
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
      toast.error("Couldn't save profile", e instanceof Error ? e.message : undefined);
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
    const payload = { name: catForm.name.trim(), emoji: catForm.emoji, color: catForm.color, kind: catForm.kind };
    try {
      if (editingCat) {
        const res = await api.patch<{ category: Category }>(`/api/categories/${editingCat.id}`, payload);
        setCategories(categories.map((c) => (c.id === editingCat.id ? res.category : c)));
      } else {
        const res = await api.post<{ category: Category }>("/api/categories", payload);
        setCategories([...categories, res.category]);
      }
      toast.success(editingCat ? "Category updated" : "Category created");
      setCatModal(false);
      await reload();
      router.refresh();
    } catch (e) {
      toast.error("Couldn't save category", e instanceof Error ? e.message : undefined);
    } finally {
      setCatSaving(false);
    }
  };

  const toggleArchive = async (c: Category) => {
    setCategories(categories.map((x) => (x.id === c.id ? { ...x, archived: !x.archived } : x)));
    try {
      await api.patch(`/api/categories/${c.id}`, { archived: !c.archived });
      await reload();
    } catch (e) {
      setCategories(categories);
      toast.error("Couldn't update", e instanceof Error ? e.message : undefined);
    }
  };

  const removeCat = async () => {
    if (!deletingCat) return;
    setDataBusy(true);
    try {
      await api.del(`/api/categories/${deletingCat.id}`);
      setCategories(categories.filter((c) => c.id !== deletingCat.id));
      toast.success("Category deleted");
      setDeletingCat(null);
      await reload();
      router.refresh();
    } catch (e) {
      toast.error("Couldn't delete", e instanceof Error ? e.message : undefined);
    } finally {
      setDataBusy(false);
    }
  };

  const runDataAction = async () => {
    if (!dataAction) return;
    setDataBusy(true);
    try {
      const res = await api.post<{ transactions?: number }>("/api/demo", { action: dataAction });
      toast.success(
        dataAction === "clear" ? "All data cleared" : "Demo data loaded",
        res.transactions ? `${res.transactions} transactions` : undefined,
      );
      setDataAction(null);
      await reload();
      router.refresh();
    } catch (e) {
      toast.error("That didn't work", e instanceof Error ? e.message : undefined);
    } finally {
      setDataBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[72rem] space-y-4">
      {/* --------------------------------- profile -------------------------------- */}
      <Card>
        <CardHeader title="Profile" subtitle="How CampuSpend addresses you and budgets your month" icon={<User className="h-4 w-4" />} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-4 sm:col-span-2">
            <span
              className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-xl font-bold text-white"
              style={{
                background: `linear-gradient(135deg, hsl(${profile.avatarHue} 78% 58%), hsl(${profile.avatarHue + 40} 74% 52%))`,
              }}
            >
              {profile.name.slice(0, 1).toUpperCase() || "C"}
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-fg">{profile.name || "Your name"}</p>
              <p className="text-xs text-muted">{user.email}</p>
              <input
                type="range"
                min="0"
                max="360"
                value={profile.avatarHue}
                onChange={(e) => setProfile((p) => ({ ...p, avatarHue: Number(e.target.value) }))}
                className="mt-2 w-full max-w-[14rem] accent-[var(--primary)]"
                aria-label="Avatar colour"
              />
            </div>
          </div>

          <Field label="Name">
            <Input value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} />
          </Field>
          <Field label="College">
            <Input value={profile.college} onChange={(e) => setProfile((p) => ({ ...p, college: e.target.value }))} placeholder="NIT Trichy" />
          </Field>
          <Field label="Expected monthly income" hint="pocket money + stipend">
            <Input
              type="number"
              min="0"
              value={profile.monthlyIncome}
              onChange={(e) => setProfile((p) => ({ ...p, monthlyIncome: e.target.value }))}
              leftIcon={<span className="text-sm font-semibold text-subtle">₹</span>}
            />
          </Field>
          <div className="flex items-end">
            <p className="pb-2 text-xs text-muted">
              Used for savings-rate maths and “can I afford this?” answers. Currently{" "}
              <span className="font-semibold text-fg">{formatMoney(Number(profile.monthlyIncome || 0) * 100)}</span>/month.
            </p>
          </div>

          <div className="sm:col-span-2">
            <Button onClick={saveProfile} loading={savingProfile} leftIcon={<Check className="h-4 w-4" />}>
              Save profile
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* -------------------------------- categories ------------------------------- */}
      <Card>
        <CardHeader
          title="Categories"
          subtitle="The AI parser learns from these — rename or add your own"
          icon={<Layers className="h-4 w-4" />}
          action={
            <Button size="sm" onClick={() => openCat()} leftIcon={<Plus className="h-4 w-4" />}>
              Add
            </Button>
          }
        />
        <CardBody className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">Expense</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {expenseCats.map((c) => (
                <CategoryRow key={c.id} c={c} onEdit={() => openCat(c)} onDelete={() => setDeletingCat(c)} onArchive={() => toggleArchive(c)} />
              ))}
              {!expenseCats.length ? <Skeleton className="h-12" /> : null}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">Income</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {incomeCats.map((c) => (
                <CategoryRow key={c.id} c={c} onEdit={() => openCat(c)} onDelete={() => setDeletingCat(c)} onArchive={() => toggleArchive(c)} />
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ----------------------------------- AI ------------------------------------ */}
      <Card>
        <CardHeader title="AI engine" subtitle="How your sentences get parsed" icon={<Cpu className="h-4 w-4" />} />
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-2 p-3.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-fg">
                {engineLabel}
              </p>
              <p className="text-xs text-muted">
                {llmActive
                  ? "Your own API key is configured — messy Hinglish gets a second pass from the model."
                  : "A layered Hinglish-tuned parser that runs on your machine. No key, no network, no data leaving the app."}
              </p>
            </div>
            <Badge tone={llmActive ? "primary" : "success"}>{llmActive ? "LLM" : "Local"}</Badge>
          </div>

          <div className="rounded-xl border border-border p-3.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-subtle">What it understands</p>
            <ul className="mt-2 grid gap-1.5 text-xs text-muted sm:grid-cols-2">
              {[
                ["Amounts", "rs 100 · ₹100 · 1.2k · 500 ka · 100/-"],
                ["Dates", "aaj · kal · parso · last friday · 12 aug"],
                ["Direction", "got / received / mom sent → income"],
                ["Method", "upi · gpay · phonepe · cash · card"],
                ["Merchants", "zomato · auto · irctc · netflix · canteen"],
                ["Learning", "remembers how you filed a merchant before"],
              ].map(([k, v]) => (
                <li key={k} className="flex gap-2">
                  <span className="font-semibold text-fg">{k}:</span>
                  <span>{v}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-border pt-2.5 text-[0.7rem] text-subtle">
              Optional upgrade: set <code className="rounded bg-surface-2 px-1">OPENAI_API_KEY</code> or{" "}
              <code className="rounded bg-surface-2 px-1">GEMINI_API_KEY</code> in <code className="rounded bg-surface-2 px-1">.env</code>{" "}
              and restart. The rule engine still validates every number the model returns.
            </p>
          </div>
        </CardBody>
      </Card>

      {/* ----------------------------------- data ---------------------------------- */}
      <Card>
        <CardHeader title="Your data" subtitle="Export, reseed or wipe" icon={<Database className="h-4 w-4" />} />
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3.5">
            <div>
              <p className="text-sm font-semibold text-fg">Export to CSV</p>
              <p className="text-xs text-muted">Every transaction with category, method and account.</p>
            </div>
            <Button
              variant="secondary"
              onClick={() => downloadFile("/api/export")}
              leftIcon={<Download className="h-4 w-4" />}
            >
              Download
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3.5">
            <div>
              <p className="text-sm font-semibold text-fg">Load demo data</p>
              <p className="text-xs text-muted">Adds ~5 months of realistic student spending on top of what you have.</p>
            </div>
            <Button variant="secondary" onClick={() => setDataAction("load")} leftIcon={<Sparkles className="h-4 w-4" />}>
              Load demo
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3.5">
            <div>
              <p className="text-sm font-semibold text-fg">Reset to demo</p>
              <p className="text-xs text-muted">Deletes your transactions, budgets and goals, then reloads the demo set.</p>
            </div>
            <Button variant="secondary" onClick={() => setDataAction("reset")} leftIcon={<RefreshCw className="h-4 w-4" />}>
              Reset
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/40 bg-danger-soft/40 p-3.5">
            <div>
              <p className="text-sm font-semibold text-fg">Delete everything</p>
              <p className="text-xs text-muted">Keeps your account and categories, removes all transactions and goals.</p>
            </div>
            <Button variant="danger" onClick={() => setDataAction("clear")} leftIcon={<Trash2 className="h-4 w-4" />}>
              Clear data
            </Button>
          </div>
        </CardBody>
      </Card>

      <p className="pb-4 text-center text-[0.7rem] text-subtle">
        CampuSpend · built for students who lose track of ₹20 at a time.
      </p>

      {/* ---------------------------------- modals -------------------------------- */}
      <Modal
        open={catModal}
        onClose={() => setCatModal(false)}
        title={editingCat ? "Edit category" : "New category"}
        icon={<Layers className="h-4 w-4" />}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCatModal(false)}>
              Cancel
            </Button>
            <Button onClick={saveCat} loading={catSaving}>
              {editingCat ? "Save changes" : "Create category"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Name" required>
            <Input autoFocus value={catForm.name} onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))} placeholder="Society fees" />
          </Field>

          <Field label="Type">
            <Select value={catForm.kind} onChange={(e) => setCatForm((f) => ({ ...f, kind: e.target.value }))}>
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
            </Select>
          </Field>

          <Field label="Emoji">
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_CHOICES.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setCatForm((f) => ({ ...f, emoji: e }))}
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-xl border text-lg transition",
                    catForm.emoji === e ? "border-primary bg-primary-soft" : "border-border bg-surface-2 hover:bg-surface-3",
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Colour">
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCatForm((f) => ({ ...f, color: c }))}
                  className={cn("h-8 w-8 rounded-lg border-2 transition", catForm.color === c ? "scale-110 border-fg" : "border-transparent")}
                  style={{ background: c }}
                  aria-label={`Colour ${c}`}
                />
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
        title="Delete this category?"
        message="Transactions filed under it become uncategorised — the money itself is untouched."
      />

      <ConfirmDialog
        open={Boolean(dataAction)}
        onClose={() => setDataAction(null)}
        onConfirm={runDataAction}
        loading={dataBusy}
        title={
          dataAction === "clear"
            ? "Delete all your data?"
            : dataAction === "reset"
              ? "Reset to the demo dataset?"
              : "Load demo data?"
        }
        message={
          dataAction === "clear"
            ? "Every transaction, budget and goal will be removed. This can't be undone."
            : dataAction === "reset"
              ? "Your transactions will be replaced with the demo student's spending history."
              : "Demo transactions will be added alongside your existing ones."
        }
        confirmLabel={dataAction === "clear" ? "Delete everything" : dataAction === "reset" ? "Reset" : "Load demo"}
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
    <div className={cn("group flex items-center gap-2.5 rounded-xl border border-border bg-surface-2 px-3 py-2", c.archived && "opacity-50")}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-base" style={{ background: `${c.color}22` }}>
        {c.emoji}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{c.name}</span>
      {c.archived ? <Badge tone="neutral">hidden</Badge> : null}
      <div className="flex shrink-0 gap-0.5 opacity-0 transition group-hover:opacity-100">
        <Button variant="ghost" size="icon-sm" onClick={onArchive} title={c.archived ? "Unhide" : "Hide"}>
          {c.archived ? <RefreshCw className="h-3 w-3" /> : <LoaderCircle className="h-3 w-3 rotate-45" />}
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onEdit} title="Edit">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onDelete} title="Delete">
          <Trash2 className="h-3.5 w-3.5 text-danger" />
        </Button>
      </div>
    </div>
  );
}

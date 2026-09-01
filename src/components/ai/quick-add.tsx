"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Banknote, Check, Landmark, LoaderCircle, Sparkles, Wallet, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Segmented } from "@/components/ui/input";
import { Badge } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { useAppData } from "@/components/providers/app-data";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { toDateInput } from "@/lib/dates";

export type ParseResult = {
  amount: number | null;
  type: "EXPENSE" | "INCOME";
  method: string;
  categoryId: string | null;
  categorySlug: string | null;
  merchant: string | null;
  note: string;
  title: string;
  occurredAt: string;
  confidence: number;
  reasons: string[];
  missing: string[];
  rawText: string;
};

const EXAMPLES = [
  "chai 20 yesterday",
  "paid 250 to mess via upi",
  "mom sent 5000",
  "zomato 350 kal",
  "auto 60 cash aaj",
  "netflix 199 subscription",
];

const METHODS = [
  { value: "UPI", label: "UPI", icon: Wallet },
  { value: "CASH", label: "Cash", icon: Banknote },
  { value: "CARD", label: "Card", icon: Landmark },
  { value: "BANK", label: "Bank", icon: Landmark },
];

export function AiQuickAdd({
  variant = "hero",
  onSaved,
}: {
  variant?: "hero" | "compact";
  onSaved?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const { expenseCategories, incomeCategories, accounts, defaultAccountId, categories } = useAppData();

  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [results, setResults] = useState<(ParseResult & { accountId: string | null; done?: boolean })[]>([]);
  const [engine, setEngine] = useState<string>("local-rules");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const parsed = results.length > 0;

  const runParse = async (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setParsing(true);
    setError(null);
    try {
      const data = await api.post<{ results: ParseResult[]; engine: string }>("/api/ai/parse", { text: value });
      setEngine(data.engine);
      setResults(
        data.results.map((r) => ({
          ...r,
          accountId: accounts.find((a) => a.type === r.method)?.id ?? defaultAccountId,
        })),
      );
      if (data.results.length === 0) setError("Couldn't read that. Try “chai 20 yesterday”.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Parsing failed");
    } finally {
      setParsing(false);
    }
  };

  const update = (index: number, patch: Partial<ParseResult & { accountId: string | null }>) => {
    setResults((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const removeDraft = (index: number) => setResults((prev) => prev.filter((_, i) => i !== index));

  const saveAll = async () => {
    const valid = results.filter((r) => (r.amount ?? 0) > 0);
    if (!valid.length) {
      setError("Add an amount before saving.");
      return;
    }
    let saved = 0;
    for (let i = 0; i < valid.length; i++) {
      const r = valid[i];
      try {
        await api.post("/api/transactions", {
          amount: r.amount,
          type: r.type,
          method: r.method,
          categoryId: r.categoryId,
          accountId: r.accountId,
          merchant: r.merchant || null,
          note: r.note || null,
          occurredAt: r.occurredAt,
          source: "AI",
          rawText: r.rawText,
          confidence: r.confidence,
        });
        saved += 1;
        setResults((prev) => prev.map((x) => (x === r ? { ...x, done: true } : x)));
      } catch (e) {
        toast.error("Couldn't save one entry", e instanceof Error ? e.message : undefined);
        setResults((prev) => prev.map((x) => (x === r ? { ...x } : x)));
      }
    }
    if (saved > 0) {
      toast.success(
        saved === 1 ? "Saved 1 transaction" : `Saved ${saved} transactions`,
        "Filed automatically by the AI parser.",
      );
      setText("");
      setResults([]);
      startTransition(() => {
        router.refresh();
        onSaved?.();
      });
    }
  };

  const hero = variant === "hero";

  return (
    <div
      className={cn(
        "rounded-card border border-border bg-surface/80 backdrop-blur",
        hero ? "shadow-card" : "",
      )}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!parsed) void runParse(text);
          else void saveAll();
        }}
        className={cn("flex items-center gap-2", hero ? "p-2.5" : "p-1.5")}
      >
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-white",
            hero ? "h-10 w-10" : "h-8 w-8",
          )}
        >
          {parsing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        </span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !parsed) e.preventDefault();
          }}
          placeholder="Say it naturally — “bought chai rs 100”, “auto 50 cash yesterday”"
          aria-label="Describe a transaction in plain language"
          className={cn(
            "min-w-0 flex-1 bg-transparent text-fg placeholder:text-subtle focus:outline-none",
            hero ? "h-10 text-[0.95rem]" : "h-8 text-sm",
          )}
        />
        {text && !parsed ? (
          <Button type="button" size={hero ? "md" : "sm"} variant="primary" onClick={() => runParse(text)} loading={parsing}>
            <Zap className="h-4 w-4" />
            Parse
          </Button>
        ) : null}
        {parsed ? (
          <>
            <Button type="button" size={hero ? "md" : "sm"} variant="ghost" onClick={() => setResults([])}>
              Reset
            </Button>
            <Button type="button" size={hero ? "md" : "sm"} variant="success" onClick={saveAll} loading={pending}>
              <Check className="h-4 w-4" />
              Save {results.length > 1 ? results.length : ""}
            </Button>
          </>
        ) : null}
      </form>

      {!parsed && !parsing ? (
        <div className={cn("flex flex-wrap items-center gap-1.5 border-t border-border px-3 py-2.5", hero ? "" : "hidden")}>
          <span className="mr-1 text-[0.7rem] font-medium uppercase tracking-wider text-subtle">Try</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setText(ex);
                void runParse(ex);
              }}
              className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs text-muted transition hover:border-primary/40 hover:bg-primary-soft hover:text-primary"
            >
              {ex}
            </button>
          ))}
        </div>
      ) : null}

      {error ? <p className="border-t border-border px-4 py-2 text-xs text-danger">{error}</p> : null}

      {parsed ? (
        <div className="space-y-2 border-t border-border p-3">
          <div className="flex items-center justify-between px-1">
            <p className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-wider text-subtle">
              <Sparkles className="h-3 w-3 text-primary" />
              {results.length} parsed · {engine === "llm+rules" ? "LLM + rules" : "offline engine"}
            </p>
            <p className="text-[0.7rem] text-subtle">Edit anything, then save</p>
          </div>
          {results.map((r, i) => {
            const cat = categories.find((c) => c.id === r.categoryId);
            const list = r.type === "INCOME" ? incomeCategories : expenseCategories;
            return (
              <div
                key={`${r.rawText}-${i}`}
                className={cn(
                  "animate-fade-up rounded-xl border bg-surface-2/60 p-3 transition",
                  r.done ? "border-success/40 opacity-60" : "border-border",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "grid h-8 w-8 place-items-center rounded-lg text-base",
                        r.type === "INCOME" ? "bg-success-soft" : "bg-surface-3",
                      )}
                    >
                      {cat?.emoji ?? (r.type === "INCOME" ? "💰" : "🧾")}
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={r.amount ?? ""}
                      onChange={(e) => update(i, { amount: e.target.value ? Number(e.target.value) : null })}
                      className="h-8 w-24 tabular text-sm font-semibold"
                      leftIcon={<span className="text-xs text-subtle">₹</span>}
                    />
                  </div>

                  <Segmented
                    size="sm"
                    value={r.type}
                    onChange={(v) => update(i, { type: v })}
                    options={[
                      { value: "EXPENSE", label: "Expense" },
                      { value: "INCOME", label: "Income" },
                    ]}
                  />

                  <Segmented
                    size="sm"
                    value={r.method}
                    onChange={(v) => update(i, { method: v })}
                    options={METHODS.map((m) => ({ value: m.value, label: m.label }))}
                  />

                  <div className="ml-auto flex items-center gap-2">
                    <Badge tone={r.confidence >= 0.8 ? "success" : r.confidence >= 0.6 ? "warning" : "neutral"}>
                      {Math.round(r.confidence * 100)}% sure
                    </Badge>
                    <button
                      type="button"
                      onClick={() => removeDraft(i)}
                      className="grid h-7 w-7 place-items-center rounded-lg text-subtle transition hover:bg-surface-3 hover:text-danger"
                      aria-label="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <Select
                    value={r.categoryId ?? ""}
                    onChange={(e) => update(i, { categoryId: e.target.value || null })}
                    className="h-9 text-sm"
                  >
                    <option value="">No category</option>
                    {list.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emoji} {c.name}
                      </option>
                    ))}
                  </Select>
                  <Input
                    value={r.merchant ?? ""}
                    onChange={(e) => update(i, { merchant: e.target.value })}
                    placeholder="Merchant"
                    className="h-9 text-sm"
                  />
                  <Input
                    type="date"
                    value={toDateInput(r.occurredAt)}
                    onChange={(e) => update(i, { occurredAt: new Date(`${e.target.value}T12:00:00`).toISOString() })}
                    className="h-9 text-sm"
                  />
                </div>

                {r.note ? (
                  <Input
                    value={r.note}
                    onChange={(e) => update(i, { note: e.target.value })}
                    placeholder="Note"
                    className="mt-2 h-9 text-sm"
                  />
                ) : null}

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.reasons.slice(0, 4).map((reason) => (
                    <span
                      key={reason}
                      className="inline-flex items-center gap-1 rounded-md bg-surface-3 px-1.5 py-0.5 text-[0.65rem] text-muted"
                    >
                      <ArrowUpRight className="h-2.5 w-2.5" />
                      {reason}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

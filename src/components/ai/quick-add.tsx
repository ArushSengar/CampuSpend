"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Camera,
  Check,
  LoaderCircle,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Segmented } from "@/components/ui/input";
import { Badge } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { useAppData } from "@/components/providers/app-data";
import { ReceiptScannerModal, type ParsedReceipt } from "@/components/ai/receipt-scanner";
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
  "mess 250 upi",
  "mom sent 5000",
  "zomato 350 kal",
  "auto 60 cash",
  "netflix 199",
];

const METHODS = [
  { value: "UPI", label: "UPI" },
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "BANK", label: "Bank" },
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
  const { expenseCategories, incomeCategories, accounts, defaultAccountId, categories } =
    useAppData();

  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [results, setResults] = useState<
    (ParseResult & { accountId: string | null; done?: boolean })[]
  >([]);
  const [engine, setEngine] = useState<string>("local-rules");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const parsed = results.length > 0;

  const handleReceiptExtracted = (receipt: ParsedReceipt) => {
    const rawSentence = `${receipt.merchant ?? "expense"} ${receipt.amount ?? ""} ${receipt.method.toLowerCase()} today`;
    setText(rawSentence);
    void runParse(rawSentence);
  };

  const runParse = async (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setParsing(true);
    setError(null);
    try {
      const data = await api.post<{ results: ParseResult[]; engine: string }>("/api/ai/parse", {
        text: value,
      });
      setEngine(data.engine);
      setResults(
        data.results.map((r) => ({
          ...r,
          accountId: accounts.find((a) => a.type === r.method)?.id ?? defaultAccountId,
        })),
      );
      if (data.results.length === 0) setError("Could not parse. Try “chai 20 yesterday”.");
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
      setError("Please add an amount.");
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
        toast.error("Save failed", e instanceof Error ? e.message : undefined);
        setResults((prev) => prev.map((x) => (x === r ? { ...x } : x)));
      }
    }
    if (saved > 0) {
      toast.success(saved === 1 ? "Logged 1 entry" : `Logged ${saved} entries`);
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
        "rounded-3xl border border-border/80 bg-surface/85 backdrop-blur-2xl shadow-card transition-all duration-200 overflow-hidden",
      )}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!parsed) void runParse(text);
          else void saveAll();
        }}
        className={cn("flex items-center gap-2.5", hero ? "p-3" : "p-2")}
      >
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-md shadow-primary/20",
            hero ? "h-9.5 w-9.5" : "h-8 w-8",
          )}
        >
          {parsing ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
        </span>

        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (!parsed) {
                if (text.trim()) void runParse(text);
              } else {
                void saveAll();
              }
            }
          }}
          placeholder="Natural input — “chai 20”, “zomato 350 yesterday”, “mom sent 5000”"
          aria-label="Describe a transaction"
          className={cn(
            "min-w-0 flex-1 bg-transparent text-fg font-medium placeholder:text-subtle focus:outline-none",
            hero ? "h-9.5 text-sm" : "h-8 text-xs",
          )}
        />

        {!text && !parsed ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setScannerOpen(true)}
            className="flex items-center gap-1.5 text-muted hover:text-fg text-xs"
            title="Scan bill or UPI screenshot"
          >
            <Camera className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Scan Bill</span>
          </Button>
        ) : null}

        {text && !parsed ? (
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={() => runParse(text)}
            loading={parsing}
            className="h-8.5 px-4 text-xs font-semibold"
          >
            <Zap className="h-3.5 w-3.5" />
            Parse
          </Button>
        ) : null}

        {parsed ? (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setResults([])}
              className="text-xs"
            >
              Reset
            </Button>
            <Button
              type="button"
              size="sm"
              variant="success"
              onClick={saveAll}
              loading={pending}
              className="h-8.5 px-4 text-xs font-semibold"
            >
              <Check className="h-3.5 w-3.5" />
              Save {results.length > 1 ? results.length : ""}
            </Button>
          </div>
        ) : null}
      </form>

      <ReceiptScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onExtracted={handleReceiptExtracted}
      />

      {!parsed && !parsing && hero ? (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-t border-border/60 bg-surface-2/30 px-3.5 py-2">
          <span className="mr-1 shrink-0 text-[0.65rem] font-bold uppercase tracking-wider text-subtle">
            Try
          </span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setText(ex);
                void runParse(ex);
              }}
              className="shrink-0 whitespace-nowrap rounded-full border border-border/70 bg-surface-2/80 px-2.5 py-0.5 text-[0.7rem] font-medium text-muted transition hover:border-primary/40 hover:bg-primary-soft hover:text-primary pressable"
            >
              {ex}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="border-t border-border/60 px-4 py-2 text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}

      {parsed ? (
        <div className="space-y-2 border-t border-border/60 p-3.5 bg-surface-2/20">
          <div className="flex items-center justify-between px-1">
            <p className="flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-subtle">
              <Sparkles className="h-3 w-3 text-primary" />
              {results.length} entry parsed · {engine === "llm+rules" ? "AI + Rules" : "Offline"}
            </p>
            <p className="text-[0.65rem] text-subtle">Tap to edit before saving</p>
          </div>

          {results.map((r, i) => {
            const cat = categories.find((c) => c.id === r.categoryId);
            const list = r.type === "INCOME" ? incomeCategories : expenseCategories;
            return (
              <div
                key={`${r.rawText}-${i}`}
                className={cn(
                  "animate-fade-up rounded-2xl border bg-surface/90 backdrop-blur p-3 transition",
                  r.done ? "border-success/50 opacity-60" : "border-border/80 shadow-sm",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "grid h-8 w-8 place-items-center rounded-xl text-sm shadow-sm",
                        r.type === "INCOME" ? "bg-success-soft" : "bg-surface-2",
                      )}
                    >
                      {cat?.emoji ?? (r.type === "INCOME" ? "💰" : "🧾")}
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={r.amount ?? ""}
                      onChange={(e) =>
                        update(i, { amount: e.target.value ? Number(e.target.value) : null })
                      }
                      className="h-8.5 w-24 tabular text-xs font-bold"
                      leftIcon={<span className="text-xs font-semibold text-subtle">₹</span>}
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
                    <Badge
                      tone={
                        r.confidence >= 0.8
                          ? "success"
                          : r.confidence >= 0.6
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {Math.round(r.confidence * 100)}%
                    </Badge>
                    <button
                      type="button"
                      onClick={() => removeDraft(i)}
                      className="grid h-7 w-7 place-items-center rounded-full text-subtle transition hover:bg-surface-3 hover:text-danger pressable"
                      aria-label="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
                  <Select
                    value={r.categoryId ?? ""}
                    onChange={(e) => update(i, { categoryId: e.target.value || null })}
                    className="h-8.5 text-xs"
                  >
                    <option value="">Select Category</option>
                    {list.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emoji} {c.name}
                      </option>
                    ))}
                  </Select>
                  <Input
                    value={r.merchant ?? ""}
                    onChange={(e) => update(i, { merchant: e.target.value })}
                    placeholder="Merchant / Place"
                    className="h-8.5 text-xs"
                  />
                  <Input
                    type="date"
                    value={toDateInput(r.occurredAt)}
                    onChange={(e) =>
                      update(i, {
                        occurredAt: new Date(`${e.target.value}T12:00:00`).toISOString(),
                      })
                    }
                    className="h-8.5 text-xs"
                  />
                </div>

                {r.note ? (
                  <Input
                    value={r.note}
                    onChange={(e) => update(i, { note: e.target.value })}
                    placeholder="Note"
                    className="mt-2 h-8.5 text-xs"
                  />
                ) : null}

                <div className="mt-2 flex flex-wrap gap-1">
                  {r.reasons.slice(0, 3).map((reason) => (
                    <span
                      key={reason}
                      className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[0.65rem] text-muted"
                    >
                      <ArrowUpRight className="h-2.5 w-2.5 text-primary" />
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

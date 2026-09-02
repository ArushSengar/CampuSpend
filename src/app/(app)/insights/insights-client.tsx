"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Lightbulb, LoaderCircle, Send, Sparkles, User } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/feedback";
import { InsightCard, type Insight } from "@/components/dashboard/insights-panel";
import { api } from "@/lib/client/api";
import { useAsyncData } from "@/lib/client/use-async-data";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/cn";

type Message = {
  id: string;
  role: "user" | "ai";
  question?: string;
  answer?: string;
  bullets?: { label: string; value: string }[];
  followUps?: string[];
  pending?: boolean;
};

const SUGGESTIONS = [
  "How much did I spend this month?",
  "Where can I cut back?",
  "Top merchants this month?",
  "Can I afford 5000 for a new phone?",
  "Am I on track?",
  "How much did I spend on food last month?",
];

const EMPTY = { insights: [], monthExpense: 0, prevSameDay: 0, projection: 0 };

export function InsightsClient() {
  const { data, loading, reload } = useAsyncData<{
    insights: Insight[];
    monthExpense: number;
    prevSameDay: number;
    projection: number;
  }>("/api/insights", EMPTY);
  const insights = data.insights;
  const summary =
    data === EMPTY ? null : { monthExpense: data.monthExpense, prevSameDay: data.prevSameDay, projection: data.projection };

  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => reload(), [reload]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const ask = async (text: string) => {
    const value = text.trim();
    if (!value || asking) return;
    const id = Math.random().toString(36).slice(2);
    setMessages((prev) => [...prev, { id, role: "user", question: value }]);
    const pendingId = `${id}-pending`;
    setMessages((prev) => [...prev, { id: pendingId, role: "ai", pending: true }]);
    setQuestion("");
    setAsking(true);
    try {
      const res = await api.post<{ answer: string; bullets?: { label: string; value: string }[]; followUps: string[] }>(
        "/api/ai/ask",
        { question: value },
      );
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? { ...m, pending: false, answer: res.answer, bullets: res.bullets, followUps: res.followUps }
            : m,
        ),
      );
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? { ...m, pending: false, answer: e instanceof Error ? e.message : "Something went wrong." }
            : m,
        ),
      );
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="mx-auto max-w-[84rem] space-y-4">
      <div className="grid gap-4 lg:grid-cols-5">
        {/* ------------------------------- insights ------------------------------ */}
        <div className="space-y-4 lg:col-span-3">
          <Card>
            <CardHeader
              title="What your numbers say"
              subtitle="Recalculated from every transaction you've logged"
              icon={<Lightbulb className="h-4 w-4" />}
              action={
                <Button size="xs" variant="secondary" onClick={() => void load()} loading={loading}>
                  Refresh
                </Button>
              }
            />
            <CardBody className="p-4">
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 rounded-xl" />
                  ))}
                </div>
              ) : insights.length ? (
                <div className="space-y-2">
                  {insights.map((i) => (
                    <InsightCard key={i.id} insight={i} />
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-subtle">
                  No insights yet — log a few transactions first.
                </p>
              )}
            </CardBody>
          </Card>

          {summary ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Spent this month" value={formatMoney(summary.monthExpense)} />
              <Stat
                label="Same point last month"
                value={summary.prevSameDay > 0 ? formatMoney(summary.prevSameDay) : "—"}
                muted
              />
              <Stat label="Projected month-end" value={formatMoney(summary.projection)} accent />
            </div>
          ) : null}
        </div>

        {/* --------------------------------- chat -------------------------------- */}
        <Card className="flex h-[min(80vh,44rem)] flex-col lg:col-span-2">
          <CardHeader
            title="Ask your money"
            subtitle="Answers computed from your own data"
            icon={<Bot className="h-4 w-4" />}
            dense
          />
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-border bg-surface-2 p-3.5">
                  <p className="flex items-center gap-2 text-sm font-semibold text-fg">
                    <Sparkles className="h-4 w-4 text-primary" /> Hi, I am your CampuSpend coach
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted">
                    Ask in plain English — &ldquo;how much on chai this month?&rdquo;, “can I afford ₹5,000?”, “where can I cut?”.
                    Every answer is computed from your actual transactions.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => void ask(s)}
                      className="rounded-full border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-muted transition hover:border-primary/40 hover:bg-primary-soft hover:text-primary"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-fg">
                    {m.question}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex gap-2">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                    {m.pending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    {m.pending ? (
                      <div className="space-y-1.5 rounded-2xl rounded-tl-md bg-surface-2 px-3 py-2">
                        <Skeleton className="h-3 w-40" />
                        <Skeleton className="h-3 w-28" />
                      </div>
                    ) : (
                      <>
                        <div className="rounded-2xl rounded-tl-md bg-surface-2 px-3 py-2 text-sm leading-relaxed text-fg">
                          {m.answer}
                        </div>
                        {m.bullets?.length ? (
                          <div className="overflow-hidden rounded-xl border border-border">
                            {m.bullets.map((b) => (
                              <div key={b.label} className="flex items-center justify-between border-b border-border px-3 py-1.5 last:border-0">
                                <span className="text-xs text-muted">{b.label}</span>
                                <span className="tabular text-xs font-semibold text-fg">{b.value}</span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {m.followUps?.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {m.followUps.map((f) => (
                              <button
                                key={f}
                                onClick={() => void ask(f)}
                                className="rounded-full border border-border px-2 py-1 text-[0.68rem] text-muted transition hover:border-primary/40 hover:text-primary"
                              >
                                {f}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              ),
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(question);
            }}
            className="flex items-center gap-2 border-t border-border p-3"
          >
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask anything about your spending…"
              className="h-10"
              disabled={asking}
            />
            <Button type="submit" size="icon" disabled={!question.trim() || asking} aria-label="Send">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </Card>
      </div>

      <p className="flex items-center gap-1.5 text-[0.7rem] text-subtle">
        <User className="h-3 w-3" />
        Insights run on-device against your database. Nothing is sent to a third party unless you add your own API key.
      </p>
    </div>
  );
}

function Stat({ label, value, muted, accent }: { label: string; value: string; muted?: boolean; accent?: boolean }) {
  return (
    <div className={cn("rounded-card border border-border bg-surface p-3.5", accent && "border-primary/40 bg-primary-soft/40")}>
      <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-subtle">{label}</p>
      <p className={cn("tabular mt-1 text-lg font-bold", muted ? "text-muted" : "text-fg")}>{value}</p>
    </div>
  );
}

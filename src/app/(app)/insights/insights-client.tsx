"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  Lightbulb,
  LoaderCircle,
  Send,
  Sparkles,
  Award,
  CheckCircle2,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/feedback";
import { InsightCard, type Insight } from "@/components/dashboard/insights-panel";
import type { FinancialHealthResult, StudentBadge } from "@/lib/analytics";
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
  "September spend",
  "Where to cut back?",
  "Chai total",
  "Can I afford 5000?",
  "Top merchants",
];

type InsightsPayload = {
  insights: Insight[];
  monthExpense: number;
  prevSameDay: number;
  projection: number;
  financialHealth?: FinancialHealthResult;
  badges?: StudentBadge[];
};

const EMPTY: InsightsPayload = {
  insights: [],
  monthExpense: 0,
  prevSameDay: 0,
  projection: 0,
};

export function InsightsClient() {
  const { data, loading, reload } = useAsyncData<InsightsPayload>("/api/insights", EMPTY);
  const insights = data.insights;
  const health = data.financialHealth;
  const badges = data.badges ?? [];

  const summary =
    data === EMPTY
      ? null
      : {
          monthExpense: data.monthExpense,
          prevSameDay: data.prevSameDay,
          projection: data.projection,
        };

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
      const res = await api.post<{
        answer: string;
        bullets?: { label: string; value: string }[];
        followUps: string[];
      }>("/api/ai/ask", { question: value });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                pending: false,
                answer: res.answer,
                bullets: res.bullets,
                followUps: res.followUps,
              }
            : m,
        ),
      );
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                pending: false,
                answer: e instanceof Error ? e.message : "Something went wrong.",
              }
            : m,
        ),
      );
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="mx-auto max-w-[84rem] space-y-5">
      {/* ----------------- Top Section: Financial Health Score ----------------- */}
      {health ? (
        <Card className="p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            {/* Score Ring & Title */}
            <div className="flex items-center gap-4">
              <div className="relative grid h-19 w-19 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary via-primary to-accent text-white shadow-lg shadow-primary/25">
                <span className="text-2xl font-black tracking-tight">{health.score}</span>
                <span className="text-[0.6rem] font-bold uppercase tracking-wider opacity-80">
                  / 100
                </span>
                <span className="absolute -bottom-2 -right-2 grid h-7 w-7 place-items-center rounded-full bg-surface text-xs font-black text-primary border border-border shadow-sm">
                  {health.grade}
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black tracking-tight text-fg">
                    Financial Health
                  </h2>
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">
                    {health.title}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted max-w-md">{health.summary}</p>
              </div>
            </div>

            {/* 4 Pillars Breakdown */}
            <div className="grid flex-1 grid-cols-2 gap-2.5 sm:grid-cols-4 lg:max-w-2xl">
              {health.pillars.map((pillar) => (
                <div
                  key={pillar.name}
                  className="rounded-2xl border border-border/80 bg-surface-2/60 p-3"
                >
                  <div className="flex items-center justify-between text-[0.68rem] font-bold text-muted">
                    <span className="truncate">{pillar.name}</span>
                    <span className="font-black text-fg">
                      {pillar.score}/{pillar.maxScore}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        pillar.status === "good"
                          ? "bg-success"
                          : pillar.status === "fair"
                            ? "bg-warning"
                            : "bg-danger",
                      )}
                      style={{
                        width: `${Math.min(100, (pillar.score / pillar.maxScore) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1.5 truncate text-[0.65rem] text-subtle">{pillar.feedback}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-5">
        {/* ----------------- Insights Cards ----------------- */}
        <div className="space-y-5 lg:col-span-3">
          <Card>
            <CardHeader
              title="Intelligence Feed"
              subtitle="Calculated from your ledger"
              icon={<Lightbulb className="h-4 w-4" />}
              action={
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() => void load()}
                  loading={loading}
                  className="text-xs"
                >
                  Refresh
                </Button>
              }
            />
            <CardBody className="p-4">
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 rounded-2xl" />
                  ))}
                </div>
              ) : insights.length ? (
                <div className="space-y-2.5">
                  {insights.map((i) => (
                    <InsightCard key={i.id} insight={i} />
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-xs text-subtle">
                  No insights yet — log transactions first.
                </p>
              )}
            </CardBody>
          </Card>

          {summary ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Spent This Month" value={formatMoney(summary.monthExpense)} />
              <Stat
                label="Last Month Point"
                value={summary.prevSameDay > 0 ? formatMoney(summary.prevSameDay) : "—"}
                muted
              />
              <Stat label="Projected End" value={formatMoney(summary.projection)} accent />
            </div>
          ) : null}

          {/* ----------------- Student Milestones & Badges ----------------- */}
          {badges.length > 0 ? (
            <Card className="p-4.5">
              <div className="flex items-center gap-2 mb-3.5">
                <Award className="h-4 w-4 text-warning" />
                <h3 className="text-xs font-bold text-fg uppercase tracking-wider">Milestones & Badges</h3>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[0.65rem] font-bold text-muted">
                  {badges.filter((b) => b.unlocked).length}/{badges.length}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {badges.map((badge) => (
                  <div
                    key={badge.id}
                    className={cn(
                      "flex flex-col justify-between rounded-2xl border p-3 transition",
                      badge.unlocked
                        ? "border-primary/30 bg-primary-soft/25 shadow-sm"
                        : "border-border/60 bg-surface-2/40 opacity-60",
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xl">{badge.emoji}</span>
                        {badge.unlocked ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs font-bold text-fg">{badge.title}</p>
                      <p className="mt-0.5 text-[0.65rem] text-muted line-clamp-2">
                        {badge.description}
                      </p>
                    </div>
                    <span className="mt-2 block text-[0.65rem] font-bold text-primary">
                      {badge.progressText}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>

        {/* ----------------- iOS Style Chat ----------------- */}
        <Card className="flex h-[min(85vh,48rem)] flex-col lg:col-span-2">
          <CardHeader
            title="Ask AI"
            subtitle="Ledger-aware answers"
            icon={<Bot className="h-4 w-4" />}
            dense
          />
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-border/80 bg-surface-2/60 p-3.5">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-fg">
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> CampuSpend Coach
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    Ask questions about your finances in plain language.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => void ask(s)}
                      className="shrink-0 whitespace-nowrap rounded-full border border-border/80 bg-surface-2 px-2.5 py-1 text-xs text-muted transition hover:border-primary/40 hover:bg-primary-soft hover:text-primary pressable"
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
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-xs font-medium text-white shadow-sm">
                    {m.question}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex items-start gap-2.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                    <Bot className="h-3.5 w-3.5" />
                  </span>
                  <div className="max-w-[85%] space-y-2 rounded-2xl rounded-tl-sm border border-border/80 bg-surface-2/70 backdrop-blur px-3.5 py-2.5 text-xs">
                    {m.pending ? (
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin text-primary" />
                        <span>Checking numbers…</span>
                      </div>
                    ) : (
                      <>
                        <p className="leading-relaxed text-fg">{m.answer}</p>
                        {m.bullets?.length ? (
                          <div className="grid gap-1 rounded-xl border border-border/60 bg-surface/90 p-2 text-xs">
                            {m.bullets.map((b) => (
                              <div key={b.label} className="flex justify-between">
                                <span className="text-muted">{b.label}</span>
                                <span className="font-bold text-fg">{b.value}</span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {m.followUps?.length ? (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {m.followUps.map((f) => (
                              <button
                                key={f}
                                onClick={() => void ask(f)}
                                className="rounded-full border border-border bg-surface px-2 py-0.5 text-[0.68rem] text-primary hover:bg-primary-soft transition"
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
            className="flex items-center gap-2 border-t border-border/80 p-3 bg-surface/60 backdrop-blur"
          >
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask anything about your money…"
              className="h-9 text-xs"
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!question.trim() || asking}
              className="h-9 px-3 shrink-0"
            >
              {asking ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  muted,
  accent,
}: {
  label: string;
  value: string;
  muted?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/80 bg-surface p-3.5",
        accent ? "border-primary/40 bg-primary-soft/20" : "",
      )}
    >
      <p className="text-[0.65rem] font-bold uppercase tracking-wider text-subtle">{label}</p>
      <p
        className={cn(
          "tabular mt-1 text-base font-black",
          muted ? "text-muted" : accent ? "text-primary" : "text-fg",
        )}
      >
        {value}
      </p>
    </div>
  );
}

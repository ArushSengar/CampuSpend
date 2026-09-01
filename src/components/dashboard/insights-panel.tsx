"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/ui/feedback";

export type Insight = {
  id: string;
  tone: "positive" | "warning" | "critical" | "info";
  emoji: string;
  title: string;
  body: string;
  action?: { label: string; href: string };
};

const TONES = {
  positive: { ring: "border-l-success", chip: "bg-success-soft text-success", label: "On track" },
  warning: { ring: "border-l-warning", chip: "bg-warning-soft text-warning", label: "Watch out" },
  critical: { ring: "border-l-danger", chip: "bg-danger-soft text-danger", label: "Act now" },
  info: { ring: "border-l-info", chip: "bg-info-soft text-info", label: "Insight" },
} as const;

export function InsightCard({ insight }: { insight: Insight }) {
  const tone = TONES[insight.tone];
  return (
    <div
      className={cn(
        "animate-fade-up rounded-xl border border-border border-l-[3px] bg-surface-2/50 p-3.5 transition hover:bg-surface-2",
        tone.ring,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-base">
          {insight.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-fg">{insight.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{insight.body}</p>
          {insight.action ? (
            <Link
              href={insight.action.href}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              {insight.action.label}
              <ArrowRight className="h-3 w-3" />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function InsightsPanel({
  insights,
  loading,
  compact,
}: {
  insights: Insight[];
  loading?: boolean;
  compact?: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface-2/50 p-3.5">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="mt-2 h-3 w-full" />
            <Skeleton className="mt-1 h-3 w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", compact && "max-h-[26rem] overflow-y-auto pr-1 no-scrollbar")}>
      {insights.map((i) => (
        <InsightCard key={i.id} insight={i} />
      ))}
      <p className="flex items-center gap-1.5 pt-1 text-[0.68rem] text-subtle">
        <Sparkles className="h-3 w-3 text-primary" />
        Generated on-device from your own transactions — no data leaves your database.
      </p>
    </div>
  );
}

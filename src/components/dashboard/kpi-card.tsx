"use client";

import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/ui/feedback";
import { MiniSparkline } from "@/components/charts/area-chart";

export function KpiCard({
  label,
  value,
  hint,
  icon,
  delta,
  tone = "primary",
  spark,
  footer,
  loading,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  delta?: { value: number; label: string; good?: "up" | "down" };
  tone?: "primary" | "success" | "danger" | "warning" | "info";
  spark?: number[];
  footer?: ReactNode;
  loading?: boolean;
}) {
  const tones = {
    primary: "text-primary bg-primary-soft",
    success: "text-success bg-success-soft",
    danger: "text-danger bg-danger-soft",
    warning: "text-warning bg-warning-soft",
    info: "text-info bg-info-soft",
  } as const;

  if (loading) {
    return (
      <div className="rounded-card border border-border bg-surface p-4 shadow-card">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-7 w-32" />
        <Skeleton className="mt-3 h-3 w-20" />
      </div>
    );
  }

  const positive = delta ? (delta.good === "down" ? delta.value < 0 : delta.value > 0) : false;

  return (
    <div className="group relative overflow-hidden rounded-card border border-border bg-surface p-4 shadow-card transition-shadow hover:shadow-pop">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-subtle">{label}</p>
        {icon ? <span className={cn("grid h-7 w-7 place-items-center rounded-lg", tones[tone])}>{icon}</span> : null}
      </div>

      <p className="tabular mt-2 text-[1.6rem] font-bold leading-none tracking-tight text-fg">{value}</p>

      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="min-w-0">
          {delta ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.68rem] font-semibold",
                positive ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
              )}
            >
              {delta.value > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(delta.value)}%
              <span className="font-normal opacity-80">{delta.label}</span>
            </span>
          ) : null}
          {hint ? <p className="mt-1 truncate text-[0.7rem] text-muted">{hint}</p> : null}
        </div>
        {spark && spark.length > 1 ? (
          <div className={cn("w-16 shrink-0", tone === "danger" ? "text-danger" : "text-primary")}>
            <MiniSparkline data={spark} height={28} />
          </div>
        ) : null}
      </div>

      {footer ? <div className="mt-3 border-t border-border pt-2.5">{footer}</div> : null}
    </div>
  );
}

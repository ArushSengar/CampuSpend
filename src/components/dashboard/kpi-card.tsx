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
    primary: "text-primary bg-primary-soft border-primary/20",
    success: "text-success bg-success-soft border-success/20",
    danger: "text-danger bg-danger-soft border-danger/20",
    warning: "text-warning bg-warning-soft border-warning/20",
    info: "text-info bg-info-soft border-info/20",
  } as const;

  if (loading) {
    return (
      <div className="glass-card p-4">
        <Skeleton className="h-3 w-20 rounded-full" />
        <Skeleton className="mt-3 h-7 w-28 rounded-xl" />
        <Skeleton className="mt-3 h-3 w-16 rounded-full" />
      </div>
    );
  }

  const positive = delta ? (delta.good === "down" ? delta.value < 0 : delta.value > 0) : false;

  return (
    <div className="group relative overflow-hidden glass-card p-4.5 hover:border-border transition-all duration-200">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.65rem] font-bold uppercase tracking-wider text-subtle">
          {label}
        </span>
        {icon ? (
          <span
            className={cn(
              "grid h-7 w-7 place-items-center rounded-xl border shadow-sm",
              tones[tone],
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>

      <p className="tabular mt-2 text-2xl font-black leading-none tracking-tight text-fg">
        {value}
      </p>

      <div className="mt-2.5 flex items-end justify-between gap-2">
        <div className="min-w-0">
          {delta ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[0.65rem] font-bold",
                positive ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
              )}
            >
              {delta.value > 0 ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {Math.abs(delta.value)}%
              <span className="font-normal opacity-80">{delta.label}</span>
            </span>
          ) : null}
          {hint ? <p className="mt-1 truncate text-[0.68rem] text-muted">{hint}</p> : null}
        </div>
        {spark && spark.length > 1 ? (
          <div
            className={cn("w-16 shrink-0", tone === "danger" ? "text-danger" : "text-primary")}
          >
            <MiniSparkline data={spark} height={26} />
          </div>
        ) : null}
      </div>

      {footer ? <div className="mt-3 border-t border-border/60 pt-2.5">{footer}</div> : null}
    </div>
  );
}

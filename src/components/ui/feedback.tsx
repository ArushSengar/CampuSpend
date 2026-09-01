"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-lg bg-surface-2", className)} />;
}

export function Badge({
  children,
  tone = "neutral",
  className,
  icon,
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "danger" | "warning" | "info" | "primary";
  className?: string;
  icon?: ReactNode;
}) {
  const tones = {
    neutral: "bg-surface-2 text-muted border-border",
    success: "bg-success-soft text-success border-transparent",
    danger: "bg-danger-soft text-danger border-transparent",
    warning: "bg-warning-soft text-warning border-transparent",
    info: "bg-info-soft text-info border-transparent",
    primary: "bg-primary-soft text-primary border-transparent",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.7rem] font-medium",
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 py-8" : "gap-3 py-14",
        className,
      )}
    >
      {icon ? (
        <span
          className={cn(
            "grid place-items-center rounded-2xl border border-dashed border-border-strong bg-surface-2 text-subtle",
            compact ? "h-10 w-10" : "h-14 w-14",
          )}
        >
          {icon}
        </span>
      ) : null}
      <div className="space-y-1">
        <p className={cn("font-semibold text-fg", compact ? "text-sm" : "text-[0.95rem]")}>{title}</p>
        {description ? <p className="mx-auto max-w-sm text-xs leading-relaxed text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function ProgressBar({
  value,
  tone = "primary",
  className,
  height = 8,
  showOverflow = true,
}: {
  value: number;
  tone?: "primary" | "success" | "warning" | "danger" | "accent";
  className?: string;
  height?: number;
  showOverflow?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const over = value > 100;
  const tones = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    accent: "bg-accent",
  } as const;
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-surface-3", className)}
      style={{ height }}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-out",
          over && showOverflow ? "bg-danger" : tones[tone],
        )}
        style={{ width: `${over && showOverflow ? 100 : clamped}%` }}
      />
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}

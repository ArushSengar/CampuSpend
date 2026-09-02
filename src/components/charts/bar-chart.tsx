"use client";

import { useState } from "react";
import { formatMoneyCompact } from "@/lib/money";
import { cn } from "@/lib/cn";

export function BarChart({
  data,
  height = 160,
  className,
}: {
  data: { label: string; expense: number; income: number }[];
  height?: number;
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => Math.max(d.expense, d.income)));

  return (
    <div className={cn("flex items-end justify-between gap-2", className)} style={{ height }}>
      {data.map((d, i) => {
        const expenseH = (d.expense / max) * (height - 24);
        const incomeH = (d.income / max) * (height - 24);
        const active = hover === i;
        return (
          <div
            key={d.label}
            className="group flex h-full flex-1 flex-col items-center justify-end gap-1"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            {active ? (
              <span className="tabular text-[0.65rem] font-semibold text-fg">{formatMoneyCompact(d.expense)}</span>
            ) : null}
            <div className="flex w-full items-end justify-center gap-1" style={{ height: height - 24 }}>
              <div
                className="w-1/3 rounded-t-md bg-success/70 transition-all"
                style={{ height: Math.max(2, incomeH), opacity: active ? 1 : 0.75 }}
                title={`Income ${formatMoneyCompact(d.income)}`}
              />
              <div
                className={cn("w-1/3 rounded-t-md transition-all", active ? "bg-primary" : "bg-primary/60")}
                style={{ height: Math.max(2, expenseH) }}
                title={`Expense ${formatMoneyCompact(d.expense)}`}
              />
            </div>
            <span className={cn("text-[0.65rem] transition", active ? "font-semibold text-fg" : "text-subtle")}>
              {d.label.split(" ")[0]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function MethodBars({
  data,
  className,
}: {
  data: { method: string; amount: number; count: number; share: number }[];
  className?: string;
}) {
  const colors: Record<string, string> = {
    UPI: "var(--primary)",
    CASH: "var(--success)",
    CARD: "var(--accent)",
    BANK: "var(--info)",
  };
  const labels: Record<string, string> = {
    UPI: "UPI",
    CASH: "Cash",
    CARD: "Card",
    BANK: "Bank",
  };

  if (!data.length) {
    return <p className="py-6 text-center text-xs text-subtle">No spending recorded yet.</p>;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {data.map((d) => (
        <div key={d.method}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-fg">{labels[d.method] ?? d.method}</span>
            <span className="tabular text-muted">
              {formatMoneyCompact(d.amount)} · {Math.round(d.share)}% · {d.count} txns
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.max(2, d.share)}%`, background: colors[d.method] ?? "var(--primary)" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

"use client";

import { useState } from "react";
import { formatMoneyCompact, safePercent } from "@/lib/money";
import { cn } from "@/lib/cn";

export type Slice = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  amount: number;
  count?: number;
};

export function DonutChart({
  slices,
  size = 200,
  thickness = 26,
  centerLabel,
  centerValue,
  className,
}: {
  slices: Slice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
  className?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const total = slices.reduce((a, s) => a + s.amount, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = slices.length > 1 ? 2 : 0;

  const arcs = slices.reduce<{ arc: (Slice & { dash: number; offset: number; fraction: number })[]; offset: number }>(
    (acc, s) => {
      const fraction = total > 0 ? s.amount / total : 0;
      const length = fraction * circumference;
      return {
        arc: [
          ...acc.arc,
          { ...s, dash: Math.max(0, length - gap), offset: acc.offset, fraction },
        ],
        offset: acc.offset + length,
      };
    },
    { arc: [], offset: 0 },
  ).arc;

  const active = hover ? arcs.find((a) => a.id === hover) : null;

  return (
    <div className={cn("flex flex-col items-center gap-4 sm:flex-row sm:items-center", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-3)" strokeWidth={thickness} />
          {arcs.map((a) => (
            <circle
              key={a.id}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={a.color}
              strokeWidth={hover === a.id ? thickness + 5 : thickness}
              strokeLinecap="round"
              strokeDasharray={`${a.dash} ${circumference - a.dash}`}
              strokeDashoffset={-a.offset}
              className="transition-all duration-300"
              onMouseEnter={() => setHover(a.id)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          {active ? (
            <div className="px-6">
              <p className="text-lg">{active.emoji}</p>
              <p className="tabular text-base font-bold text-fg">{formatMoneyCompact(active.amount)}</p>
              <p className="max-w-[6.5rem] truncate text-[0.68rem] text-muted">{active.name}</p>
              <p className="text-[0.68rem] font-semibold text-primary">{Math.round(active.fraction * 100)}%</p>
            </div>
          ) : (
            <div className="px-6">
              <p className="tabular text-lg font-bold text-fg">{centerValue ?? formatMoneyCompact(total)}</p>
              <p className="text-[0.68rem] uppercase tracking-wider text-subtle">{centerLabel ?? "spent"}</p>
            </div>
          )}
        </div>
      </div>

      <div className="w-full min-w-0 flex-1 space-y-1.5">
        {slices.slice(0, 6).map((s) => (
          <button
            key={s.id}
            onMouseEnter={() => setHover(s.id)}
            onMouseLeave={() => setHover(null)}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left transition",
              hover === s.id ? "bg-surface-2" : "hover:bg-surface-2",
            )}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-fg">
              {s.emoji} {s.name}
            </span>
            <span className="tabular shrink-0 text-xs text-muted">{formatMoneyCompact(s.amount)}</span>
            <span className="tabular w-9 shrink-0 text-right text-[0.68rem] text-subtle">
              {Math.round(safePercent(s.amount, total))}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

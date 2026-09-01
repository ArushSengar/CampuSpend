"use client";

import { useMemo, useState } from "react";
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import { cn } from "@/lib/cn";

export type SeriesPoint = { label: string; value: number; secondary?: number };

/**
 * Lightweight SVG area chart — no chart library, no layout thrash.
 * Scales to its container via viewBox + preserveAspectRatio.
 */
export function AreaChart({
  data,
  height = 220,
  secondaryLabel,
  primaryLabel,
  formatValue = formatMoneyCompact,
  className,
}: {
  data: SeriesPoint[];
  height?: number;
  primaryLabel?: string;
  secondaryLabel?: string;
  formatValue?: (n: number) => string;
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 720;
  const padX = 8;
  const padY = 18;

  const { path, area, max, points, ticks } = useMemo(() => {
    const values = data.map((d) => d.value);
    const maxValue = Math.max(1, ...values);
    const nice = Math.ceil(maxValue / 4 / 100) * 100 * 4 || 100;
    const innerW = width - padX * 2;
    const innerH = height - padY * 2;

    const pts = data.map((d, i) => {
      const x = padX + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
      const y = padY + innerH - (d.value / nice) * innerH;
      return { x, y, d };
    });

    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const fill = `${line} L${pts[pts.length - 1]?.x.toFixed(1) ?? 0},${height - padY} L${pts[0]?.x.toFixed(1) ?? 0},${height - padY} Z`;

    return {
      path: line,
      area: fill,
      max: nice,
      points: pts,
      ticks: [0, 0.25, 0.5, 0.75, 1].map((f) => ({ value: nice * f, y: padY + innerH - f * innerH })),
    };
  }, [data, height]);

  const active = hover != null ? points[hover] : null;

  return (
    <div className={cn("relative w-full", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <line
            key={t.value}
            x1={padX}
            x2={width - padX}
            y1={t.y}
            y2={t.y}
            stroke="var(--border)"
            strokeWidth={1}
            strokeDasharray={t.value === 0 ? undefined : "3 5"}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        <path d={area} fill="url(#areaGrad)" />
        <path
          d={path}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {active ? (
          <g>
            <line
              x1={active.x}
              x2={active.x}
              y1={padY}
              y2={height - padY}
              stroke="var(--border-strong)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={active.x} cy={active.y} r={4.5} fill="var(--primary)" stroke="var(--surface)" strokeWidth={2} />
          </g>
        ) : null}

        {points.map((p, i) => (
          <rect
            key={i}
            x={p.x - (width / data.length) / 2}
            y={0}
            width={width / data.length}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>

      {active ? (
        <div
          className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs shadow-pop"
          style={{ left: `${(active.x / width) * 100}%` }}
        >
          <p className="font-semibold text-fg">{formatMoney(active.d.value)}</p>
          <p className="text-[0.7rem] text-subtle">{active.d.label}</p>
          {active.d.secondary != null ? (
            <p className="text-[0.7rem] text-success">+{formatMoney(active.d.secondary)} in</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-1 flex items-center justify-between text-[0.65rem] text-subtle">
        <span>{data[0]?.label}</span>
        {primaryLabel ? <span className="tabular">peak {formatValue(max)}</span> : null}
        <span>{data[data.length - 1]?.label}</span>
      </div>
      {secondaryLabel ? <p className="sr-only">{secondaryLabel}</p> : null}
    </div>
  );
}

export function MiniSparkline({ data, className, height = 40 }: { data: number[]; className?: string; height?: number }) {
  const width = 120;
  const max = Math.max(1, ...data);
  const pts = data.map((v, i) => {
    const x = (i / Math.max(1, data.length - 1)) * width;
    const y = height - (v / max) * (height - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={cn("w-full", className)} style={{ height }} preserveAspectRatio="none">
      <polyline points={pts.join(" ")} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

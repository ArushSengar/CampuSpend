/**
 * Money helpers. Every amount in the database is stored in PAISE (integer).
 * The UI/API boundary talks in RUPEES (number) — conversions happen here only.
 */

export const toPaise = (rupees: number): number => Math.round(rupees * 100);
export const toRupees = (paise: number): number => paise / 100;

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrPrecise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const plain = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** ₹1,240 (whole rupees — used almost everywhere) */
export function formatMoney(paise: number, opts?: { precise?: boolean }): string {
  const value = toRupees(paise);
  if (opts?.precise && !Number.isInteger(value)) return inrPrecise.format(value);
  return inr.format(value);
}

/** ₹1,240 without the symbol-less variants */
export function formatMoneyCompact(paise: number): string {
  const rupees = toRupees(paise);
  const abs = Math.abs(rupees);
  if (abs >= 100000) return `₹${(rupees / 100000).toFixed(abs >= 1000000 ? 1 : 2)}L`;
  if (abs >= 1000) return `₹${(rupees / 1000).toFixed(abs >= 10000 ? 1 : 2)}k`;
  return inr.format(rupees);
}

/** 1,240 (no currency symbol, for inputs/stats) */
export function formatNumber(paise: number): string {
  return plain.format(toRupees(paise));
}

export function formatSigned(paise: number, type: "EXPENSE" | "INCOME"): string {
  const sign = type === "INCOME" ? "+" : "−";
  return `${sign}${formatMoney(Math.abs(paise))}`;
}

/** Parses "1,240", "1.2k", "₹99", "rs 100" into rupees. Returns null if nothing found. */
export function parseAmountLoose(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, "").trim();
  const match = cleaned.match(/(\d+(?:\.\d+)?)\s*(l|lac|lakh|cr|crore|k|thousand|m)?/i);
  if (!match) return null;
  const n = parseFloat(match[1]);
  if (Number.isNaN(n)) return null;
  const suffix = (match[2] ?? "").toLowerCase();
  const multiplier =
    suffix === "l" || suffix === "lac" || suffix === "lakh"
      ? 100000
      : suffix === "cr" || suffix === "crore"
        ? 10000000
        : suffix === "k" || suffix === "thousand"
          ? 1000
          : suffix === "m"
            ? 1000000
            : 1;
  return n * multiplier;
}

export function percent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

export function safePercent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return (part / whole) * 100;
}

export function clampPercent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(100, Math.max(0, (part / whole) * 100));
}

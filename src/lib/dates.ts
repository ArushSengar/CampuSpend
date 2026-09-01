/** Small, dependency-light date helpers (IST-aware display, UTC-safe maths). */

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function startOfDay(d: Date = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date = new Date()): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function startOfMonth(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function startOfYear(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), 0, 1);
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  const day = x.getDate();
  x.setDate(1);
  x.setMonth(x.getMonth() + n);
  const lastDay = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(day, lastDay));
  return x;
}

export function addYears(d: Date, n: number): Date {
  return addMonths(d, n * 12);
}

export function subMonths(d: Date, n: number): Date {
  return addMonths(d, -n);
}

export function startOfWeek(d: Date = new Date()): Date {
  const x = startOfDay(d);
  const day = x.getDay(); // 0 = Sunday
  return addDays(x, -day);
}

export const daysBetween = (a: Date, b: Date): number =>
  Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);

export const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Inclusive "today → N days back" window. */
export function lastNDays(n: number, from: Date = new Date()): { from: Date; to: Date } {
  return { from: startOfDay(addDays(from, -(n - 1))), to: endOfDay(from) };
}

export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** "12 Aug" */
export function formatDay(d: Date | string | number): string {
  const x = new Date(d);
  return `${x.getDate()} ${MONTHS_SHORT[x.getMonth()]}`;
}

/** "12 Aug, 7:30 PM" */
export function formatDayTime(d: Date | string | number): string {
  const x = new Date(d);
  return `${formatDay(x)}, ${formatTime(x)}`;
}

export function formatTime(d: Date | string | number): string {
  const x = new Date(d);
  const h = x.getHours();
  const m = x.getMinutes();
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function formatDateLong(d: Date | string | number): string {
  const x = new Date(d);
  return `${DAY_SHORT[x.getDay()]}, ${x.getDate()} ${MONTHS_SHORT[x.getMonth()]} ${x.getFullYear()}`;
}

export function formatMonthLong(d: Date): string {
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** Relative label used across feeds: "Today", "Yesterday", else "12 Aug". */
export function relativeDayLabel(d: Date | string | number, now: Date = new Date()): string {
  const x = new Date(d);
  const diff = daysBetween(x, now);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff > 1 && diff < 7) return `${diff} days ago`;
  if (isSameDay(x, now)) return "Today";
  return formatDay(x);
}

export function timeAgo(d: Date | string | number): string {
  const x = new Date(d).getTime();
  const secs = Math.max(1, Math.round((Date.now() - x) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDay(x);
}

/** yyyy-mm-dd in local time (for <input type="date">). */
export function toDateInput(d: Date | string | number = new Date()): string {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

/** Parses yyyy-mm-dd (optionally with time) as a LOCAL date. */
export function fromDateInput(value: string, endOfDayIfDateOnly = false): Date {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!match) return new Date(value);
  const [, y, m, d, hh, mm] = match;
  if (hh && mm) return new Date(+y, +m - 1, +d, +hh, +mm, 0, 0);
  return new Date(+y, +m - 1, +d, endOfDayIfDateOnly ? 23 : 12, endOfDayIfDateOnly ? 59 : 0, 0, 0);
}

/** Advances a recurring rule by `interval` steps. */
export function advance(date: Date, frequency: string, interval = 1): Date {
  switch (frequency) {
    case "DAILY":
      return addDays(date, interval);
    case "WEEKLY":
      return addDays(date, 7 * interval);
    case "YEARLY":
      return addYears(date, interval);
    case "MONTHLY":
    default:
      return addMonths(date, interval);
  }
}

export function daysUntil(d: Date | string | number, now: Date = new Date()): number {
  return daysBetween(now, new Date(d));
}

export function greeting(d: Date = new Date()): string {
  const h = d.getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

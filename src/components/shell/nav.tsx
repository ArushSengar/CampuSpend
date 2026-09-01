"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  ChartPie,
  Target,
  Repeat,
  Sparkles,
  WalletCards,
  Settings,
  Zap,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, hint: "Overview & trends" },
  { href: "/transactions", label: "Transactions", icon: Receipt, hint: "Every rupee, searchable" },
  { href: "/insights", label: "AI Coach", icon: Sparkles, hint: "Insights & Q&A" },
  { href: "/budgets", label: "Budgets", icon: ChartPie, hint: "Monthly caps" },
  { href: "/goals", label: "Goals", icon: Target, hint: "Save for something" },
  { href: "/recurring", label: "Recurring", icon: Repeat, hint: "Rent, recharges, rent" },
  { href: "/accounts", label: "Accounts", icon: WalletCards, hint: "UPI, cash, bank" },
  { href: "/settings", label: "Settings", icon: Settings, hint: "Profile & data" },
] as const;

export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
              active
                ? "bg-primary-soft text-primary"
                : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            {active ? (
              <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
            ) : null}
            <Icon className={cn("h-[1.15rem] w-[1.15rem] shrink-0", active ? "text-primary" : "text-subtle group-hover:text-fg")} />
            <span className="flex-1 truncate">{item.label}</span>
            {item.href === "/insights" ? (
              <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-primary">
                <Zap className="mr-0.5 inline h-2.5 w-2.5" />
                ai
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({
  user,
  onClose,
  month,
}: {
  user: { name: string; email: string; avatarHue: number; college: string | null };
  onClose?: () => void;
  month?: { spent: string; budget: string | null; percent: number };
}) {
  return (
    <div className="flex h-full flex-col bg-surface/60 backdrop-blur-xl">
      <div className="flex items-center justify-between px-5 py-5">
        <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-lg">
            <Receipt className="h-[1.1rem] w-[1.1rem]" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[0.95rem] font-bold tracking-tight text-fg">CampuSpend</span>
            <span className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-subtle">for students</span>
          </span>
        </Link>
        {onClose ? (
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="mt-1 flex-1 overflow-y-auto no-scrollbar">
        <NavList onNavigate={onClose} />
      </div>

      {month ? (
        <div className="mx-3 mb-3 rounded-2xl border border-border bg-surface-2 p-4">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-subtle">This month</p>
          <p className="mt-1 tabular text-lg font-bold text-fg">{month.spent}</p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className={cn("h-full rounded-full transition-all", month.percent >= 100 ? "bg-danger" : "bg-primary")}
              style={{ width: `${Math.min(100, month.percent)}%` }}
            />
          </div>
          <p className="mt-1.5 text-[0.7rem] text-muted">
            {month.budget ? `${month.budget} budget` : "No budget set"}
          </p>
        </div>
      ) : null}

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
            style={{ background: `linear-gradient(135deg, hsl(${user.avatarHue} 78% 58%), hsl(${user.avatarHue + 40} 74% 52%))` }}
          >
            {user.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-fg">{user.name}</p>
            <p className="truncate text-[0.7rem] text-subtle">{user.college ?? user.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  Users,
  Zap,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, hint: "Overview & trends" },
  { href: "/transactions", label: "Transactions", icon: Receipt, hint: "Ledger & search" },
  { href: "/splits", label: "Splits", icon: Users, hint: "Roommate debts" },
  { href: "/insights", label: "AI Coach", icon: Sparkles, hint: "AI Coach & Q&A" },
  { href: "/budgets", label: "Budgets", icon: ChartPie, hint: "Category caps" },
  { href: "/goals", label: "Goals", icon: Target, hint: "Savings targets" },
  { href: "/recurring", label: "Recurring", icon: Repeat, hint: "Rent & recharges" },
  { href: "/accounts", label: "Accounts", icon: WalletCards, hint: "Wallets & banks" },
  { href: "/settings", label: "Settings", icon: Settings, hint: "Preferences & profile" },
] as const;

export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-3">
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
              "group relative flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-150 pressable",
              active
                ? "bg-primary text-white shadow-[0_2px_12px_rgba(10,132,255,0.35)]"
                : "text-muted hover:bg-surface-2/80 hover:text-fg",
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                active ? "text-white" : "text-muted group-hover:text-fg",
              )}
            />
            <span className="flex-1 truncate tracking-tight">{item.label}</span>
            {item.href === "/insights" ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[0.6rem] font-bold uppercase tracking-wider",
                  active ? "bg-white/20 text-white" : "bg-primary-soft text-primary",
                )}
              >
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
    <div className="flex h-full flex-col bg-surface/75 backdrop-blur-2xl border-r border-border/80">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-5 py-5">
        <Link href="/dashboard" className="flex items-center gap-2.5 group" onClick={onClose}>
          <span className="grid h-8.5 w-8.5 place-items-center rounded-2xl bg-gradient-to-br from-primary via-primary to-accent text-white shadow-md shadow-primary/25 transition-transform group-hover:scale-105">
            <Receipt className="h-4 w-4" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-black tracking-tight text-fg">CampuSpend</span>
            <span className="text-[0.6rem] font-bold uppercase tracking-widest text-subtle">
              student money
            </span>
          </span>
        </Link>
        {onClose ? (
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="mt-2 flex-1 overflow-y-auto no-scrollbar">
        <NavList onNavigate={onClose} />
      </div>

      {/* Month Progress Ring / Bar */}
      {month ? (
        <div className="mx-3 mb-3 rounded-2xl border border-border/60 bg-surface-2/60 backdrop-blur p-3.5">
          <div className="flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-wider text-subtle">
            <span>This Month</span>
            <span>{Math.round(month.percent)}%</span>
          </div>
          <p className="mt-1 tabular text-base font-extrabold text-fg">{month.spent}</p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                month.percent >= 100 ? "bg-danger" : "bg-primary",
              )}
              style={{ width: `${Math.min(100, month.percent)}%` }}
            />
          </div>
          <p className="mt-1.5 text-[0.65rem] text-muted truncate">
            {month.budget ? `${month.budget} budget cap` : "No limit set"}
          </p>
        </div>
      ) : null}

      {/* User Profile Footer */}
      <div className="border-t border-border/60 p-3">
        <div className="flex items-center gap-2.5 rounded-2xl px-2 py-1.5 hover:bg-surface-2/60 transition">
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white shadow-sm"
            style={{
              background: `linear-gradient(135deg, hsl(${user.avatarHue} 80% 55%), hsl(${user.avatarHue + 40} 75% 50%))`,
            }}
          >
            {user.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-fg">{user.name}</p>
            <p className="truncate text-[0.65rem] text-muted">{user.college ?? user.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

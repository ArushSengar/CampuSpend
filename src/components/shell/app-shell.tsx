"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Download, LogOut, Menu, Moon, Plus, Sparkles, Sun } from "lucide-react";
import { Sidebar } from "./nav";
import { CommandPalette, useCommandPaletteShortcut, type Action } from "./command-palette";
import { Button } from "@/components/ui/button";
import { TransactionForm, emptyDraft, type TxnDraft } from "@/components/transactions/transaction-form";
import { AppDataProvider, type AppAccount, type AppCategory, type AppUser } from "@/components/providers/app-data";
import { useTheme } from "@/components/theme-provider";
import { downloadFile } from "@/lib/client/download";
import { NAV_ITEMS } from "./nav";
import { cn } from "@/lib/cn";

type ShellActions = {
  openTransactionForm: (draft?: Partial<TxnDraft>) => void;
  openPalette: () => void;
};

const ShellContext = createContext<ShellActions | null>(null);

export function useShell(): ShellActions {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used inside <AppShell>");
  return ctx;
}

export function AppShell({
  user,
  categories,
  accounts,
  month,
  children,
}: {
  user: AppUser;
  categories: AppCategory[];
  accounts: AppAccount[];
  month?: { spent: string; budget: string | null; percent: number };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { toggle } = useTheme();

  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [txnDraft, setTxnDraft] = useState<{ draft: TxnDraft; open: boolean }>({ draft: emptyDraft(), open: false });

  useCommandPaletteShortcut(setPaletteOpen);

  const openTransactionForm = useCallback((draft?: Partial<TxnDraft>) => {
    setTxnDraft({ draft: emptyDraft(draft), open: true });
  }, []);

  const actions = useMemo<Action[]>(
    () => [
      {
        id: "add-expense",
        label: "Add expense",
        hint: "Manual entry",
        icon: Plus,
        run: () => openTransactionForm({ type: "EXPENSE" }),
      },
      {
        id: "add-income",
        label: "Add income",
        hint: "Allowance, stipend…",
        icon: Sparkles,
        run: () => openTransactionForm({ type: "INCOME" }),
      },
      {
        id: "theme",
        label: "Switch theme",
        icon: Sun,
        run: toggle,
      },
      {
        id: "export",
        label: "Export transactions (CSV)",
        hint: "Download",
        icon: Download,
        run: () => downloadFile("/api/export"),
      },
      {
        id: "logout",
        label: "Log out",
        icon: LogOut,
        run: async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          router.push("/login");
          router.refresh();
        },
      },
    ],
    [openTransactionForm, toggle, router],
  );

  const current = NAV_ITEMS.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`));
  const pageTitle = current?.label ?? "Dashboard";

  const value = useMemo<ShellActions>(
    () => ({ openTransactionForm, openPalette: () => setPaletteOpen(true) }),
    [openTransactionForm],
  );

  return (
    <AppDataProvider initialUser={user} initialCategories={categories} initialAccounts={accounts}>
      <ShellContext.Provider value={value}>
        <div className="flex min-h-screen">
          {/* desktop sidebar */}
          <aside className="sticky top-0 hidden h-screen w-[17rem] shrink-0 border-r border-border bg-surface/50 lg:block">
            <Sidebar user={user} month={month} />
          </aside>

          {/* mobile drawer */}
          {navOpen ? (
            <div className="fixed inset-0 z-[70] lg:hidden">
              <div className="absolute inset-0 bg-[#05060a]/60 backdrop-blur-[2px]" onClick={() => setNavOpen(false)} />
              <aside className="animate-fade-up absolute left-0 top-0 h-full w-[17rem] border-r border-border bg-bg">
                <Sidebar user={user} month={month} onClose={() => setNavOpen(false)} />
              </aside>
            </div>
          ) : null}

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-xl">
              <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
                <button
                  onClick={() => setNavOpen(true)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border text-muted transition hover:bg-surface-2 hover:text-fg lg:hidden"
                  aria-label="Open navigation"
                >
                  <Menu className="h-4 w-4" />
                </button>

                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-[1.05rem] font-semibold tracking-tight text-fg">{pageTitle}</h1>
                  <p className="hidden truncate text-xs text-subtle sm:block">{current?.hint}</p>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPaletteOpen(true)}
                  className="hidden sm:inline-flex"
                  title="Search (⌘K)"
                >
                  <span className="text-xs">⌘K</span>
                </Button>

                <Button variant="ghost" size="icon" onClick={toggle} title="Toggle theme" aria-label="Toggle theme">
                  <Sun className="hidden h-4 w-4 dark:block" />
                  <Moon className="block h-4 w-4 dark:hidden" />
                </Button>

                <Button size="sm" className="gap-1.5 sm:h-10 sm:px-4" onClick={() => openTransactionForm()}>
                  <Plus className="h-4 w-4" />
                  <span className={cn("hidden sm:inline")}>Add</span>
                </Button>

                <button
                  onClick={async () => {
                    await fetch("/api/auth/logout", { method: "POST" });
                    router.push("/login");
                    router.refresh();
                  }}
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white transition hover:opacity-90",
                  )}
                  style={{
                    background: `linear-gradient(135deg, hsl(${user.avatarHue} 78% 58%), hsl(${user.avatarHue + 40} 74% 52%))`,
                  }}
                  title={`${user.name} — log out`}
                  aria-label="Log out"
                >
                  {user.name.slice(0, 1).toUpperCase()}
                </button>
              </div>
            </header>

            <main className="flex-1 px-4 pb-24 pt-5 sm:px-6 lg:pb-10">{children}</main>
          </div>
        </div>

        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} actions={actions} />
        <TransactionForm
          open={txnDraft.open}
          draft={txnDraft.draft}
          onClose={() => setTxnDraft((d) => ({ ...d, open: false }))}
        />
      </ShellContext.Provider>
    </AppDataProvider>
  );
}

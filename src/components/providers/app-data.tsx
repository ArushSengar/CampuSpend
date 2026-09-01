"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/client/api";

export type AppCategory = {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  color: string;
  kind: string;
  archived: boolean;
};

export type AppAccount = {
  id: string;
  name: string;
  type: string;
  upiId: string | null;
  balance: number;
  color: string;
  icon: string;
  isDefault: boolean;
  archived: boolean;
};

export type AppUser = {
  id: string;
  name: string;
  email: string;
  college: string | null;
  avatarHue: number;
  monthlyIncome: number;
  currency: string;
  isDemo: boolean;
  aiProvider: string;
  createdAt: string;
};

type AppData = {
  user: AppUser;
  categories: AppCategory[];
  accounts: AppAccount[];
  expenseCategories: AppCategory[];
  incomeCategories: AppCategory[];
  defaultAccountId: string | null;
  reload: () => Promise<void>;
  setCategories: (c: AppCategory[]) => void;
  setAccounts: (a: AppAccount[]) => void;
};

const Ctx = createContext<AppData | null>(null);

export function useAppData(): AppData {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppData must be used inside <AppDataProvider>");
  return ctx;
}

export function AppDataProvider({
  children,
  initialUser,
  initialCategories,
  initialAccounts,
}: {
  children: ReactNode;
  initialUser: AppUser;
  initialCategories: AppCategory[];
  initialAccounts: AppAccount[];
}) {
  const [user, setUser] = useState(initialUser);
  const [categories, setCategories] = useState(initialCategories);
  const [accounts, setAccounts] = useState(initialAccounts);

  const reload = useCallback(async () => {
    const [c, a] = await Promise.all([
      api.get<{ categories: AppCategory[] }>("/api/categories"),
      api.get<{ accounts: AppAccount[] }>("/api/accounts"),
    ]);
    setCategories(c.categories);
    setAccounts(a.accounts);
    void setUser;
  }, []);

  const value = useMemo<AppData>(
    () => ({
      user,
      categories,
      accounts,
      expenseCategories: categories.filter((c) => c.kind === "EXPENSE" && !c.archived),
      incomeCategories: categories.filter((c) => c.kind === "INCOME" && !c.archived),
      defaultAccountId: accounts.find((a) => a.isDefault)?.id ?? accounts[0]?.id ?? null,
      reload,
      setCategories,
      setAccounts,
    }),
    [user, categories, accounts, reload],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

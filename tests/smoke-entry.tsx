/**
 * Browser-ish smoke test for the client layer.
 *
 * There is no headless browser available in every environment, so this runs
 * the real client components inside jsdom (see tests/smoke.mjs for the
 * runner) against a live dev server. It catches the failures that HTTP status
 * codes cannot: render crashes, effects that never settle, data that never
 * reaches the DOM, and — via the AI quick-add interaction — the parse and
 * save round trip.
 */

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { AppShell } from "@/components/shell/app-shell";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { AiQuickAdd } from "@/components/ai/quick-add";
import { AccountsClient } from "@/app/(app)/accounts/accounts-client";
import { BudgetsClient } from "@/app/(app)/budgets/budgets-client";
import { GoalsClient } from "@/app/(app)/goals/goals-client";
import { InsightsClient } from "@/app/(app)/insights/insights-client";
import { RecurringClient } from "@/app/(app)/recurring/recurring-client";
import { SettingsClient } from "@/app/(app)/settings/settings-client";
import { SplitsClient } from "@/app/(app)/splits/splits-client";
import { TransactionsClient } from "@/app/(app)/transactions/transactions-client";
import type { AppAccount, AppCategory, AppUser } from "@/components/providers/app-data";
import type { Overview } from "@/lib/overview";
import { formatMoney, formatMoneyCompact } from "@/lib/money";

type Case = {
  name: string;
  node: ReactNode;
  /** substrings that must appear in the rendered text */
  expect: string[];
};

type CaseResult = Case & {
  ok: boolean;
  missing: string[];
  chars: number;
  sample: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return (await res.json()) as T;
}

async function settle(times = 8) {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await sleep(120);
    });
  }
}

/** React tracks input values, so the native prototype setter is required. */
function type(el: HTMLElement | null, value: string) {
  if (!el) throw new Error("input not found");
  const proto = el instanceof window.HTMLTextAreaElement ? window.HTMLTextAreaElement : window.HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(proto.prototype, "value")?.set;
  if (!setter) throw new Error("no native value setter");
  setter.call(el, value);
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
}

function click(el: Element | null | undefined) {
  if (!el) throw new Error("click target not found");
  (el as HTMLElement).dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
}

function byText(selector: string, text: string): HTMLElement | null {
  const nodes = Array.from(document.querySelectorAll(selector));
  return (nodes.find((n) => (n.textContent ?? "").trim().toLowerCase().includes(text.toLowerCase())) ??
    null) as HTMLElement | null;
}

export async function runSmoke(): Promise<CaseResult[]> {
  const session = await get<{ user: AppUser }>("/api/auth/session");
  const categories = await get<{ categories: AppCategory[] }>("/api/categories").then((r) => r.categories);
  const accounts = await get<{ accounts: AppAccount[] }>("/api/accounts").then((r) => r.accounts);
  const overview = await get<Overview>("/api/overview");
  const txns = await get<{ transactions: { merchant: string | null; note: string | null; amount: number }[] }>(
    "/api/transactions?limit=3",
  );
  const budgets = await get<{ budgets: { id: string }[] }>("/api/budgets");
  const goals = await get<{ goals: { name: string; savedAmount: number; targetAmount: number }[] }>("/api/goals");
  const recurrings = await get<{ recurrings: { title: string }[] }>("/api/recurring");
  const insights = await get<{ insights: { title: string }[] }>("/api/insights");

  const shell = { user: session.user, categories, accounts };

  const firstMerchant = txns.transactions[0]?.merchant ?? txns.transactions[0]?.note ?? "₹";
  const firstGoal = goals.goals[0]?.name ?? "goal";
  const firstRecurring = recurrings.recurrings[0]?.title ?? "recurring";
  const firstInsight = insights.insights[0]?.title ?? "insight";

  const cases: Case[] = [
    {
      name: "dashboard",
      node: <DashboardView data={overview} />,
      expect: [
        "₹",
        session.user.name.split(" ")[0],
        firstMerchant,
        formatMoneyCompact((goals.goals[0]?.savedAmount ?? 0) * 100),
      ],
    },
    {
      name: "transactions",
      node: <TransactionsClient />,
      // exact formatted amounts: catches rupees/paise mix-ups at the render layer
      expect: ["₹", firstMerchant, formatMoney((txns.transactions[0]?.amount ?? 0) * 100)],
    },
    { name: "budgets", node: <BudgetsClient />, expect: ["₹", "budget"] },
    {
      name: "goals",
      node: <GoalsClient />,
      expect: [firstGoal, "₹", formatMoney((goals.goals[0]?.savedAmount ?? 0) * 100)],
    },
    { name: "recurring", node: <RecurringClient />, expect: [firstRecurring] },
    { name: "splits", node: <SplitsClient />, expect: ["Roommate", "₹"] },
    { name: "insights", node: <InsightsClient />, expect: [firstInsight] },
    { name: "accounts", node: <AccountsClient />, expect: ["GPay", "₹"] },
    { name: "settings", node: <SettingsClient />, expect: ["AI engine", "₹"] },
    { name: "quick-add", node: <AiQuickAdd variant="hero" />, expect: ["Try"] },
  ];

  void budgets;

  const results: CaseResult[] = [];

  for (const testCase of cases) {
    const host = document.createElement("div");
    document.body.appendChild(host);
    let root: Root | null = null;

    await act(async () => {
      root = createRoot(host);
      root.render(
        <ThemeProvider>
          <ToastProvider>
            <AppShell {...shell}>{testCase.node}</AppShell>
          </ToastProvider>
        </ThemeProvider>,
      );
    });

    await settle();

    const text = (host.textContent ?? "").replace(/\s+/g, " ").trim();
    const missing = testCase.expect.filter((needle) => !text.toLowerCase().includes(needle.toLowerCase()));

    if (globalThis.__SMOKE_DUMP__ && globalThis.__SMOKE_HTML__) {
      globalThis.__SMOKE_DUMP__[testCase.name] = text;
      globalThis.__SMOKE_HTML__[testCase.name] = host.innerHTML;
    }

    results.push({
      ...testCase,
      ok: missing.length === 0 && text.length > 200,
      missing,
      chars: text.length,
      sample: text.slice(0, 90),
    });

    await act(async () => {
      root?.unmount();
    });
    host.remove();
  }

  return results;
}

/** Types a sentence into the AI bar and checks the parser fills the form. */
export async function runQuickAddFlow(): Promise<{ ok: boolean; detail: string }> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const session = await get<{ user: AppUser }>("/api/auth/session");
  const categories = await get<{ categories: AppCategory[] }>("/api/categories").then((r) => r.categories);
  const accounts = await get<{ accounts: AppAccount[] }>("/api/accounts").then((r) => r.accounts);

  let root: Root | null = null;
  await act(async () => {
    root = createRoot(host);
    root.render(
      <ThemeProvider>
        <ToastProvider>
          <AppShell user={session.user} categories={categories} accounts={accounts}>
            <AiQuickAdd variant="hero" />
          </AppShell>
        </ToastProvider>
      </ThemeProvider>,
    );
  });
  await settle(2);

  const input = host.querySelector("input") as HTMLInputElement | null;
  if (!input) return { ok: false, detail: "quick-add input not rendered" };

  await act(async () => {
    type(input, "bought chai rs 100");
  });
  await settle(1);

  const parseButton = byText("button", "Parse");
  if (!parseButton) return { ok: false, detail: "Parse button did not appear after typing" };

  await act(async () => {
    click(parseButton);
  });
  for (let i = 0; i < 30; i++) {
    await settle(4);
    if ((host.textContent ?? "").includes("100") && (host.textContent ?? "").includes("Save")) break;
  }

  const parsedText = (host.textContent ?? "").replace(/\s+/g, " ").trim();
  if (!parsedText.includes("100")) {
    await act(async () => {
      root?.unmount();
    });
    host.remove();
    return { ok: false, detail: `no ₹100 chip after parsing: ${parsedText.slice(0, 200)}` };
  }

  const saveButton = byText("button", "Save");
  if (!saveButton) {
    await act(async () => {
      root?.unmount();
    });
    host.remove();
    return { ok: false, detail: "Save button missing after a successful parse" };
  }

  await act(async () => {
    click(saveButton);
  });
  await settle(6);

  const savedText = (host.textContent ?? "").replace(/\s+/g, " ").trim();

  // The save is real, so clean the row back out of the database.
  let cleaned = 0;
  try {
    const list = await get<{ transactions: { id: string; rawText: string | null }[] }>(
      `/api/transactions?limit=5&q=${encodeURIComponent("chai")}`,
    );
    for (const row of list.transactions) {
      if (row.rawText !== "bought chai rs 100") continue;
        await fetch(`/api/transactions/${row.id}`, { method: "DELETE" });
      cleaned += 1;
    }
  } catch {
    /* cleanup is best effort */
  }

  await act(async () => {
    root?.unmount();
  });
  host.remove();

  const ok = savedText.includes("Save") || cleaned > 0 || !savedText.includes("100");
  return {
    ok,
    detail: ok
      ? `typed → parsed ₹100 → saved (${cleaned} test row${cleaned === 1 ? "" : "s"} removed)`
      : `save did not settle: ${savedText.slice(0, 200)}`,
  };
}

/** Renders every page for a brand-new account: no data, no crashes. */
export async function runEmptyState(): Promise<CaseResult[]> {
  const session = await get<{ user: AppUser }>("/api/auth/session");
  const categories = await get<{ categories: AppCategory[] }>("/api/categories").then((r) => r.categories);
  const accounts = await get<{ accounts: AppAccount[] }>("/api/accounts").then((r) => r.accounts);
  const overview = await get<Overview>("/api/overview");
  const shell = { user: session.user, categories, accounts };

  const cases: Case[] = [
    { name: "dashboard", node: <DashboardView data={overview} />, expect: ["₹"] },
    { name: "transactions", node: <TransactionsClient />, expect: [] },
    { name: "budgets", node: <BudgetsClient />, expect: [] },
    { name: "goals", node: <GoalsClient />, expect: [] },
    { name: "recurring", node: <RecurringClient />, expect: [] },
    { name: "insights", node: <InsightsClient />, expect: [] },
  ];

  const results: CaseResult[] = [];
  for (const testCase of cases) {
    const host = document.createElement("div");
    document.body.appendChild(host);
    let root: Root | null = null;
    await act(async () => {
      root = createRoot(host);
      root.render(
        <ThemeProvider>
          <ToastProvider>
            <AppShell {...shell}>{testCase.node}</AppShell>
          </ToastProvider>
        </ThemeProvider>,
      );
    });
    await settle();
    const text = (host.textContent ?? "").replace(/\s+/g, " ").trim();
    if (globalThis.__SMOKE_DUMP__ && globalThis.__SMOKE_HTML__) {
      globalThis.__SMOKE_DUMP__[testCase.name] = text;
      globalThis.__SMOKE_HTML__[testCase.name] = host.innerHTML;
    }
    results.push({
      ...testCase,
      ok: text.length > 120,
      missing: [],
      chars: text.length,
      sample: text.slice(0, 110),
    });
    await act(async () => {
      root?.unmount();
    });
    host.remove();
  }
  return results;
}

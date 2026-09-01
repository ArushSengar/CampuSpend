import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getUserAccounts, getUserCategories, getUserBudgets, loadAnalyticsTxns, applyDueRecurrings } from "@/lib/queries";
import { budgetStatuses, expensesIn } from "@/lib/analytics";
import { formatMoney } from "@/lib/money";
import { endOfMonth, startOfMonth } from "@/lib/dates";
import { AppShell } from "@/components/shell/app-shell";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  await applyDueRecurrings(user.id);

  const [categories, accounts, budgets, txns] = await Promise.all([
    getUserCategories(user.id),
    getUserAccounts(user.id),
    getUserBudgets(user.id),
    loadAnalyticsTxns(user.id),
  ]);

  const now = new Date();
  const spent = expensesIn(txns, { from: startOfMonth(now), to: now });
  const overall = budgetStatuses(txns, budgets, now).find((b) => b.categoryId === null);
  void endOfMonth;

  return (
    <AppShell
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        college: user.college,
        avatarHue: user.avatarHue,
        monthlyIncome: user.monthlyIncome,
        currency: user.currency,
        isDemo: user.isDemo,
        aiProvider: user.aiProvider,
        createdAt: user.createdAt.toISOString(),
      }}
      categories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        emoji: c.emoji,
        color: c.color,
        kind: c.kind,
        archived: c.archived,
      }))}
      accounts={accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        upiId: a.upiId,
        balance: a.balance / 100,
        color: a.color,
        icon: a.icon,
        isDefault: a.isDefault,
        archived: a.archived,
      }))}
      month={{
        spent: formatMoney(spent),
        budget: overall ? formatMoney(overall.limit) : null,
        percent: overall ? Math.min(100, (spent / Math.max(1, overall.limit)) * 100) : 0,
      }}
    >
      {children}
    </AppShell>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeIndianRupee,
  CalendarDays,
  ChartPie,
  Coins,
  Flame,
  Plus,
  Printer,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
  Sparkles,
} from "lucide-react";
import { AiQuickAdd } from "@/components/ai/quick-add";
import { KpiCard } from "./kpi-card";
import { InsightsPanel } from "./insights-panel";
import { StatementModal } from "./statement-modal";
import { AreaChart } from "@/components/charts/area-chart";
import { DonutChart } from "@/components/charts/donut";
import { BarChart, MethodBars } from "@/components/charts/bar-chart";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, ProgressBar } from "@/components/ui/feedback";
import { TransactionFeed } from "@/components/transactions/transaction-feed";
import { TransactionForm, draftFromTxn, type TxnDTO } from "@/components/transactions/transaction-form";
import { ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useShell } from "@/components/shell/app-shell";
import { api } from "@/lib/client/api";
import { formatMoney, formatMoneyCompact, safePercent } from "@/lib/money";
import { formatDateLong, greeting } from "@/lib/dates";
import type { Overview } from "@/lib/overview";

export function DashboardView({ data }: { data: Overview }) {
  const router = useRouter();
  const toast = useToast();
  const { openTransactionForm } = useShell();

  const [editing, setEditing] = useState<TxnDTO | null>(null);
  const [deleting, setDeleting] = useState<TxnDTO | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [statementOpen, setStatementOpen] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const overallBudget = data.budgets.find((b) => b.categoryId === null);
  const monthDelta =
    data.month.prevSameDay > 0
      ? Math.round(((data.month.expense - data.month.prevSameDay) / data.month.prevSameDay) * 100)
      : 0;

  const spark = useMemo(() => data.daily.slice(-14).map((d) => d.value), [data.daily]);

  const confirmDelete = async () => {
    if (!deleting) return;
    const id = deleting.id;
    setPendingIds((p) => new Set(p).add(id));
    setDeleteLoading(true);
    try {
      await api.del(`/api/transactions/${id}`);
      setDeleting(null);
      toast.success("Transaction deleted");
      router.refresh();
    } catch (e) {
      toast.error("Could not delete", e instanceof Error ? e.message : undefined);
    } finally {
      setPendingIds((p) => {
        const next = new Set(p);
        next.delete(id);
        return next;
      });
      setDeleteLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-[84rem] space-y-5">
      {/* ----------------- Hero & Quick Add ----------------- */}
      <section className="animate-fade-up">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black tracking-tight text-fg sm:text-2xl">
              {greeting(new Date(data.now))}, {data.userName.split(" ")[0]}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>{formatDateLong(data.now)}</span>
              {data.streak.current > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-[0.65rem] font-bold text-warning border border-warning/20">
                  <Flame className="h-3 w-3" />
                  {data.streak.current}d Streak
                </span>
              ) : null}
              <span className="text-subtle">· {data.totals.transactions} total entries</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatementOpen(true)}
              leftIcon={<Printer className="h-3.5 w-3.5" />}
              className="text-xs"
            >
              Statement
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openTransactionForm()}
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              className="text-xs"
            >
              Log
            </Button>
            <Link href="/insights">
              <Button size="sm" variant="primary" leftIcon={<Sparkles className="h-3.5 w-3.5" />} className="text-xs">
                AI Coach
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-4">
          <AiQuickAdd variant="hero" />
        </div>
      </section>

      {/* ----------------- KPIs ----------------- */}
      <section className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="This Month"
          value={formatMoney(data.month.expense)}
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          tone="danger"
          delta={
            data.month.prevSameDay > 0 ? { value: monthDelta, label: "vs last mo", good: "down" } : undefined
          }
          hint={
            data.month.dayOfMonth <= 3
              ? `${data.month.txnCount} logs · ${formatMoney(data.last30.expense)} in 30d`
              : `${data.month.txnCount} logs · ${formatMoney(data.today.expense)} today`
          }
          spark={spark}
        />
        <KpiCard
          label={overallBudget ? "Budget Balance" : "Month Forecast"}
          value={
            overallBudget
              ? formatMoney(Math.max(0, overallBudget.limit - data.month.expense))
              : formatMoney(data.month.projection)
          }
          icon={<Wallet className="h-3.5 w-3.5" />}
          tone={overallBudget && overallBudget.percent >= 90 ? "danger" : "primary"}
          hint={
            overallBudget
              ? `${formatMoney(overallBudget.limit)} limit · ${data.month.daysLeft}d left`
              : `Estimated month-end total`
          }
          footer={
            overallBudget ? (
              <div className="space-y-1.5">
                <ProgressBar
                  value={overallBudget.percent}
                  tone={overallBudget.percent >= 90 ? "danger" : "primary"}
                  height={5}
                />
                <div className="flex justify-between text-[0.65rem] text-subtle">
                  <span>{Math.round(overallBudget.percent)}% spent</span>
                  <span>Day {data.month.dayOfMonth}/{data.month.daysInMonth}</span>
                </div>
              </div>
            ) : undefined
          }
        />
        <KpiCard
          label="Daily Burn Rate"
          value={formatMoney(data.last30.avgDaily)}
          icon={<Coins className="h-3.5 w-3.5" />}
          tone="info"
          hint={`30-day daily average`}
          footer={
            <div className="flex items-center justify-between text-[0.65rem] text-subtle">
              <span>Weekday {formatMoney(data.weekdayVsWeekend.weekday)}</span>
              <span>Weekend {formatMoney(data.weekdayVsWeekend.weekend)}</span>
            </div>
          }
        />
        <KpiCard
          label={data.month.net >= 0 ? "Net Savings" : "Deficit"}
          value={formatMoney(Math.abs(data.month.net))}
          icon={
            data.month.net >= 0 ? (
              <BadgeIndianRupee className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )
          }
          tone={data.month.net >= 0 ? "success" : "danger"}
          hint={`${formatMoney(data.month.income)} in · ${formatMoney(data.month.expense)} out`}
          footer={
            <div className="flex items-center justify-between text-[0.65rem] text-subtle">
              <span>Savings Rate</span>
              <span className="font-bold text-fg">
                {data.month.income > 0
                  ? `${Math.round(safePercent(Math.max(0, data.month.net), data.month.income))}%`
                  : "—"}
              </span>
            </div>
          }
        />
      </section>

      {/* ----------------- Charts ----------------- */}
      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="30-Day Trend"
            subtitle="Daily expense vs income"
            icon={<TrendingUp className="h-4 w-4" />}
            action={
              <div className="flex items-center gap-3 text-[0.68rem] text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary" /> Spend
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-success" /> Income
                </span>
              </div>
            }
          />
          <CardBody>
            {data.daily.some((d) => d.value > 0) ? (
              <AreaChart data={data.daily} height={220} />
            ) : (
              <EmptyState
                compact
                icon={<TrendingUp className="h-5 w-5" />}
                title="No 30-day activity"
                description="Log a transaction to generate your chart."
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Category Share"
            subtitle="Monthly breakdown"
            icon={<ChartPie className="h-4 w-4" />}
            action={
              <Link href="/transactions" className="text-xs font-bold text-primary hover:underline">
                View All
              </Link>
            }
          />
          <CardBody>
            {data.categories.length ? (
              <DonutChart
                slices={data.categories.map((c) => ({
                  id: c.id,
                  name: c.name,
                  emoji: c.emoji,
                  color: c.color,
                  amount: c.amount,
                  count: c.count,
                }))}
                size={168}
                thickness={22}
                centerLabel="This Month"
                centerValue={formatMoneyCompact(data.categoryTotal)}
              />
            ) : (
              <EmptyState
                compact
                icon={<ChartPie className="h-5 w-5" />}
                title="No categories"
                description="Add an expense to view distribution."
              />
            )}
          </CardBody>
        </Card>
      </section>

      {/* ----------------- Budgets & Wallets ----------------- */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader
            title="Budgets"
            subtitle={`${data.budgets.filter((b) => b.status !== "safe").length} caps need attention`}
            icon={<Target className="h-4 w-4" />}
            action={
              <Link href="/budgets" className="text-xs font-bold text-primary hover:underline">
                Manage
              </Link>
            }
            dense
          />
          <CardBody className="space-y-3.5 p-4">
            {data.budgets.length ? (
              data.budgets.slice(0, 4).map((b) => (
                <div key={b.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span>{b.emoji}</span>
                      <span className="truncate font-bold text-fg">{b.name}</span>
                      {b.status === "over" ? <Badge tone="danger">over</Badge> : null}
                    </span>
                    <span className="tabular shrink-0 text-[0.7rem] text-muted">
                      {formatMoneyCompact(b.spent)} / {formatMoneyCompact(b.limit)}
                    </span>
                  </div>
                  <ProgressBar
                    value={b.percent}
                    tone={b.status === "over" ? "danger" : b.status === "watch" ? "warning" : "success"}
                    height={5}
                  />
                </div>
              ))
            ) : (
              <EmptyState
                compact
                icon={<Target className="h-5 w-5" />}
                title="No budget caps"
                description="Create category limits to stay on track."
                action={
                  <Link href="/budgets">
                    <Button size="xs" variant="secondary">
                      New Budget
                    </Button>
                  </Link>
                }
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Savings Goals"
            subtitle="Targets & Milestones"
            icon={<Target className="h-4 w-4" />}
            action={
              <Link href="/goals" className="text-xs font-bold text-primary hover:underline">
                Manage
              </Link>
            }
            dense
          />
          <CardBody className="space-y-3.5 p-4">
            {data.goals.length ? (
              data.goals.slice(0, 3).map((g) => {
                const pct = safePercent(g.savedAmount, g.targetAmount);
                return (
                  <div key={g.id}>
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span>{g.emoji}</span>
                        <span className="truncate font-bold text-fg">{g.name}</span>
                      </span>
                      <span className="tabular shrink-0 text-[0.7rem] text-muted">
                        {formatMoneyCompact(g.savedAmount * 100)} / {formatMoneyCompact(g.targetAmount * 100)}
                      </span>
                    </div>
                    <ProgressBar value={pct} tone="success" height={5} />
                    <p className="mt-1 text-[0.65rem] text-subtle">{Math.round(pct)}% funded</p>
                  </div>
                );
              })
            ) : (
              <EmptyState
                compact
                icon={<Target className="h-5 w-5" />}
                title="No goals"
                description="Set a target to save with intention."
                action={
                  <Link href="/goals">
                    <Button size="xs" variant="secondary">
                      New Goal
                    </Button>
                  </Link>
                }
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Payment Accounts"
            subtitle="UPI & Cash Wallets"
            icon={<Wallet className="h-4 w-4" />}
            action={
              <Link href="/accounts" className="text-xs font-bold text-primary hover:underline">
                Wallets
              </Link>
            }
            dense
          />
          <CardBody className="p-4">
            <MethodBars data={data.methods} />
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/60 pt-3">
              {data.accounts.slice(0, 4).map((a) => (
                <div key={a.id} className="rounded-xl border border-border/70 bg-surface-2/60 p-2.5">
                  <p className="truncate text-[0.65rem] font-bold text-subtle uppercase">{a.name}</p>
                  <p className="tabular text-xs font-extrabold text-fg mt-0.5">{formatMoney(a.balance * 100)}</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </section>

      {/* ----------------- Coach Insights & Recent Feed ----------------- */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Coach Insights"
            subtitle="Ledger intelligence"
            icon={<Sparkles className="h-4 w-4 text-primary" />}
            action={
              <Link href="/insights" className="text-xs font-bold text-primary hover:underline">
                Ask AI
              </Link>
            }
          />
          <CardBody className="p-4">
            <InsightsPanel insights={data.insights} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Recent Activity"
            subtitle="Latest transactions"
            icon={<CalendarDays className="h-4 w-4" />}
            action={
              <Link
                href="/transactions"
                className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
              >
                All <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          <div className="max-h-[28rem] overflow-y-auto">
            <TransactionFeed
              transactions={data.recent}
              pendingIds={pendingIds}
              onEdit={(t) => setEditing(t)}
              onDelete={(t) => setDeleting(t)}
              emptyTitle="No activity yet"
              emptyDescription="Type “chai 20” above to record your first entry."
            />
          </div>
        </Card>
      </section>

      {/* ----------------- Top Merchants & 6-Month Flow ----------------- */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Top Merchants"
            subtitle="Most frequent stops"
            icon={<Coins className="h-4 w-4" />}
            dense
          />
          <CardBody className="space-y-1.5 p-4">
            {data.merchants.length ? (
              data.merchants.map((m) => (
                <div
                  key={m.merchant}
                  className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-2/70 transition"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-surface-3 text-[0.65rem] font-black text-muted">
                    {m.merchant.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-fg">{m.merchant}</p>
                    <p className="text-[0.65rem] text-subtle">
                      {m.count} logs · avg {formatMoney(Math.round(m.amount / m.count))}
                    </p>
                  </div>
                  <span className="tabular text-xs font-bold text-fg">{formatMoney(m.amount)}</span>
                </div>
              ))
            ) : (
              <EmptyState compact icon={<Coins className="h-5 w-5" />} title="No merchants yet" />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="6-Month Flow"
            subtitle="Inflow vs Outflow"
            icon={<TrendingUp className="h-4 w-4" />}
            dense
          />
          <CardBody className="p-4">
            <BarChart data={data.monthly} height={160} />
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
              {data.recurring.length ? (
                data.recurring.slice(0, 3).map((r) => (
                  <span
                    key={r.id}
                    className="rounded-full border border-border/70 bg-surface-2/70 px-2.5 py-0.5 text-[0.65rem] font-medium text-muted"
                  >
                    <CalendarDays className="mr-1 inline h-2.5 w-2.5" />
                    {r.title} · {formatMoney(r.amount * 100)}
                  </span>
                ))
              ) : (
                <p className="text-[0.65rem] text-subtle">
                  No active subscriptions · Add rent or recharges in{" "}
                  <Link href="/recurring" className="text-primary hover:underline">
                    Recurring
                  </Link>
                </p>
              )}
            </div>
          </CardBody>
        </Card>
      </section>

      <TransactionForm
        open={Boolean(editing)}
        draft={editing ? draftFromTxn(editing) : null}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
        title="Delete transaction?"
        message={`${deleting?.merchant ?? "This entry"} · ${formatMoney((deleting?.amount ?? 0) * 100)} will be deleted and your account balance restored.`}
      />

      <StatementModal
        open={statementOpen}
        onClose={() => setStatementOpen(false)}
        data={data}
      />
    </div>
  );
}

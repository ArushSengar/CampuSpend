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
  PieChart,
  Plus,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { AiQuickAdd } from "@/components/ai/quick-add";
import { KpiCard } from "./kpi-card";
import { InsightsPanel } from "./insights-panel";
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
    const previous = deleting;
    setDeleting(null);
    try {
      await api.del(`/api/transactions/${id}`);
      toast.success("Deleted", `${previous.merchant ?? "Transaction"} removed.`);
      router.refresh();
    } catch (e) {
      toast.error("Couldn't delete", e instanceof Error ? e.message : undefined);
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
      {/* ---------------------------------- hero --------------------------------- */}
      <section className="animate-fade-up">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[1.35rem] font-bold tracking-tight text-fg sm:text-[1.6rem]">
              {greeting(new Date(data.now))}, {data.userName.split(" ")[0]} 👋
            </h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              <span>{formatDateLong(data.now)}</span>
              {data.streak.current > 0 ? (
                <Badge tone="warning" icon={<Flame className="h-3 w-3" />}>
                  {data.streak.current}-day streak
                </Badge>
              ) : null}
              <span className="text-subtle">· {data.totals.transactions} transactions tracked</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => openTransactionForm()} leftIcon={<Plus className="h-4 w-4" />}>
              Manual entry
            </Button>
            <Link href="/insights">
              <Button size="sm" leftIcon={<PieChart className="h-4 w-4" />}>
                AI Coach
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-4">
          <AiQuickAdd variant="hero" />
        </div>
      </section>

      {/* ----------------------------------- KPIs --------------------------------- */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Spent this month"
          value={formatMoney(data.month.expense)}
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          tone="danger"
          delta={{ value: monthDelta, label: "vs last month", good: "down" }}
          hint={
            data.month.dayOfMonth <= 3
              ? `${data.month.txnCount} so far · ${formatMoney(data.last30.expense)} in the last 30 days`
              : `${data.month.txnCount} transactions · ${formatMoney(data.today.expense)} today`
          }
          spark={spark}
        />
        <KpiCard
          label={overallBudget ? "Left in budget" : "Projected month-end"}
          value={
            overallBudget
              ? formatMoney(Math.max(0, overallBudget.limit - data.month.expense))
              : formatMoney(data.month.projection)
          }
          icon={<Wallet className="h-3.5 w-3.5" />}
          tone={overallBudget && overallBudget.percent >= 90 ? "danger" : "primary"}
          hint={
            overallBudget
              ? `${formatMoney(overallBudget.limit)} monthly budget · ${data.month.daysLeft} days left`
              : `At your current pace, by month end`
          }
          footer={
            overallBudget ? (
              <div className="space-y-1.5">
                <ProgressBar value={overallBudget.percent} tone={overallBudget.percent >= 90 ? "danger" : "primary"} height={6} />
                <div className="flex justify-between text-[0.68rem] text-subtle">
                  <span>{Math.round(overallBudget.percent)}% used</span>
                  <span>Day {data.month.dayOfMonth}/{data.month.daysInMonth}</span>
                </div>
              </div>
            ) : undefined
          }
        />
        <KpiCard
          label="Daily pace"
          value={formatMoney(data.last30.avgDaily)}
          icon={<Coins className="h-3.5 w-3.5" />}
          tone="info"
          hint={`Average over the last 30 days`}
          footer={
            <div className="flex items-center justify-between text-[0.68rem] text-subtle">
              <span>Weekday avg {formatMoney(data.weekdayVsWeekend.weekday)}</span>
              <span>Weekend {formatMoney(data.weekdayVsWeekend.weekend)}</span>
            </div>
          }
        />
        <KpiCard
          label={data.month.net >= 0 ? "Saved this month" : "Overspent"}
          value={formatMoney(Math.abs(data.month.net))}
          icon={data.month.net >= 0 ? <BadgeIndianRupee className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          tone={data.month.net >= 0 ? "success" : "danger"}
          hint={`${formatMoney(data.month.income)} in · ${formatMoney(data.month.expense)} out`}
          footer={
            <div className="flex items-center justify-between text-[0.68rem] text-subtle">
              <span>Savings rate</span>
              <span className="font-semibold text-fg">
                {data.month.income > 0 ? `${Math.round(safePercent(Math.max(0, data.month.net), data.month.income))}%` : "—"}
              </span>
            </div>
          }
        />
      </section>

      {/* --------------------------------- charts ---------------------------------- */}
      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Last 30 days"
            subtitle="Every rupee out, day by day"
            icon={<TrendingUp className="h-4 w-4" />}
            action={
              <div className="flex items-center gap-3 text-[0.7rem] text-muted">
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
              <AreaChart data={data.daily} height={230} />
            ) : (
              <EmptyState
                compact
                icon={<TrendingUp className="h-5 w-5" />}
                title="No spending in the last 30 days"
                description="Log something and this chart fills in immediately."
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Where it went"
            subtitle="This month, by category"
            icon={<ChartPie className="h-4 w-4" />}
            action={
              <Link href="/transactions" className="text-xs font-semibold text-primary hover:underline">
                All
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
                centerLabel="this month"
                centerValue={formatMoneyCompact(data.categoryTotal)}
              />
            ) : (
              <EmptyState
                compact
                icon={<ChartPie className="h-5 w-5" />}
                title="No categories yet"
                description="Add your first expense to see the breakdown."
              />
            )}
          </CardBody>
        </Card>
      </section>

      {/* ------------------------------ budgets + goals --------------------------- */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader
            title="Budgets"
            subtitle={`${data.budgets.filter((b) => b.status !== "safe").length} need attention`}
            icon={<Target className="h-4 w-4" />}
            action={
              <Link href="/budgets" className="text-xs font-semibold text-primary hover:underline">
                Manage
              </Link>
            }
            dense
          />
          <CardBody className="space-y-3.5 p-4">
            {data.budgets.length ? (
              data.budgets.slice(0, 4).map((b) => (
                <div key={b.id}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span>{b.emoji}</span>
                      <span className="truncate font-medium text-fg">{b.name}</span>
                      {b.status === "over" ? <Badge tone="danger">over</Badge> : null}
                    </span>
                    <span className="tabular shrink-0 text-muted">
                      {formatMoneyCompact(b.spent)} / {formatMoneyCompact(b.limit)}
                    </span>
                  </div>
                  <ProgressBar
                    value={b.percent}
                    tone={b.status === "over" ? "danger" : b.status === "watch" ? "warning" : "success"}
                    height={6}
                  />
                </div>
              ))
            ) : (
              <EmptyState
                compact
                icon={<Target className="h-5 w-5" />}
                title="No budgets set"
                description="Caps per category keep the month honest."
                action={
                  <Link href="/budgets">
                    <Button size="xs" variant="secondary">
                      Create a budget
                    </Button>
                  </Link>
                }
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Goals"
            subtitle="Money you're keeping"
            icon={<Target className="h-4 w-4" />}
            action={
              <Link href="/goals" className="text-xs font-semibold text-primary hover:underline">
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
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span>{g.emoji}</span>
                        <span className="truncate font-medium text-fg">{g.name}</span>
                      </span>
                      <span className="tabular shrink-0 text-muted">
                        {formatMoneyCompact(g.savedAmount)} / {formatMoneyCompact(g.targetAmount)}
                      </span>
                    </div>
                    <ProgressBar value={pct} tone="success" height={6} />
                    <p className="mt-1 text-[0.68rem] text-subtle">{Math.round(pct)}% funded</p>
                  </div>
                );
              })
            ) : (
              <EmptyState
                compact
                icon={<Target className="h-5 w-5" />}
                title="No goals yet"
                description="A laptop, a trip, a buffer — give your savings a name."
                action={
                  <Link href="/goals">
                    <Button size="xs" variant="secondary">
                      Add a goal
                    </Button>
                  </Link>
                }
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="UPI vs cash"
            subtitle="How you actually pay"
            icon={<Wallet className="h-4 w-4" />}
            action={
              <Link href="/accounts" className="text-xs font-semibold text-primary hover:underline">
                Wallets
              </Link>
            }
            dense
          />
          <CardBody className="p-4">
            <MethodBars data={data.methods} />
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3">
              {data.accounts.slice(0, 4).map((a) => (
                <div key={a.id} className="rounded-lg border border-border bg-surface-2 px-2.5 py-2">
                  <p className="truncate text-[0.68rem] text-subtle">{a.name}</p>
                  <p className="tabular text-sm font-semibold text-fg">{formatMoney(a.balance * 100)}</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </section>

      {/* ------------------------------ insights + feed --------------------------- */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="AI Coach"
            subtitle="What your numbers are saying"
            icon={<span className="text-base">✨</span>}
            action={
              <Link href="/insights" className="text-xs font-semibold text-primary hover:underline">
                Ask anything
              </Link>
            }
          />
          <CardBody className="p-4">
            <InsightsPanel insights={data.insights} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Recent activity"
            subtitle="Latest entries across UPI and cash"
            icon={<CalendarDays className="h-4 w-4" />}
            action={
              <Link href="/transactions" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          <div className="max-h-[30rem] overflow-y-auto">
            <TransactionFeed
              transactions={data.recent}
              pendingIds={pendingIds}
              onEdit={(t) => setEditing(t)}
              onDelete={(t) => setDeleting(t)}
              emptyTitle="Nothing logged yet"
              emptyDescription="Type “chai 20” above and CampuSpend will file it for you."
            />
          </div>
        </Card>
      </section>

      {/* ------------------------------ merchants/history -------------------------- */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Top merchants" subtitle="This month" icon={<Coins className="h-4 w-4" />} dense />
          <CardBody className="space-y-2 p-4">
            {data.merchants.length ? (
              data.merchants.map((m) => (
                <div key={m.merchant} className="flex items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-surface-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-xs font-bold text-muted">
                    {m.merchant.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{m.merchant}</p>
                    <p className="text-[0.68rem] text-subtle">
                      {m.count} visits · avg {formatMoney(Math.round(m.amount / m.count))}
                    </p>
                  </div>
                  <span className="tabular text-sm font-semibold text-fg">{formatMoney(m.amount)}</span>
                </div>
              ))
            ) : (
              <EmptyState compact icon={<Coins className="h-5 w-5" />} title="No merchants yet" />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Income vs spending"
            subtitle="Last 6 months"
            icon={<TrendingUp className="h-4 w-4" />}
            dense
          />
          <CardBody className="p-4">
            <BarChart data={data.monthly} height={170} />
            <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
              {data.recurring.length ? (
                data.recurring.slice(0, 3).map((r) => (
                  <span key={r.id} className="rounded-lg border border-border bg-surface-2 px-2 py-1 text-[0.68rem] text-muted">
                    <CalendarDays className="mr-1 inline h-3 w-3" />
                    {r.title} · {formatMoney(r.amount * 100)}
                  </span>
                ))
              ) : (
                <p className="text-[0.68rem] text-subtle">
                  No recurring rules yet — add rent or recharges in{" "}
                  <Link href="/recurring" className="text-primary hover:underline">
                    Recurring
                  </Link>
                  .
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
        title="Delete this transaction?"
        message={`${deleting?.merchant ?? "This entry"} · ${formatMoney((deleting?.amount ?? 0) * 100)} will be removed and your wallet balance restored.`}
      />
    </div>
  );
}

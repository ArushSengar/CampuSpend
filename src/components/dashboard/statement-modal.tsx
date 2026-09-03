"use client";

import { useState } from "react";
import { Printer, Receipt, Calendar } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import type { Overview } from "@/lib/overview";
import { formatMoney } from "@/lib/money";

export function StatementModal({
  open,
  onClose,
  data,
}: {
  open: boolean;
  onClose: () => void;
  data: Overview;
}) {
  const [period, setPeriod] = useState<"current" | "prev">("current");

  const isCurrent = period === "current";
  const expenseTotal = isCurrent ? data.month.expense : data.month.prevExpense;
  const incomeTotal = isCurrent ? data.month.income : 0;
  const netTotal = incomeTotal - expenseTotal;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Monthly Statement"
      description="Formatted for reimbursement and records."
      size="lg"
      footer={
        <div className="flex justify-end gap-2 print:hidden">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button size="sm" onClick={handlePrint} className="flex items-center gap-1.5 text-xs">
            <Printer className="h-3.5 w-3.5" />
            <span>Print PDF</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Period Selector (Hidden in Print) */}
        <div className="flex items-center justify-between rounded-2xl border border-border/80 bg-surface-2/60 p-2.5 print:hidden">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-bold text-fg">Period:</span>
          </div>
          <Select
            value={period}
            onChange={(e) => setPeriod(e.target.value as "current" | "prev")}
            className="h-7.5 w-40 text-xs"
          >
            <option value="current">September 2026</option>
            <option value="prev">August 2026</option>
          </Select>
        </div>

        {/* Printable Document Container */}
        <div className="rounded-2xl border border-border/80 bg-surface/90 p-5 print:border-none print:p-0 print:shadow-none space-y-4.5">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-border/80 pb-3.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid h-7.5 w-7.5 place-items-center rounded-xl bg-primary text-white font-bold shadow-sm">
                  <Receipt className="h-4 w-4" />
                </span>
                <span className="text-base font-black text-fg">CampuSpend Ledger</span>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                {isCurrent ? "September 2026" : "August 2026"}
              </p>
            </div>

            <div className="text-right text-xs">
              <p className="font-bold text-fg">{data.userName}</p>
              <p className="text-[0.65rem] text-subtle">{new Date().toLocaleDateString("en-IN")}</p>
              <p className="text-[0.65rem] text-primary font-bold">Verified Ledger</p>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl border border-border/80 bg-surface-2/60 p-3">
              <span className="text-[0.6rem] font-bold uppercase tracking-wider text-subtle">
                Outflow (Spend)
              </span>
              <p className="mt-1 text-base font-black text-danger tabular">{formatMoney(expenseTotal)}</p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-surface-2/60 p-3">
              <span className="text-[0.6rem] font-bold uppercase tracking-wider text-subtle">
                Inflow (Income)
              </span>
              <p className="mt-1 text-base font-black text-success tabular">{formatMoney(incomeTotal)}</p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-surface-2/60 p-3">
              <span className="text-[0.6rem] font-bold uppercase tracking-wider text-subtle">
                Net Balance
              </span>
              <p
                className={`mt-1 text-base font-black tabular ${
                  netTotal >= 0 ? "text-success" : "text-danger"
                }`}
              >
                {formatMoney(netTotal)}
              </p>
            </div>
          </div>

          {/* Category Breakdown Table */}
          <div>
            <h4 className="text-xs font-bold text-fg uppercase tracking-wider mb-2">Category Summary</h4>
            <div className="overflow-x-auto no-scrollbar rounded-2xl border border-border/80 bg-surface-2/40">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-3/60 text-muted font-bold">
                  <tr>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2 text-right">Transactions</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {data.categories.length ? (
                    data.categories.map((c) => (
                      <tr key={c.id}>
                        <td className="px-3 py-2 font-bold text-fg flex items-center gap-1.5">
                          <span>{c.emoji}</span>
                          <span>{c.name}</span>
                        </td>
                        <td className="px-3 py-2 text-right tabular text-muted">{c.count}</td>
                        <td className="px-3 py-2 text-right font-black tabular text-fg">
                          {formatMoney(c.amount)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-3 py-3 text-center text-xs text-subtle">
                        No transactions recorded in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Items Preview */}
          {data.recent.length ? (
            <div>
              <h4 className="text-xs font-bold text-fg uppercase tracking-wider mb-2">
                Recent Itemized Outflows
              </h4>
              <div className="overflow-x-auto no-scrollbar rounded-2xl border border-border/80 bg-surface-2/40">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-3/60 text-muted font-bold">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Payee / Merchant</th>
                      <th className="px-3 py-2">Method</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {data.recent.slice(0, 5).map((t) => (
                      <tr key={t.id}>
                        <td className="px-3 py-1.5 text-muted text-[0.68rem]">
                          {new Date(t.occurredAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </td>
                        <td className="px-3 py-1.5 font-bold text-fg">
                          {t.merchant ?? t.category?.name ?? "Spend"}
                        </td>
                        <td className="px-3 py-1.5 text-[0.65rem] text-muted">{t.method}</td>
                        <td className="px-3 py-1.5 text-right font-black tabular text-fg">
                          {formatMoney(t.amount * 100)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {/* Footer Note */}
          <div className="border-t border-border/60 pt-3 text-center text-[0.65rem] text-subtle">
            Generated via CampuSpend · Verified Student Financial Ledger
          </div>
        </div>
      </div>
    </Modal>
  );
}

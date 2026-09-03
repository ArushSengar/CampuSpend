"use client";

import { useState } from "react";
import {
  Users,
  HandCoins,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Plus,
  Search,
  MessageSquare,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Field } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useAsyncData } from "@/lib/client/use-async-data";
import { api } from "@/lib/client/api";
import { useAppData } from "@/components/providers/app-data";
import { TransactionForm, emptyDraft } from "@/components/transactions/transaction-form";
import { cn } from "@/lib/cn";

type FriendData = {
  name: string;
  totalOwed: number;
  totalSettled: number;
  netBalance: number;
  txns: {
    id: string;
    occurredAt: string;
    title: string;
    totalAmount: number;
    friendShare: number;
    type: "EXPENSE" | "INCOME" | "SETTLEMENT";
    note: string | null;
  }[];
};

type SplitsPayload = {
  summary: {
    totalOwedToYou: number;
    totalYouOwe: number;
    netBalance: number;
    activeFriendsCount: number;
  };
  friends: FriendData[];
};

const INITIAL_SPLITS: SplitsPayload = {
  summary: {
    totalOwedToYou: 0,
    totalYouOwe: 0,
    netBalance: 0,
    activeFriendsCount: 0,
  },
  friends: [],
};

const GRADIENTS = [
  "from-[#0A84FF] to-[#5E5CE6]",
  "from-[#30D158] to-[#0071E3]",
  "from-[#FF9F0A] to-[#FF453A]",
  "from-[#BF5AF2] to-[#FF375F]",
  "from-[#64D2FF] to-[#0A84FF]",
];

export function SplitsClient() {
  const toast = useToast();
  const { accounts, defaultAccountId } = useAppData();
  const [search, setSearch] = useState("");
  const [selectedFriend, setSelectedFriend] = useState<FriendData | null>(null);
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleAccountId, setSettleAccountId] = useState<string | null>(defaultAccountId ?? null);
  const [settleNote, setSettleNote] = useState("");
  const [settling, setSettling] = useState(false);
  const [newTxnOpen, setNewTxnOpen] = useState(false);

  const { data, loading, reload } = useAsyncData<SplitsPayload>(
    "/api/splits",
    INITIAL_SPLITS,
  );

  const friends = data.friends;
  const summary = data.summary;

  const filteredFriends = friends.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()),
  );

  const openSettleModal = (friend: FriendData) => {
    setSelectedFriend(friend);
    setSettleAmount(String(Math.abs(friend.netBalance)));
    setSettleAccountId(defaultAccountId ?? (accounts[0]?.id ?? null));
    setSettleNote(`Settlement with ${friend.name}`);
    setSettleModalOpen(true);
  };

  const handleSettle = async () => {
    if (!selectedFriend) return;
    const amount = parseFloat(settleAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Invalid amount");
      return;
    }

    setSettling(true);
    try {
      await api.post("/api/splits", {
        friendName: selectedFriend.name,
        amount,
        accountId: settleAccountId || null,
        note: settleNote || `Settled ₹${amount} with ${selectedFriend.name}`,
        type: selectedFriend.netBalance > 0 ? "RECEIVE" : "PAY",
      });

      toast.success(
        `Settled ₹${amount.toLocaleString("en-IN")} with ${selectedFriend.name}`,
      );
      setSettleModalOpen(false);
      reload();
    } catch {
      toast.error("Settlement failed");
    } finally {
      setSettling(false);
    }
  };

  const shareWhatsAppReminder = (friend: FriendData) => {
    const amount = Math.abs(friend.netBalance);
    const text = `Hey ${friend.name}! Reminder from CampuSpend: ₹${amount.toLocaleString(
      "en-IN",
    )} is pending for our recent split. UPI/GPay when free! 😊`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black tracking-tight text-fg sm:text-2xl">Roommate Splits</h1>
            <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-[0.65rem] font-bold text-primary">
              Campus Ledger
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            Hostel food, cabs, Swiggy orders, and group dues
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setNewTxnOpen(true)}
          leftIcon={<Plus className="h-4 w-4" />}
          className="text-xs h-9 px-4 font-semibold"
        >
          Split Bill
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3.5 sm:grid-cols-3">
        <Card className="p-4.5">
          <div className="flex items-center justify-between">
            <span className="text-[0.65rem] font-bold uppercase tracking-wider text-subtle">
              You are owed
            </span>
            <span className="grid h-7 w-7 place-items-center rounded-xl bg-success-soft text-success border border-success/20">
              <ArrowDownLeft className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="tabular mt-2 text-2xl font-black tracking-tight text-success">
            ₹{summary.totalOwedToYou.toLocaleString("en-IN")}
          </p>
          <p className="mt-1 text-[0.68rem] text-subtle">
            {friends.filter((f) => f.netBalance > 0).length} roommate(s) owe you
          </p>
        </Card>

        <Card className="p-4.5">
          <div className="flex items-center justify-between">
            <span className="text-[0.65rem] font-bold uppercase tracking-wider text-subtle">
              You owe
            </span>
            <span className="grid h-7 w-7 place-items-center rounded-xl bg-danger-soft text-danger border border-danger/20">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="tabular mt-2 text-2xl font-black tracking-tight text-danger">
            ₹{summary.totalYouOwe.toLocaleString("en-IN")}
          </p>
          <p className="mt-1 text-[0.68rem] text-subtle">
            To {friends.filter((f) => f.netBalance < 0).length} roommate(s)
          </p>
        </Card>

        <Card className="p-4.5">
          <div className="flex items-center justify-between">
            <span className="text-[0.65rem] font-bold uppercase tracking-wider text-subtle">
              Net balance
            </span>
            <span className="grid h-7 w-7 place-items-center rounded-xl bg-primary-soft text-primary border border-primary/20">
              <HandCoins className="h-3.5 w-3.5" />
            </span>
          </div>
          <p
            className={cn(
              "tabular mt-2 text-2xl font-black tracking-tight",
              summary.netBalance >= 0 ? "text-fg" : "text-danger",
            )}
          >
            {summary.netBalance >= 0 ? "+" : "−"}₹
            {Math.abs(summary.netBalance).toLocaleString("en-IN")}
          </p>
          <p className="mt-1 text-[0.68rem] text-subtle">
            {summary.netBalance >= 0 ? "In your favor" : "You need to settle"}
          </p>
        </Card>
      </div>

      {/* Main Friends List & Debt Directory */}
      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-fg">Roommates</h2>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted">
              {friends.length}
            </span>
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search roommate…"
              className="h-8.5 pl-9 text-xs"
            />
          </div>
        </div>

        {loading ? (
          <div className="mt-4 space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface-2/60" />
            ))}
          </div>
        ) : filteredFriends.length === 0 ? (
          <div className="my-10 flex flex-col items-center justify-center text-center">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary-soft text-primary">
              <Users className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm font-bold text-fg">No split records found</p>
            <p className="mt-1 max-w-sm text-xs text-muted">
              Use &ldquo;Split Bill&rdquo; or add roommate shares when logging an expense.
            </p>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-border/60">
            {filteredFriends.map((friend, idx) => {
              const isSettled = friend.netBalance === 0;
              const owesYou = friend.netBalance > 0;
              const gradient = GRADIENTS[idx % GRADIENTS.length];

              return (
                <div
                  key={friend.name}
                  className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between hover:bg-surface-2/30 rounded-xl px-2 transition"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-xs font-black text-white shadow-sm",
                        gradient,
                      )}
                    >
                      {friend.name.slice(0, 2).toUpperCase()}
                    </span>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-fg">{friend.name}</span>
                        {isSettled ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[0.65rem] font-bold text-success">
                            <CheckCircle2 className="h-3 w-3" /> Settled
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[0.7rem] text-muted">
                        {friend.txns.length} shared transaction(s)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <div className="text-right">
                      <p
                        className={cn(
                          "tabular text-sm font-black",
                          isSettled
                            ? "text-subtle"
                            : owesYou
                              ? "text-success"
                              : "text-danger",
                        )}
                      >
                        {isSettled
                          ? "₹0"
                          : `${owesYou ? "+" : "−"}₹${Math.abs(friend.netBalance).toLocaleString("en-IN")}`}
                      </p>
                      <p className="text-[0.65rem] text-subtle">
                        {isSettled
                          ? "All squared up"
                          : owesYou
                            ? "owes you"
                            : "you owe"}
                      </p>
                    </div>

                    {!isSettled ? (
                      <div className="flex items-center gap-1.5">
                        {owesYou ? (
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => shareWhatsAppReminder(friend)}
                            className="flex items-center gap-1 text-xs h-7 px-2.5"
                            title="Send WhatsApp reminder with UPI amount"
                          >
                            <MessageSquare className="h-3 w-3 text-success" />
                            <span className="hidden sm:inline">WhatsApp</span>
                          </Button>
                        ) : null}

                        <Button
                          variant="primary"
                          size="xs"
                          onClick={() => openSettleModal(friend)}
                          className="text-xs h-7 px-3 font-semibold"
                        >
                          Settle
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Settle Up Modal */}
      <Modal
        open={settleModalOpen}
        onClose={() => setSettleModalOpen(false)}
        title={
          selectedFriend
            ? `Settle with ${selectedFriend.name}`
            : "Record Settlement"
        }
        description="Reconcile balance and log settlement entry"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSettleModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSettle}
              loading={settling}
            >
              Confirm Settlement
            </Button>
          </div>
        }
      >
        {selectedFriend ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border/80 bg-surface-2/60 p-3.5">
              <span className="text-[0.65rem] font-bold uppercase tracking-wider text-subtle">
                Outstanding Balance
              </span>
              <p
                className={cn(
                  "tabular text-xl font-black mt-0.5",
                  selectedFriend.netBalance > 0 ? "text-success" : "text-danger",
                )}
              >
                {selectedFriend.netBalance > 0
                  ? `${selectedFriend.name} owes you `
                  : `You owe ${selectedFriend.name} `}
                ₹{Math.abs(selectedFriend.netBalance).toLocaleString("en-IN")}
              </p>
            </div>

            <Field label="Amount to settle (₹)" required>
              <Input
                type="number"
                step="0.01"
                min="1"
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                placeholder="Amount"
                leftIcon={<span className="text-xs text-subtle">₹</span>}
              />
            </Field>

            <Field label="Paid via Account">
              <Select
                value={settleAccountId ?? ""}
                onChange={(e) => setSettleAccountId(e.target.value || null)}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.type})
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Settlement Note">
              <Input
                value={settleNote}
                onChange={(e) => setSettleNote(e.target.value)}
                placeholder="e.g. Settled via GPay"
              />
            </Field>
          </div>
        ) : null}
      </Modal>

      {/* Transaction form for splitting a new bill */}
      <TransactionForm
        open={newTxnOpen}
        onClose={() => setNewTxnOpen(false)}
        draft={emptyDraft({ split: true, splits: [{ name: "", amount: "" }] })}
        onSaved={() => {
          setNewTxnOpen(false);
          reload();
        }}
      />
    </div>
  );
}

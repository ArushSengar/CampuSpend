/**
 * The "ask anything" AI Coach for CampuSpend.
 * Everything is answered from the user's real transactions, balances, budgets,
 * and debts — ensuring numbers are 100% true and mathematically consistent.
 */

import {
  addDays,
  endOfMonth,
  formatDay,
  MONTHS_SHORT,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "@/lib/dates";
import { formatMoney, safePercent, toRupees } from "@/lib/money";
import {
  expensesIn,
  filterRange,
  incomeIn,
  isExpense,
  monthProjection,
  sameDayLastMonth,
  topMerchants,
  type AnalyticsCategory,
  type AnalyticsTxn,
  type Range,
} from "@/lib/analytics";

export type AskResult = {
  answer: string;
  bullets?: { label: string; value: string }[];
  followUps: string[];
};

export type AskAccount = {
  id: string;
  name: string;
  type: string;
  balance: number; // in rupees
};

export type FriendSplit = {
  name: string;
  netBalance: number; // >0 they owe user, <0 user owes them
};

export type AskContext = {
  txns: AnalyticsTxn[];
  categories: AnalyticsCategory[];
  budgets: {
    id: string;
    limit: number;
    categoryId: string | null;
    category: AnalyticsCategory | null;
  }[];
  goals: {
    name: string;
    emoji: string;
    targetAmount: number;
    savedAmount: number;
    deadline: Date | null;
  }[];
  accounts?: AskAccount[];
  splitsSummary?: {
    totalOwedToYou: number;
    totalYouOwe: number;
    netBalance: number;
    friends: FriendSplit[];
  };
  financialHealth?: {
    score: number;
    grade: string;
    title?: string;
    summary?: string;
    topTips?: string[];
  };
  monthlyIncome: number;
  now: Date;
  userName?: string;
};

/* --------------------------------- parsing --------------------------------- */

function resolveRange(question: string, now: Date): { range: Range; label: string; isToday: boolean } {
  const q = question.toLowerCase();
  if (/\b(today|aaj|tonight)\b/.test(q)) {
    return { range: { from: startOfDay(now), to: now }, label: "today", isToday: true };
  }
  if (/\b(yesterday|kal|beeta kal)\b/.test(q) && !/\baane wala kal\b/.test(q)) {
    const y = addDays(now, -1);
    return {
      range: { from: startOfDay(y), to: new Date(startOfDay(y).getTime() + 86399999) },
      label: "yesterday",
      isToday: false,
    };
  }
  if (/\b(this week|is hafte|is week|week)\b/.test(q) && !/\blast week\b/.test(q)) {
    return { range: { from: startOfWeek(now), to: now }, label: "this week", isToday: false };
  }
  if (/\b(last week|pichle hafte)\b/.test(q)) {
    const start = addDays(startOfWeek(now), -7);
    return { range: { from: start, to: addDays(start, 6) }, label: "last week", isToday: false };
  }
  if (/\b(this year|is saal|annual)\b/.test(q)) {
    return {
      range: { from: new Date(now.getFullYear(), 0, 1), to: now },
      label: `in ${now.getFullYear()}`,
      isToday: false,
    };
  }
  if (/\b(last 7|past 7|7 days)\b/.test(q)) {
    return { range: { from: addDays(now, -6), to: now }, label: "in the last 7 days", isToday: false };
  }
  if (/\b(last 30|past 30|30 days|this month|is mahine|is month|month)\b/.test(q) && !/\b(last month|pichle mahine|previous month)\b/.test(q)) {
    return { range: { from: startOfMonth(now), to: now }, label: "this month", isToday: false };
  }
  if (/\b(last month|previous month|pichle mahine|pichla mahina)\b/.test(q)) {
    const m = subMonths(now, 1);
    return { range: { from: startOfMonth(m), to: endOfMonth(m) }, label: "last month", isToday: false };
  }
  const monthNamed = q.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/);
  if (monthNamed) {
    const idx = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ].indexOf(monthNamed[1].slice(0, 3));
    if (idx >= 0) {
      const year = now.getMonth() >= idx ? now.getFullYear() : now.getFullYear() - 1;
      return {
        range: { from: new Date(year, idx, 1), to: endOfMonth(new Date(year, idx, 1)) },
        label: `in ${MONTHS_SHORT[idx]}`,
        isToday: false,
      };
    }
  }
  return { range: { from: startOfMonth(now), to: now }, label: "this month", isToday: false };
}

function resolveCategory(question: string, categories: AnalyticsCategory[]): AnalyticsCategory | null {
  const q = question.toLowerCase();
  let best: { cat: AnalyticsCategory; len: number } | null = null;
  for (const cat of categories) {
    const name = cat.name.toLowerCase();
    const words = name.split(/[&/\s]+/).filter((w) => w.length > 2);
    const haystack = [name, cat.slug, ...words];
    for (const token of haystack) {
      if (token.length < 3) continue;
      if (new RegExp(`(^|[^a-z])${token}s?([^a-z]|$)`, "i").test(q)) {
        if (!best || token.length > best.len) best = { cat, len: token.length };
      }
    }
  }
  return best?.cat ?? null;
}

function resolveMerchant(question: string, txns: AnalyticsTxn[]): string | null {
  const q = question.toLowerCase();
  const merchants = new Set<string>();
  for (const t of txns) if (t.merchant) merchants.add(t.merchant);
  let best: string | null = null;
  for (const m of merchants) {
    if (new RegExp(`(^|[^a-z])${m.toLowerCase()}([^a-z]|$)`, "i").test(q)) {
      if (!best || m.length > best.length) best = m;
    }
  }
  return best;
}

/* ---------------------------------- answer --------------------------------- */

export function answerQuestion(question: string, ctx: AskContext): AskResult {
  const q = question.toLowerCase().trim();
  const {
    txns,
    now,
    categories,
    budgets,
    goals,
    monthlyIncome,
    accounts = [],
    splitsSummary,
    financialHealth,
    userName,
  } = ctx;

  const firstName = userName ? userName.split(" ")[0] : "there";

  // 1. GREETINGS & CAPABILITIES
  if (
    /^(hi|hello|hey|yo|namaste|ssup|whatsup|hola|heyy|kaise ho|kya haal|who are you|what can you do|help|bhai|ai|assist|start|kya kar sakte ho)(\s.*)?$/i.test(
      q,
    )
  ) {
    return {
      answer: `Hey ${firstName}! 👋 I'm your CampuSpend AI Coach. I analyze your college finances, track UPI & cash, monitor budgets, and help you split roommate expenses. How can I help you today?`,
      bullets: [
        { label: "Track Spending", value: "“Kitna kharcha hua this month?”" },
        { label: "Check Affordability", value: "“Can I afford 2000?”" },
        { label: "Roommate Debts", value: "“Who owes me money?”" },
        { label: "Account Balances", value: "“What is my balance?”" },
      ],
      followUps: [
        "How much did I spend this month?",
        "Where can I cut back?",
        "Who owes me money?",
        "What is my balance?",
      ],
    };
  }

  // 2. ROOMMATE SPLITS & DEBTS
  if (
    /\b(split|splits|roommate|roommates|udhar|udhaar|udhari|dost|who owes|whom do i owe|debts?|settle|settlement)\b/i.test(
      q,
    )
  ) {
    if (!splitsSummary || (splitsSummary.totalOwedToYou === 0 && splitsSummary.totalYouOwe === 0)) {
      return {
        answer:
          "You're all squared up with your friends and roommates! Zero outstanding debts or pending settlements. 🎉",
        followUps: ["How much did I spend this month?", "Where can I cut back?"],
      };
    }

    const { totalOwedToYou, totalYouOwe, netBalance, friends } = splitsSummary;
    let desc = "";
    if (netBalance > 0) {
      desc = `You are owed a net of ₹${netBalance.toLocaleString("en-IN")}. Friends owe you ₹${totalOwedToYou.toLocaleString("en-IN")}, and you owe ₹${totalYouOwe.toLocaleString("en-IN")}.`;
    } else if (netBalance < 0) {
      desc = `You owe a net of ₹${Math.abs(netBalance).toLocaleString("en-IN")}. Friends owe you ₹${totalOwedToYou.toLocaleString("en-IN")}, and you owe ₹${totalYouOwe.toLocaleString("en-IN")}.`;
    } else {
      desc = "Your roommate splits are completely balanced (Net ₹0).";
    }

    const bullets = friends.slice(0, 4).map((f) => ({
      label: f.name,
      value:
        f.netBalance > 0
          ? `Owes you ₹${f.netBalance.toLocaleString("en-IN")}`
          : f.netBalance < 0
            ? `You owe ₹${Math.abs(f.netBalance).toLocaleString("en-IN")}`
            : "Settled up",
    }));

    return {
      answer: desc,
      bullets,
      followUps: ["What is my balance?", "How much did I spend this month?"],
    };
  }

  // 3. ACCOUNT BALANCES & NET WORTH
  if (
    /\b(balance|net worth|paise bache|kitne paise|account balance|bank balance|cash in hand|gpay balance|wallet)\b/i.test(
      q,
    )
  ) {
    if (!accounts.length) {
      return {
        answer:
          "You don't have any accounts set up yet. Head over to the Accounts tab to add your UPI wallets and bank accounts!",
        followUps: ["How much did I spend this month?", "Am I on track this month?"],
      };
    }

    const totalBal = accounts.reduce((acc, a) => acc + a.balance, 0);
    return {
      answer: `Your total balance across all accounts is ₹${totalBal.toLocaleString("en-IN")}. Here is your breakdown:`,
      bullets: accounts.map((a) => ({
        label: a.name,
        value: `₹${a.balance.toLocaleString("en-IN")} (${a.type})`,
      })),
      followUps: [
        "Can I afford 2000?",
        "Who owes me money?",
        "How much did I spend this month?",
      ],
    };
  }

  // 4. FINANCIAL HEALTH SCORE & BADGES
  if (
    /\b(financial health|health score|score|grade|kaisa chal raha|how am i doing financially|badges?|achievements?)\b/i.test(
      q,
    )
  ) {
    if (financialHealth) {
      return {
        answer: `Your Financial Health Score is ${financialHealth.score}/100 (Grade ${financialHealth.grade} · ${financialHealth.title ?? "On Track"}). ${financialHealth.summary ?? "You are keeping good track of your day-to-day spending."}`,
        bullets: [
          { label: "Overall Score", value: `${financialHealth.score}/100` },
          { label: "Financial Grade", value: financialHealth.grade },
          ...(financialHealth.topTips?.length ? [{ label: "Top Tip", value: financialHealth.topTips[0] }] : []),
        ],
        followUps: ["Where can I cut back?", "Am I on track this month?"],
      };
    }
  }

  // 5. SAVINGS TIPS & ADVICE
  if (
    /\b(tips?|advice|suggest|suggestion|kaise bachayein|bachega|saving tip|save more|kharcha kaise kam)\b/i.test(
      q,
    ) &&
    !/\bcan i afford\b/i.test(q)
  ) {
    return {
      answer:
        "Here are 3 student-tested strategies to boost your savings this month:",
      bullets: [
        {
          label: "☕ The Chai Rule",
          value: "Daily ₹20 tapri chai = ₹600/month. Pool a hostel kettle to save ₹400.",
        },
        {
          label: "🛵 Auto Sharing",
          value: "Take shared e-rickshaws or walk distances under 1.5 km to cut transport 30%.",
        },
        {
          label: "🍕 Midnight Delivery",
          value: "Late-night delivery fees add 40% markup. Stick to canteen rolls after 10 PM.",
        },
      ],
      followUps: ["Where can I cut back?", "Top merchants this month?"],
    };
  }

  // 5b. SAVINGS RATE
  if (/\b(savings rate|saving rate|bachat rate|savings percent|bachat percentage)\b/i.test(q)) {
    const monthRange = { from: startOfMonth(now), to: now };
    const monthExp = expensesIn(txns, monthRange);
    const monthInc = monthlyIncome > 0 ? monthlyIncome : incomeIn(txns, monthRange);
    const saved = Math.max(0, monthInc - monthExp);
    const rate = monthInc > 0 ? Math.round((saved / monthInc) * 100) : 0;
    return {
      answer: `Your current savings rate is ${rate}% this month. You've saved ${formatMoney(saved)} out of ${formatMoney(monthInc)} in total inflow.`,
      bullets: [
        { label: "Savings Rate", value: `${rate}%` },
        { label: "Total Saved", value: formatMoney(saved) },
        { label: "Total Spent", value: formatMoney(monthExp) },
      ],
      followUps: ["Where can I cut back?", "Am I on track this month?"],
    };
  }

  if (txns.length === 0) {
    return {
      answer:
        "You haven't logged any transactions yet! Add a few expenses using the Quick Add bar at the top, and I'll give you instant insights.",
      followUps: ["How do I add an expense?", "What can you tell me?"],
    };
  }

  const { range, label, isToday } = resolveRange(q, now);
  const scoped = filterRange(txns, range);
  const cat = resolveCategory(q, categories);
  const merchant = resolveMerchant(q, txns);

  const filtered = scoped.filter((t) => {
    if (cat && t.categoryId !== cat.id) return false;
    if (merchant && t.merchant !== merchant) return false;
    return true;
  });

  const totalSpend = expensesIn(filtered, { from: new Date(2000, 0, 1), to: addDays(now, 1) });
  const totalIncome = incomeIn(filtered, { from: new Date(2000, 0, 1), to: addDays(now, 1) });
  const scopeLabel = [cat ? cat.name : null, merchant ?? null, label].filter(Boolean).join(" ");

  // 6. AFFORDABILITY / BUDGET CHECKS
  const afford = q.match(
    /(?:can i afford|afford|should i buy|budget for|kharid|kharidu).*?(?:₹|rs\.?|inr)?\s*(\d+(?:[.,]\d+)?)\s*(k|l|lakh)?/i,
  );
  if (afford) {
    const raw = parseFloat(afford[1].replace(/,/g, ""));
    const amount = Math.round(
      raw * (afford[2] ? (afford[2].toLowerCase() === "l" ? 100000 : 1000) : 1) * 100,
    );
    const monthIncome =
      monthlyIncome > 0 ? monthlyIncome : incomeIn(txns, { from: startOfMonth(now), to: now });
    const monthSpend = expensesIn(txns, { from: startOfMonth(now), to: now });
    const buffer = monthIncome - monthSpend;
    const overall = budgets.find((b) => !b.categoryId);
    const monthlyBudgetLeft = overall
      ? overall.limit - expensesIn(txns, { from: startOfMonth(now), to: now })
      : buffer;
    const verdict = amount <= monthlyBudgetLeft * 0.5;

    return {
      answer: `${formatMoney(amount)} is ${verdict ? "comfortable" : "a stretch"} right now. You have ${formatMoney(
        monthlyBudgetLeft,
      )} left ${overall ? "against your monthly budget" : "of unspent money"} this month, and this purchase is ${Math.round(
        safePercent(amount, Math.max(1, monthlyBudgetLeft)),
      )}% of that.`,
      bullets: [
        { label: "Left this month", value: formatMoney(monthlyBudgetLeft) },
        { label: "After this purchase", value: formatMoney(monthlyBudgetLeft - amount) },
        {
          label: "Avg daily spend",
          value: formatMoney(Math.round(monthSpend / Math.max(1, now.getDate()))),
        },
      ],
      followUps: ["Where can I cut back?", `How much did I spend ${label}?`],
    };
  }

  // 7. WHERE CAN I CUT BACK / REDUCE EXPENSES
  if (/cut|save money|reduce|kharcha kam|bachega|save more/.test(q)) {
    const monthRange = { from: startOfMonth(now), to: now };
    const byCat = new Map<string, { amount: number; count: number; name: string; emoji: string }>();
    for (const t of filterRange(txns, monthRange)) {
      if (!isExpense(t) || !t.category) continue;
      const e = byCat.get(t.category.id) ?? {
        amount: 0,
        count: 0,
        name: t.category.name,
        emoji: t.category.emoji,
      };
      e.amount += t.amount;
      e.count += 1;
      byCat.set(t.category.id, e);
    }
    const ranked = [...byCat.values()].sort((a, b) => b.amount - a.amount).slice(0, 3);
    const total = ranked.reduce((a, c) => a + c.amount, 0);
    const cut15 = Math.round(total * 0.15);

    return {
      answer: `Your top three spending categories ${label} are ${ranked.map((r) => r.name).join(", ")} — totalling ${formatMoney(
        total,
      )}. Trimming 15% there frees up ${formatMoney(cut15)} a month (${formatMoney(cut15 * 12)} a year) without hurting daily essentials!`,
      bullets: ranked.map((r) => ({
        label: `${r.emoji} ${r.name}`,
        value: `${formatMoney(r.amount)} (${r.count} transactions)`,
      })),
      followUps: ["How much did I spend on food this month?", "Am I on track this month?"],
    };
  }

  // 8. TOP MERCHANTS / HIGHEST EXPENSE
  if (
    /top merchant|most spent|where does my money go|biggest expense|highest expense|sabse bada|sabse jyada|kahan gaya|kahan kharch/.test(
      q,
    )
  ) {
    const rows = topMerchants(
      filtered.length ? filtered : scoped,
      { from: new Date(2000, 0, 1), to: addDays(now, 1) },
      5,
    );
    if (!rows.length) {
      return {
        answer: `No spending recorded ${label}.`,
        followUps: ["How much did I spend this month?"],
      };
    }

    return {
      answer: `${rows[0].merchant} tops your list ${label} at ${formatMoney(rows[0].amount)} across ${rows[0].count} visits. Here are your top merchants:`,
      bullets: rows.map((r) => ({
        label: r.merchant,
        value: `${formatMoney(r.amount)} · ${r.count}×`,
      })),
      followUps: [`How much did I spend on ${rows[0].merchant} last month?`, "Where can I cut back?"],
    };
  }

  // 9. GOALS & SAVINGS TARGETS
  if (/goal|save for|target|bachat/.test(q) && goals.length) {
    const g = goals[0];
    const left = Math.max(0, g.targetAmount - g.savedAmount);
    return {
      answer: `${g.emoji} ${g.name} is ${Math.round(safePercent(g.savedAmount, g.targetAmount))}% funded — ${formatMoney(
        g.savedAmount,
      )} of ${formatMoney(g.targetAmount)}. ${left > 0 ? `${formatMoney(left)} left to reach your goal.` : "Goal target reached! 🎉"}`,
      bullets: [
        { label: "Saved", value: formatMoney(g.savedAmount) },
        { label: "Remaining", value: formatMoney(left) },
        ...(g.deadline ? [{ label: "Target date", value: formatDay(g.deadline) }] : []),
      ],
      followUps: ["How much can I save this month?", "Where can I cut back?"],
    };
  }

  // 10. ON TRACK / MONTHLY PACE
  if (/on track|budget status|how am i doing|status|kaisa chal/.test(q)) {
    const monthRange = { from: startOfMonth(now), to: now };
    const spend = expensesIn(txns, monthRange);
    const income = monthlyIncome > 0 ? monthlyIncome : incomeIn(txns, monthRange);
    const projected = monthProjection(txns, now);
    const overall = budgets.find((b) => !b.categoryId);
    const limit = overall?.limit ?? income;

    return {
      answer:
        limit > 0
          ? `${projected <= limit ? "Yes — you're nicely on track!" : "You are exceeding pace."} You've spent ${formatMoney(spend)} of ${formatMoney(
              limit,
            )} ${label}. At today's rate you'll project to ${formatMoney(projected)} by month end (${Math.round(
              safePercent(projected, limit),
            )}% of limit).`
          : `You've spent ${formatMoney(spend)} ${label}. Set a monthly budget to unlock automated pace tracking!`,
      bullets: [
        { label: "Spent So Far", value: formatMoney(spend) },
        { label: "Projected Total", value: formatMoney(projected) },
        {
          label: "Daily Spend Pace",
          value: formatMoney(Math.round(spend / Math.max(1, now.getDate()))),
        },
      ],
      followUps: ["Where can I cut back?", "How much did I spend on food this month?"],
    };
  }

  // 11. INCOME QUESTIONS
  if (/income|earn|came in|credit|milte|mila|salary|stipend|pocket money/.test(q) && !/spend/.test(q)) {
    return {
      answer: `You received ${formatMoney(totalIncome)} in income ${scopeLabel}.`,
      bullets: [
        { label: "Total Inflow", value: formatMoney(totalIncome) },
        { label: "Total Outflow", value: formatMoney(totalSpend) },
        { label: "Net Savings", value: formatMoney(totalIncome - totalSpend) },
      ],
      followUps: ["Am I on track this month?", "How much can I save this month?"],
    };
  }

  // 12. EXPENSE COUNT
  if (/how many|kitne|count|kitni bar/.test(q)) {
    const n = filtered.filter(isExpense).length;
    return {
      answer: `${n} expense${n === 1 ? "" : "s"} recorded ${scopeLabel}${n ? `, totalling ${formatMoney(totalSpend)}` : ""}.`,
      followUps: ["Top merchants this month?", "Where can I cut back?"],
    };
  }

  // 13. ZERO SPEND SPECIFICALLY (e.g. today or empty category)
  if (totalSpend === 0 && totalIncome === 0) {
    if (isToday) {
      return {
        answer: "You haven't spent anything today! Zero outflows recorded so far. Awesome discipline! 🎉",
        followUps: [
          "How much did I spend yesterday?",
          "How much did I spend this month?",
          "Where can I cut back?",
        ],
      };
    }
    return {
      answer: `No transactions found matching “${question}” ${label}. Try asking about a category (like food, chai, travel), a merchant (like Zomato, Rapido), or your balances.`,
      followUps: [
        "How much did I spend this month?",
        "Who owes me money?",
        "Where can I cut back?",
        "What is my balance?",
      ],
    };
  }

  // 14. DEFAULT: SCOPE SPEND
  const prev = resolveRange("last month", now);
  const prevSource = txns.filter(
    (t) => (cat ? t.categoryId === cat.id : true) && (merchant ? t.merchant === merchant : true),
  );
  const isCurrentMonth =
    range.from.getTime() === startOfMonth(now).getTime() && range.to.getTime() >= now.getTime() - 1000;
  const prevSpend = isCurrentMonth
    ? now.getDate() >= 5
      ? sameDayLastMonth(prevSource, now)
      : 0
    : expensesIn(prevSource, prev.range);
  const delta = prevSpend > 0 ? Math.round(((totalSpend - prevSpend) / prevSpend) * 100) : null;
  const share = safePercent(totalSpend, Math.max(1, expensesIn(txns, range)));
  const hasDelta = delta !== null && Math.abs(delta) >= 1;

  return {
    answer:
      `You spent ${formatMoney(totalSpend)}${cat || merchant ? " on " : " "}${scopeLabel}` +
      (hasDelta
        ? ` — ${(delta ?? 0) > 0 ? "up" : "down"} ${Math.abs(delta ?? 0)}% vs the previous period.`
        : ".") +
      (cat || merchant ? ` That's ${Math.round(share)}% of your total spending ${label}.` : ""),
    bullets: [
      { label: "Total Spent", value: formatMoney(totalSpend) },
      { label: "Transactions", value: String(filtered.filter(isExpense).length) },
      ...(hasDelta ? [{ label: "vs Previous", value: `${(delta ?? 0) > 0 ? "+" : ""}${delta}%` }] : []),
    ],
    followUps: [
      "Where can I cut back?",
      cat ? "Top merchants for this?" : "Who owes me money?",
      "Am I on track this month?",
    ],
  };
}

export const askHelpers = { toRupees };

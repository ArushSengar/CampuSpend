/**
 * Realistic demo data for a fictional Indian college student.
 * Deterministic (seeded PRNG) so two loads of the demo look identical.
 */

import { addDays, addMonths, startOfMonth, subMonths } from "@/lib/dates";

export type DemoRow = {
  amount: number; // paise
  type: "EXPENSE" | "INCOME";
  method: "UPI" | "CASH" | "CARD" | "BANK";
  accountKey: "upi" | "cash" | "bank";
  categorySlug: string;
  merchant: string | null;
  note: string | null;
  occurredAt: Date;
  source: "SEED" | "AI";
  rawText?: string | null;
  confidence?: number | null;
  splits?: { name: string; amount: number }[] | null;
};

export type DemoBundle = {
  rows: DemoRow[];
  budgets: { categorySlug: string | null; limit: number; period: "MONTHLY" }[];
  goals: {
    name: string;
    emoji: string;
    color: string;
    targetAmount: number;
    savedAmount: number;
    deadline: Date | null;
    priority: "LOW" | "MEDIUM" | "HIGH";
  }[];
  recurrings: {
    title: string;
    amount: number;
    type: "EXPENSE" | "INCOME";
    method: "UPI" | "CASH";
    categorySlug: string;
    merchant: string | null;
    frequency: "MONTHLY";
    interval: number;
    nextRun: Date;
  }[];
};

/** mulberry32 — small deterministic PRNG */
function prng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rupees = (n: number) => Math.round(n * 100);

export function buildDemoBundle(now = new Date(), seed = 20260831): DemoBundle {
  const rand = prng(seed);
  const pick = <T,>(items: T[]): T => items[Math.floor(rand() * items.length)];
  const between = (min: number, max: number) => min + rand() * (max - min);
  const chance = (p: number) => rand() < p;
  const rows: DemoRow[] = [];

  /**
   * Places an entry at a deterministic time of day, remapping it into the part
   * of the day that has already happened when the date is today — so the demo
   * never contains a transaction stamped in the future (which would leave the
   * current day, and month-to-date, looking empty at 3am).
   */
  const at = (date: Date, hour = 12, minute = 0) => {
    const d = new Date(date);
    d.setHours(hour, minute, 0, 0);
    if (d > now) {
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const elapsed = Math.max(1, now.getTime() - dayStart.getTime());
      const fraction = ((hour * 60 + minute) % 1440) / 1440;
      return new Date(dayStart.getTime() + Math.floor(fraction * elapsed));
    }
    return d;
  };

  const add = (row: Omit<DemoRow, "source"> & { source?: DemoRow["source"] }) => {
    rows.push({ source: "SEED", ...row });
  };

  /* ------------------------------- 5 months of history ------------------------------ */

  const monthsBack = 5;
  for (let m = monthsBack - 1; m >= 0; m--) {
    const monthStart = startOfMonth(subMonths(now, m));
    const isCurrentMonth = m === 0;
    const daysInView = isCurrentMonth ? now.getDate() : new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();

    for (let day = 1; day <= daysInView; day++) {
      const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
      const weekday = date.getDay();
      const isWeekend = weekday === 0 || weekday === 6;

      /* mess / canteen — most days, twice on some */
      if (chance(0.85)) {
        add({
          amount: rupees(Math.round(between(45, 95) / 5) * 5),
          type: "EXPENSE",
          method: chance(0.55) ? "UPI" : "CASH",
          accountKey: chance(0.55) ? "upi" : "cash",
          categorySlug: "mess",
          merchant: pick(["Hostel Mess", "Main Canteen", "Engineering Canteen", "Night Mess", "South Indian Canteen"]),
          note: pick(["Lunch", "Dinner", "Lunch thali", "Dinner + curd", "Breakfast"]),
          occurredAt: at(date, pick([8, 13, 20]), pick([0, 15, 30, 45])),
        });
      }

      /* chai & snacks — a true college staple */
      const chaiCount = chance(0.55) ? (chance(0.3) ? 2 : 1) : 0;
      for (let i = 0; i < chaiCount; i++) {
        add({
          amount: rupees(Math.round(between(10, 45))),
          type: "EXPENSE",
          method: chance(0.5) ? "CASH" : "UPI",
          accountKey: chance(0.5) ? "cash" : "upi",
          categorySlug: "chai",
          merchant: pick(["Sharma Ji Chai", "Tapri", "Chai Point", "Canteen Chai", "Amul Parlour", "CCD"]),
          note: pick(["Chai", "Chai + samosa", "Cold coffee", "Masala chai", "Chai with friends", "Vada pav"]),
          occurredAt: at(date, pick([9, 11, 16, 18, 22]), pick([0, 20, 40])),
        });
      }

      /* transport — autos, metro, bus */
      if (chance(isWeekend ? 0.5 : 0.7)) {
        add({
          amount: rupees(Math.round(between(25, 140))),
          type: "EXPENSE",
          method: chance(0.6) ? "UPI" : "CASH",
          accountKey: chance(0.6) ? "upi" : "cash",
          categorySlug: "transport",
          merchant: pick(["Auto", "Rapido", "Metro", "College Bus", "Ola", "Uber"]),
          note: pick(["To college", "Auto to hostel", "Metro recharge", "Shared auto", "Rapido to library"]),
          occurredAt: at(date, pick([8, 10, 19, 21]), pick([0, 30])),
        });
      }

      /* delivery — more on weekends */
      if (chance(isWeekend ? 0.55 : 0.28)) {
        const platform = pick(["Zomato", "Swiggy"]);
        const shared = chance(0.35);
        add({
          amount: rupees(Math.round(between(150, 480))),
          type: "EXPENSE",
          method: "UPI",
          accountKey: "upi",
          categorySlug: "delivery",
          merchant: platform,
          note: pick(["Biryani", "Pizza night", "Rolls + coke", "Late night munchies", "Thali combo"]) + (shared ? " (split with room)" : ""),
          occurredAt: at(date, pick([13, 20, 22, 23]), pick([0, 15, 45])),
          splits: shared
            ? [
                { name: "Rahul", amount: Math.round(between(80, 160)) },
                { name: "Ishita", amount: Math.round(between(80, 160)) },
              ]
            : null,
        });
      }

      /* groceries — weekly-ish */
      if (weekday === 0 && chance(0.7)) {
        add({
          amount: rupees(Math.round(between(180, 850))),
          type: "EXPENSE",
          method: pick(["UPI", "CASH"] as const),
          accountKey: pick(["upi", "cash"] as const),
          categorySlug: "groceries",
          merchant: pick(["Blinkit", "Zepto", "Local Kirana", "DMart", "BigBasket"]),
          note: pick(["Milk + fruits", "Weekly ration", "Snacks stock", "Instant noodles + eggs"]),
          occurredAt: at(date, pick([11, 18]), 0),
        });
      }

      /* xerox / printouts before exams */
      if (chance(0.12)) {
        add({
          amount: rupees(Math.round(between(20, 220))),
          type: "EXPENSE",
          method: "CASH",
          accountKey: "cash",
          categorySlug: "books",
          merchant: pick(["Xerox Shop", "Campus Stationery", "College Co-op"]),
          note: pick(["Lab records printout", "Notes photocopy", "Assignment print", "Project report spiral binding"]),
          occurredAt: at(date, pick([10, 15]), 0),
        });
      }

      /* fun & outings */
      if (isWeekend && chance(0.3)) {
        add({
          amount: rupees(Math.round(between(180, 900))),
          type: "EXPENSE",
          method: chance(0.7) ? "UPI" : "CASH",
          accountKey: chance(0.7) ? "upi" : "cash",
          categorySlug: pick(["fun", "fun", "shopping"]),
          merchant: pick(["PVR Cinemas", "BookMyShow", "Mall food court", "Bowling alley", "Decathlon", "Myntra"]),
          note: pick(["Movie with friends", "Weekend outing", "New sneakers", "Concert night", "Birthday treat"]),
          occurredAt: at(date, pick([16, 19, 21]), 0),
        });
      }

      /* laundry */
      if (weekday === 6 && chance(0.6)) {
        add({
          amount: rupees(Math.round(between(80, 220))),
          type: "EXPENSE",
          method: "CASH",
          accountKey: "cash",
          categorySlug: "laundry",
          merchant: "Dhobi Bhaiya",
          note: pick(["Weekly laundry", "Laundry + iron"]),
          occurredAt: at(date, 10, 30),
        });
      }

      /* health / personal, occasionally */
      if (chance(0.05)) {
        add({
          amount: rupees(Math.round(between(90, 700))),
          type: "EXPENSE",
          method: pick(["UPI", "CASH"] as const),
          accountKey: pick(["upi", "cash"] as const),
          categorySlug: pick(["health", "personal"]),
          merchant: pick(["Apollo Pharmacy", "Campus Clinic", "Local chemist", "Hair salon"]),
          note: pick(["Fever medicine", "Doctor consult", "Haircut", "Vitamins"]),
          occurredAt: at(date, pick([11, 17]), 0),
        });
      }
    }

    /* monthly fixed costs ---------------------------------------------------- */
    const monthDate = (day: number, hour = 10) =>
      at(new Date(monthStart.getFullYear(), monthStart.getMonth(), Math.min(day, daysInView)), hour);

    add({
      amount: rupees(4500),
      type: "EXPENSE",
      method: "UPI",
      accountKey: "upi",
      categorySlug: "hostel",
      merchant: "Hostel Warden",
      note: "Monthly room rent",
      occurredAt: monthDate(3, 9),
    });
    add({
      amount: rupees(pick([199, 239, 299])),
      type: "EXPENSE",
      method: "UPI",
      accountKey: "upi",
      categorySlug: "mobile",
      merchant: pick(["Jio", "Airtel"]),
      note: "Monthly recharge",
      occurredAt: monthDate(pick([5, 6, 7]), 12),
    });
    add({
      amount: rupees(199),
      type: "EXPENSE",
      method: "UPI",
      accountKey: "upi",
      categorySlug: "subscriptions",
      merchant: "Netflix",
      note: "Shared with 3 roommates",
      occurredAt: monthDate(pick([8, 9]), 20),
    });
    add({
      amount: rupees(119),
      type: "EXPENSE",
      method: "UPI",
      accountKey: "upi",
      categorySlug: "subscriptions",
      merchant: "Spotify",
      note: "Student plan",
      occurredAt: monthDate(pick([10, 11]), 21),
    });

    /* income ----------------------------------------------------------------- */
    add({
      amount: rupees(m === monthsBack - 1 ? 7500 : 8000),
      type: "INCOME",
      method: "UPI",
      accountKey: "upi",
      categorySlug: "allowance",
      merchant: "Mom",
      note: "Monthly pocket money",
      occurredAt: monthDate(1, 11),
    });

    if (m <= 2) {
      add({
        amount: rupees(pick([12000, 12500, 12000])),
        type: "INCOME",
        method: "BANK",
        accountKey: "bank",
        categorySlug: "internship",
        merchant: "Startup stipend",
        note: "Product intern stipend",
        occurredAt: monthDate(28, 17),
      });
    }
    if (m === 3) {
      add({
        amount: rupees(15000),
        type: "INCOME",
        method: "BANK",
        accountKey: "bank",
        categorySlug: "scholarship",
        merchant: "Merit Scholarship",
        note: "Semester merit scholarship",
        occurredAt: monthDate(12, 15),
      });
    }
    if (chance(0.5)) {
      add({
        amount: rupees(Math.round(between(1200, 4800))),
        type: "INCOME",
        method: "UPI",
        accountKey: "upi",
        categorySlug: "freelance",
        merchant: pick(["Design client", "Upwork gig", "Tutoring", "Poster design"]),
        note: pick(["Logo design project", "JEE maths tutoring", "Landing page gig"]),
        occurredAt: monthDate(pick([14, 18, 22]), 19),
      });
    }
    if (chance(0.4)) {
      add({
        amount: rupees(Math.round(between(120, 600))),
        type: "INCOME",
        method: "UPI",
        accountKey: "upi",
        categorySlug: "refunds",
        merchant: pick(["Amazon refund", "Zomato refund", "PhonePe cashback"]),
        note: pick(["Order cancelled", "Late delivery refund", "Cashback"]),
        occurredAt: monthDate(pick([9, 16, 24]), 13),
      });
    }
  }

  /* ---------------------------------------------------------------------------
     Make "today" alive. The demo is generated for whatever day it is, and on
     the 1st of a month the month-to-date totals would otherwise be near zero,
     which makes the dashboard look empty on first load.
     --------------------------------------------------------------------------- */
  const todayBurst: [number, string, string, string, "UPI" | "CASH"][] = [
    [30, "chai", "Tapri", "Morning chai", "CASH"],
    [75, "mess", "Main Canteen", "Lunch", "UPI"],
    [60, "transport", "Auto", "Auto to college", "CASH"],
    [20, "chai", "Tapri", "Evening chai", "CASH"],
    [280, "groceries", "Blinkit", "Milk and snacks", "UPI"],
  ];
  const hours = [8, 13, 10, 18, 20];
  todayBurst.forEach(([amount, slug, merchant, note, method], i) => {
    const when = at(now, hours[i], i * 7);
    if (when > now) return; // never invent a future transaction
    rows.push({
      amount: rupees(amount),
      type: "EXPENSE",
      method,
      accountKey: method === "CASH" ? "cash" : "upi",
      categorySlug: slug,
      merchant,
      note,
      occurredAt: when,
      source: "SEED",
    });
  });

  /* one-off big-ticket moments */
  const tripDate = addDays(now, -34);
  add({
    amount: rupees(1480),
    type: "EXPENSE",
    method: "UPI",
    accountKey: "upi",
    categorySlug: "travel",
    merchant: "IRCTC",
    note: "Train ticket home for Diwali",
    occurredAt: at(tripDate, 9),
  });
  add({
    amount: rupees(6499),
    type: "EXPENSE",
    method: "CARD",
    accountKey: "bank",
    categorySlug: "shopping",
    merchant: "Amazon",
    note: "Wireless earbuds (semester splurge)",
    occurredAt: at(addDays(now, -58), 21),
  });
  add({
    amount: rupees(2350),
    type: "EXPENSE",
    method: "UPI",
    accountKey: "upi",
    categorySlug: "academics",
    merchant: "College Accounts Dept",
    note: "Lab fee + exam form",
    occurredAt: at(addDays(now, -76), 11),
  });

  /* a few AI-logged entries so the parser's output shows up in the feed */
  const aiSamples: [string, number, string, string][] = [
    ["chai 20 at tapri", 20, "chai", "Tapri"],
    ["auto 60 to college", 60, "transport", "Auto"],
    ["paid 350 to zomato", 350, "delivery", "Zomato"],
    ["mom sent 2000", 2000, "allowance", "Mom"],
  ];
  aiSamples.forEach(([text, amount, slug, merchant], i) => {
    const d = addDays(now, -(1 + i));
    rows.push({
      amount: rupees(amount),
      type: slug === "allowance" ? "INCOME" : "EXPENSE",
      method: "UPI",
      accountKey: "upi",
      categorySlug: slug,
      merchant,
      note: text,
      occurredAt: at(d, pick([9, 14, 20])),
      source: "AI",
      rawText: text,
      confidence: 0.92 - i * 0.04,
    });
  });

  rows.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  /* --------------------------------- budgets -------------------------------- */
  const budgets: DemoBundle["budgets"] = [
    { categorySlug: null, limit: rupees(14000), period: "MONTHLY" },
    { categorySlug: "mess", limit: rupees(3000), period: "MONTHLY" },
    { categorySlug: "delivery", limit: rupees(1800), period: "MONTHLY" },
    { categorySlug: "chai", limit: rupees(700), period: "MONTHLY" },
    { categorySlug: "transport", limit: rupees(1200), period: "MONTHLY" },
    { categorySlug: "subscriptions", limit: rupees(600), period: "MONTHLY" },
    { categorySlug: "fun", limit: rupees(1500), period: "MONTHLY" },
  ];

  /* ---------------------------------- goals --------------------------------- */
  const goals: DemoBundle["goals"] = [
    {
      name: "Goa trip with friends",
      emoji: "🏖️",
      color: "#0ea5e9",
      targetAmount: rupees(18000),
      savedAmount: rupees(7200),
      deadline: addMonths(now, 4),
      priority: "HIGH",
    },
    {
      name: "New laptop fund",
      emoji: "💻",
      color: "#8b5cf6",
      targetAmount: rupees(65000),
      savedAmount: rupees(21500),
      deadline: addMonths(now, 9),
      priority: "MEDIUM",
    },
    {
      name: "Emergency buffer",
      emoji: "🛟",
      color: "#22c55e",
      targetAmount: rupees(20000),
      savedAmount: rupees(12400),
      deadline: null,
      priority: "MEDIUM",
    },
  ];

  /* -------------------------------- recurrings ------------------------------ */
  const recurrings: DemoBundle["recurrings"] = [
    {
      title: "Hostel rent",
      amount: rupees(4500),
      type: "EXPENSE",
      method: "UPI",
      categorySlug: "hostel",
      merchant: "Hostel Warden",
      frequency: "MONTHLY",
      interval: 1,
      nextRun: nextMonthOn(now, 3),
    },
    {
      title: "Jio recharge",
      amount: rupees(299),
      type: "EXPENSE",
      method: "UPI",
      categorySlug: "mobile",
      merchant: "Jio",
      frequency: "MONTHLY",
      interval: 1,
      nextRun: nextMonthOn(now, 6),
    },
    {
      title: "Netflix (shared)",
      amount: rupees(199),
      type: "EXPENSE",
      method: "UPI",
      categorySlug: "subscriptions",
      merchant: "Netflix",
      frequency: "MONTHLY",
      interval: 1,
      nextRun: nextMonthOn(now, 9),
    },
    {
      title: "Pocket money from home",
      amount: rupees(8000),
      type: "INCOME",
      method: "UPI",
      categorySlug: "allowance",
      merchant: "Mom",
      frequency: "MONTHLY",
      interval: 1,
      nextRun: nextMonthOn(now, 1),
    },
  ];

  return { rows, budgets, goals, recurrings };
}

function nextMonthOn(now: Date, day: number): Date {
  const d = addMonths(startOfMonth(now), 1);
  d.setDate(day);
  d.setHours(9, 0, 0, 0);
  return d;
}

/** Demo credentials shown on the login screen. */
export const DEMO_CREDENTIALS = { email: "demo@campuspend.app", password: "campuspend" };

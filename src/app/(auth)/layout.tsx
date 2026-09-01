import Link from "next/link";
import { Receipt, Sparkles, ShieldCheck, Zap } from "lucide-react";

const HIGHLIGHTS = [
  {
    icon: Sparkles,
    title: "Type it, don&apos;t tap it",
    body: "“bought chai rs 100”, “auto 50 cash kal” — the parser reads amount, category, merchant and date in one line.",
  },
  {
    icon: Zap,
    title: "UPI and cash, together",
    body: "Split every rupee by payment method so you can see how much of your month leaks out as cash.",
  },
  {
    icon: ShieldCheck,
    title: "Your data, your machine",
    body: "Works fully offline — no bank linking, no SMS permissions, no ads. Optional LLM if you add a key.",
  },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* brand panel */}
      <div className="relative hidden flex-1 overflow-hidden border-r border-border bg-surface/40 lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -left-24 top-1/3 h-96 w-96 rounded-full bg-primary/20 blur-[120px]" />
        <div className="pointer-events-none absolute -right-16 -top-10 h-80 w-80 rounded-full bg-accent/20 blur-[110px]" />

        <div className="relative p-10">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-lg">
              <Receipt className="h-5 w-5" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-lg font-bold tracking-tight text-fg">CampuSpend</span>
              <span className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-subtle">for students</span>
            </span>
          </Link>
        </div>

        <div className="relative space-y-6 px-10">
          <h2 className="max-w-md text-3xl font-bold leading-tight tracking-tight text-fg">
            The expense tracker that speaks student.
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-muted">
            Mess bills, chai runs, split Zomato orders, hostel rent, that one Amazon splurge — all of it in a
            dashboard you&apos;ll actually open.
          </p>

          <div className="space-y-3 pt-2">
            {HIGHLIGHTS.map((h) => (
              <div key={h.title} className="flex gap-3 rounded-2xl border border-border bg-surface/70 p-4 backdrop-blur">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                  <h.icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-fg">{h.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">{h.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative p-10">
          <div className="rounded-2xl border border-border bg-surface/70 p-4 backdrop-blur">
            <p className="text-xs text-muted">
              <span className="font-semibold text-fg">Demo data included.</span> Sign up (or use the demo login) to
              land on a dashboard with 5 months of realistic student spending already in it.
            </p>
          </div>
        </div>
      </div>

      {/* form panel */}
      <div className="flex w-full flex-col justify-center px-5 py-10 sm:px-10 lg:w-[32rem] lg:px-12">{children}</div>
    </div>
  );
}

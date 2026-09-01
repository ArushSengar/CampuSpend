# 🎓 CampuSpend

**An AI expense tracker built for Indian college students.** Track UPI and cash side by side, log a
transaction by typing what you did — _"bought chai rs 100"_, _"auto 50 cash kal"_, _"mom sent 5000"_ —
and let the parser work out the amount, category, merchant, payment method and date.

Everything runs on your own machine against a local SQLite file. No bank linking, no SMS
permissions, no ads, no telemetry.

```bash
git clone https://github.com/ArushSengar/CampuSpend.git && cd CampuSpend
npm install
npm run setup      # creates .env, runs migrations, seeds demo data
npm run dev        # http://localhost:3000
```

Then either **"Explore the live demo"** on the login screen (`demo@campuspend.app` / `campuspend`)
or create your own account — demo data is loaded by default so the dashboard is alive immediately.

---

## ✨ What's inside

### The AI layer

| Feature | Detail |
|---|---|
| **Natural-language entry** | `bought chai rs 100` → ₹100 · Chai & Snacks · merchant "Chai" · today. One line, zero forms. |
| **Multi-transaction lines** | "chai 20 and auto 50 cash" files **two** transactions in one go. |
| **Hinglish & ₹ shorthand** | `aaj`, `kal`, `parso`, `500 ka petrol`, `1.2k`, `2.5L`, `100/-`, `rs 100`, `mom sent 5000` |
| **Amounts** | `₹120`, `rs 120`, `120 rs`, `120 rupees`, `1.2k`, `1.5L`, `100/-` |
| **Dates** | today, yesterday, `n days ago`, `last friday`, `12 aug`, `12/08`, `on 5th` |
| **Direction** | `got/received/mom sent/salary/refund` → income; `paid/spent/bought` → expense |
| **Method** | `upi`, `gpay`, `phonepe`, `paytm`, `cash`, `card`, `neft` |
| **Merchants** | Brand lexicon (Zomato, Swiggy, Rapido, IRCTC, Netflix, Blinkit, DMart…) + `at X` / `to X` / `from X` patterns |
| **Learns you** | If you always file "Hostel Warden" under Hostel & Rent, the parser copies you next time |
| **Transparent** | Every parse shows a confidence score and _why_ it decided what it did — and every field is editable before saving |
| **AI Coach** | Rule-generated insights (pace, budget risk, cash leakage, subscription audit, goal feasibility) computed from your real rows |
| **Ask your money** | "where can I cut back?", "can I afford 5000?", "how much on chai last month?" — answered with your actual numbers |
| **Bring your own LLM** | Set `OPENAI_API_KEY` or `GEMINI_API_KEY` for a second pass on messy input. Offline engine stays the default and validates every number. |

> **No API key needed.** The parser (`src/lib/ai/parse.ts`) is a layered rule engine that runs
> fully offline. An LLM is an optional upgrade, never a dependency.

### Everything else you'd expect from a 2026 tracker

- **Auth** — email + password (bcrypt), signed JWT session cookie, route-level and API-level guards.
- **Dashboard** — KPI cards, 30-day spend curve, category donut, income-vs-expense bars, budgets,
  goals, UPI/cash split, top merchants, logging streak, AI insights, recent activity.
- **Transactions** — full CRUD, search, filters (type / method / category / account / date range),
  sort, pagination, **multi-select bulk delete**, CSV export.
- **Budgets** — per-category or overall caps with safe / watch / over states and a "safe daily
  spend for the rest of the month" hint.
- **Goals** — targets with deadlines, quick-contribute buttons, feasibility maths.
- **Recurring** — rent, mess, recharges, subscriptions. Due rules are logged automatically and can
  be paused or run on demand.
- **Accounts** — UPI wallets, cash in hand, bank, card. Balances move as you log transactions.
- **Splits** — mark an expense as shared with roommates and record who owes what.
- **Categories** — 25 student-flavoured defaults, fully editable, with emoji + colour pickers.
- **Settings** — profile, expected monthly income, category CRUD, CSV export, demo-data loader,
  and a "delete everything" escape hatch.

### Interface details

- Sidebar navigation with a collapsible mobile drawer, sticky topbar and per-page titles.
- **⌘K command palette** — jump anywhere, add an expense, switch theme, export, log out.
- **Empty states** that explain what to do next, **skeleton loading** on every data view, and
  **optimistic updates** (deletes, goal contributions, budget edits) with rollback on failure.
- Light/dark themes, glassy cards, custom SVG charts (no chart library), responsive from 360px up,
  keyboard-friendly, `prefers-reduced-motion` respected.

---

## 🏗️ Architecture

```
src/
├─ app/
│  ├─ (auth)/                 login (split marketing panel)
│  ├─ (app)/                  authenticated shell + pages
│  │  ├─ dashboard/           server-rendered overview + client charts
│  │  ├─ transactions/        full CRUD, filters, bulk actions
│  │  ├─ insights/            AI coach: insights + ask-anything chat
│  │  ├─ budgets/ goals/ recurring/ accounts/ settings/
│  └─ api/                    REST endpoints (see below)
├─ components/
│  ├─ ai/quick-add.tsx        the natural-language entry bar
│  ├─ charts/                 hand-rolled SVG area, donut, bar charts
│  ├─ dashboard/ insights-panel / kpi-card
│  ├─ shell/                  sidebar, topbar, command palette
│  ├─ transactions/           row, feed, create/edit modal
│  └─ ui/                     button, card, input, modal, toast, skeleton…
├─ db/                        Drizzle schema + libSQL client
├─ lib/
│  ├─ ai/                     parse.ts (rules) · llm.ts (optional) · insights.ts · ask.ts
│  ├─ analytics.ts            all dashboard maths
│  ├─ taxonomy.ts             categories + merchant lexicon
│  ├─ demo.ts                 deterministic demo-data generator
│  └─ queries.ts              typed data access + recurring runner
└─ proxy.ts                   Next 16 proxy: session gate
```

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 ·
Drizzle ORM + libSQL (SQLite file) · `jose` sessions · `bcryptjs` · `zod` · lucide icons.

**Money:** every column is stored in **paise** (integers) — no floating-point drift. Conversion
happens only at the UI/API boundary in `src/lib/money.ts`.

### Data model

`users` · `accounts` · `categories` · `transactions` · `budgets` · `goals` · `recurrings`
(see `src/db/schema.ts`). Migrations live in `drizzle/`.

### API

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/auth/signup` · `/api/auth/login` · `/api/auth/logout` | session management |
| `GET` | `/api/auth/session` | current user |
| `GET/POST/DELETE` | `/api/transactions` | list (filters, search, sort, paging) · create · bulk delete |
| `GET/PATCH/DELETE` | `/api/transactions/[id]` | read · update · delete (balances reconciled) |
| `GET/POST` · `PATCH/DELETE` | `/api/categories`, `/api/accounts`, `/api/budgets`, `/api/goals`, `/api/recurring` | full CRUD |
| `POST` | `/api/goals/[id]` | contribute / withdraw |
| `POST` | `/api/recurring/apply` | materialise due rules |
| `POST` | `/api/ai/parse` | natural language → structured transactions |
| `POST` | `/api/ai/ask` | natural-language question → computed answer |
| `GET` | `/api/insights`, `/api/overview` | insight cards · full dashboard payload |
| `GET` | `/api/export` | CSV download |
| `POST` | `/api/demo` | load / reset / clear demo data |
| `PATCH` | `/api/user/profile` | profile + monthly income |

---

## 🚀 Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (auto-creates `.env`, migrates and seeds first) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run setup` | `ensure-env` + migrate + seed |
| `npm run db:generate` | Regenerate migrations after editing `src/db/schema.ts` |
| `npm run db:migrate` · `db:seed` · `db:reset` | Migrate · seed demo · drop-and-rebuild |
| `npm run typecheck` · `npm run lint` | `tsc --noEmit` · ESLint |
| `npm run smoke` | Render-and-click smoke test (see below) |

### `npm run smoke`

There isn't always a headless browser available, so `tests/smoke.mjs` mounts the **real client
components** in jsdom against a running dev server and talks to the **real API**. It catches the
things HTTP status codes can't: render crashes, effects that never settle, data that never reaches
the DOM, and money formatting mistakes.

```bash
npm run dev                    # in one terminal
npm run smoke                  # in another
SMOKE_DUMP=/tmp/smoke npm run smoke   # also write each page's rendered text to /tmp/smoke
```

It logs in as the demo user, renders all eight pages, asserts real values appear (the exact
formatted amounts on the transactions and goals pages, so a rupees/paise mix-up fails loudly),
then drives the AI bar end to end: types `bought chai rs 100`, parses it, saves the transaction
and deletes it again. Point it at an account with no data and it switches to an empty-state pass.

## ⚙️ Configuration

`npm run setup` writes a `.env` for you. Everything has a working default — the app runs fully
offline with no keys at all.

| Variable | Default | What it does |
|---|---|---|
| `DATABASE_URL` | `file:./campuspend.db` | SQLite file. Swap in a Turso/libSQL URL to go hosted. |
| `AUTH_SECRET` | generated per clone | Signs session JWTs. Regenerating it logs everyone out. |
| `OPENAI_API_KEY` · `GEMINI_API_KEY` | unset | Optional second pass for messy Hinglish. Offline parser stays in charge. |
| `COOKIE_SECURE` | auto | `1` forces `Secure; SameSite=None; Partitioned` on the session cookie — needed when the app is served over HTTPS inside an iframe (hosted previews, embedded demos). Unset on plain `http://localhost`, where `SameSite=Lax` is correct. |
| `DEV_ALLOWED_ORIGINS` | auto | Extra dev hosts to allow, comma-separated. Hosted sandboxes (e2b/Codespaces) are detected automatically. |

`.env` is created for you on first run; `.env.example` documents every knob.

```env
DATABASE_URL="file:./campuspend.db"
AUTH_SECRET="auto-generated-on-first-run"

# Optional — upgrades the parser. Offline engine is used when these are absent.
# OPENAI_API_KEY=""
# GEMINI_API_KEY=""
```

Set `DATABASE_URL` to a Turso/LibSQL URL (+ `DATABASE_AUTH_TOKEN`) to run against a hosted
database — no code changes required.

## 🔒 Privacy

All data lives in your own SQLite file. The AI parser, insights and Q&A run locally against that
file; nothing leaves your machine unless you explicitly configure an LLM key, and even then only
the single sentence being parsed is sent — never your history.

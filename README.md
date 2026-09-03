# 🎓 CampuSpend

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![100% Free & Open Source](https://img.shields.io/badge/Cost-100%25%20Free%20%26%20Open%20Source-success.svg)](#-100-free--local-first)
[![Next.js 16](https://img.shields.io/badge/Next.js-16.3-black?logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.2-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/Database-Local%20SQLite%20(libSQL)-003B57?logo=sqlite)](https://github.com/tursodatabase/libsql)

**An intelligent, privacy-first personal finance platform engineered for college students.**  
Track UPI & cash effortlessly, parse natural Hinglish phrases, scan receipts, split expenses with roommates, and master your student finances with an offline AI financial coach.

[**Quick Start**](#-quick-start) • [**Features**](#-features) • [**Architecture**](#-architecture) • [**Contributing**](#-contributing) • [**License**](#-license)

---

⭐ **Like this project?** Leave a star on GitHub — it's 100% free and helps other students discover it!

</div>

---

## ⚡ Why CampuSpend?

Indian college life is powered by micro-transactions: ₹20 tapri chai, ₹60 auto rickshaws, ₹150 canteen meals, shared flat groceries, and occasional ₹5,000 allowance transfers from home. Traditional finance apps demand tedious manual category forms, link to banking credentials, bombard you with credit card ads, or charge monthly subscriptions.

**CampuSpend is built differently:**
- **Zero Ads, Zero Subscriptions, 100% Free Forever.**
- **Completely Local-First:** All transactions, budgets, and debts reside in your local SQLite database (`campuspend.db`).
- **No Bank Linking or SMS Snooping:** Nothing scrapes your SMS inbox or accesses your bank account.
- **Offline NLP Engine:** Parses everyday student shorthand (*"bought chai rs 100"*, *"auto 50 cash kal"*, *"mom sent 5000"*) entirely offline without requiring third-party API keys.

---

## 🚀 Quick Start

Get up and running in under 60 seconds:

```bash
# 1. Clone the repository
git clone https://github.com/ArushSengar/CampuSpend.git
cd CampuSpend

# 2. Install dependencies
npm install

# 3. Setup database, run migrations, and seed realistic demo data
npm run setup

# 4. Launch the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> **💡 Instant Demo Sandbox:**  
> Jump straight into the pre-loaded sandbox with 5+ months of realistic student spending:  
> **Email:** `demo@campuspend.app`  
> **Password:** `campuspend`  
> (Or click **"1-Click Demo Sandbox"** on the login screen!)

---

## ✨ Features

### 🤖 1. Natural-Language Quick Entry (AI Parser)
Type your expenses the way you speak to friends. The built-in rule-based parsing engine decodes complex inputs instantly:
- **Hinglish & College Shorthand:** `aaj`, `kal`, `parso`, `500 ka petrol`, `1.2k`, `2.5L`, `100/-`, `rs 100`, `mom sent 5000`.
- **Multi-Transaction Lines:** `"chai 20 and auto 50 cash"` logs **two separate transactions** in a single tap.
- **Smart Merchant & Method Inference:** Recognizes Swiggy, Zomato, Rapido, Blinkit, DMart, IRCTC, Netflix, and flags UPI (`GPay`, `PhonePe`, `Paytm`), `Cash`, or `Card`.
- **Learns Your Habits:** If you routinely categorize your hostel warden under "Hostel & Rent", the engine adapts to your habits.
- **Offline & Private:** Runs 100% locally with zero latency. (Optional: plug in `GEMINI_API_KEY` or `OPENAI_API_KEY` in `.env` for messy input fallback).

### 📸 2. Bill & UPI Receipt Scanner
- Drag & drop or paste (⌘V / Ctrl+V) transaction screenshots from GPay, PhonePe, Paytm, or paper canteen slips.
- Extracts payment amount, merchant name, UTR number, and payment method automatically.

### 👥 3. Roommate & Peer Bill Splits (`/splits`)
- Split hostel rent, WiFi bills, late-night food deliveries, and group trips.
- Automatic balance reconciliation: see who owes you and who you owe at a glance.
- 1-click settlement logging that updates both your friend's balance and your chosen wallet/bank balance.
- Share quick WhatsApp settlement reminders with custom pre-filled debt breakdown texts.

### 🎯 4. Smart Budgets & Goal Feasibility
- Category-level caps and overall monthly spending limits with real-time visual progress.
- **Dynamic Safe Daily Spend:** Instantly computes how much you can spend per day for the remaining days of the month.
- **Savings Goals:** Set targets (e.g., *Goa Trip*, *New Laptop*, *Semester Fees*) with target dates and feasible monthly contribution math.

### 📊 5. Apple-Inspired Dashboard & Financial Health Score
- **0–100 Financial Health Metric:** Evaluates savings rate, budget discipline, cash leakage, and recurring load.
- **Student Badges:** Unlock achievements like *Campus Minimalist*, *Budget Guardian*, *Goal Getter*, and *Logging Streak Master*.
- **Hand-Crafted Custom SVG Visualizations:** 30-day spend curves, income vs. expense comparisons, category donut charts, and weekday vs. weekend ratios (no bloated chart libraries).

### 🧾 6. Printable Statement & Ledger Export
- Need to show parents your semester spending or request hostel reimbursements?
- Generate a clean, verified **Monthly Financial Statement** with itemized breakdowns, ready for PDF export or printing with 1 click.

### 🔄 7. Subscriptions & Recurring Bills
- Never miss hostel rent, mess fees, or recharges again.
- Set intervals (monthly, weekly, bi-weekly) and let CampuSpend alert you or automatically apply due payments.

### 💳 8. Multi-Account Management
- Track UPI wallets (GPay, PhonePe, Paytm), cash in hand, bank accounts, and credit cards.
- Balances reconcile automatically as you record transactions or settlements.

### ⌨️ 9. Command Palette (⌘K)
- Press `⌘K` (or `Ctrl+K`) anywhere to search pages, quickly log expenses or income, toggle themes, or download CSV data.

---

## 🏗️ Architecture & Tech Stack

```
CampuSpend/
├── src/
│   ├── app/
│   │   ├── (app)/              # Authenticated application shell & pages
│   │   │   ├── dashboard/      # Financial overview, health score, badges, charts
│   │   │   ├── transactions/   # Filterable ledger, search, multi-select bulk delete
│   │   │   ├── splits/         # Roommate bill splitting & debt settlement
│   │   │   ├── insights/       # AI Coach & financial Q&A chat
│   │   │   ├── budgets/        # Category spending caps & safe daily pace
│   │   │   ├── goals/          # Savings targets & feasibility math
│   │   │   ├── recurring/      # Recurring subscriptions & automated due runner
│   │   │   ├── accounts/       # Wallets, cash, and bank account balances
│   │   │   └── settings/       # Profile, monthly income, category customization
│   │   ├── api/                # REST API routes (auth, transactions, splits, ai...)
│   │   ├── login/              # Sign in page with 1-click demo access
│   │   └── signup/             # Account registration page
│   ├── components/
│   │   ├── ai/                 # Quick-Add natural language bar, Receipt Scanner
│   │   ├── dashboard/          # KPI cards, Statement modal, Charts
│   │   ├── shell/              # Responsive sidebar, topbar, Command Palette (⌘K)
│   │   └── ui/                 # Button, Card, Input, Modal, Toast, Skeleton
│   ├── db/                     # Drizzle ORM schema & LibSQL client
│   └── lib/                    # Analytics math, AI parser, money formatting, session
├── tests/                      # JSDOM client component smoke tests
└── drizzle/                    # Database migration scripts
```

- **Framework:** Next.js 16 (App Router, Turbopack)
- **UI & State:** React 19, Tailwind CSS v4, Lucide Icons
- **Database & ORM:** Local SQLite via LibSQL + Drizzle ORM
- **Authentication:** Signed JWT sessions (`jose`), salted passwords (`bcryptjs`)
- **Validation:** Zod schemas
- **Monetary Precision:** Stored exclusively in integer **paise** (1 INR = 100 paise) to eliminate floating-point math errors.

---

## 🔒 100% Free & Local-First

1. **No Hidden Paywalls:** Every feature is completely unlocked and free for everyone.
2. **Your Data Stays With You:** The database is an SQLite file on your disk. You can back it up, delete it, or inspect it with any SQLite viewer at any time.
3. **Works Fully Offline:** The AI natural-language parser, financial analytics, and debt management work without an internet connection.

---

## 🛠️ Development & Testing

```bash
# Run TypeScript compilation check
npm run typecheck

# Run full production build
npm run build

# Run automated client component & API smoke test suite
npm run smoke

# Regenerate database migrations after modifying schema
npm run db:generate

# Reset and re-seed the database
npm run db:reset
```

---

## 🤝 Contributing

Contributions make the open-source community an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for more details.

---

<div align="center">

Crafted with ❤️ for students everywhere.  
**If you find CampuSpend useful, please give it a ⭐ on GitHub!**

</div>

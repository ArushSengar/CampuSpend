import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * CampuSpend schema (SQLite via libSQL).
 * Every monetary column is stored in PAISE (integer) — see src/lib/money.ts.
 */

const now = sql`(unixepoch() * 1000)`;

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  avatarHue: integer("avatar_hue").notNull().default(258),
  currency: text("currency").notNull().default("INR"),
  monthlyIncome: integer("monthly_income").notNull().default(0),
  college: text("college"),
  aiProvider: text("ai_provider").notNull().default("local"),
  isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
});

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull().default("UPI"), // UPI | CASH | BANK | CARD
    upiId: text("upi_id"),
    balance: integer("balance").notNull().default(0),
    color: text("color").notNull().default("#6366f1"),
    icon: text("icon").notNull().default("Wallet"),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (t) => [index("accounts_user_idx").on(t.userId)],
);

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    emoji: text("emoji").notNull().default("🧾"),
    color: text("color").notNull().default("#6366f1"),
    kind: text("kind").notNull().default("EXPENSE"), // EXPENSE | INCOME
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("categories_user_slug_idx").on(t.userId, t.slug), index("categories_user_idx").on(t.userId)],
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(), // paise, always positive
    type: text("type").notNull().default("EXPENSE"), // EXPENSE | INCOME
    method: text("method").notNull().default("UPI"), // UPI | CASH | CARD | BANK
    accountId: text("account_id").references(() => accounts.id, { onDelete: "set null" }),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    merchant: text("merchant"),
    note: text("note"),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull().default(now),
    source: text("source").notNull().default("MANUAL"), // MANUAL | AI | RECURRING | SEED | IMPORT
    rawText: text("raw_text"),
    confidence: integer("confidence"), // 0-100
    splits: text("splits"), // JSON string
    recurringId: text("recurring_id").references(() => recurrings.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (t) => [
    index("tx_user_date_idx").on(t.userId, t.occurredAt),
    index("tx_user_category_idx").on(t.userId, t.categoryId),
    index("tx_user_type_idx").on(t.userId, t.type),
  ],
);

export const budgets = sqliteTable(
  "budgets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "cascade" }),
    limit: integer("limit").notNull(),
    period: text("period").notNull().default("MONTHLY"),
    rollover: integer("rollover", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (t) => [index("budgets_user_idx").on(t.userId)],
);

export const goals = sqliteTable(
  "goals",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    emoji: text("emoji").notNull().default("🎯"),
    color: text("color").notNull().default("#22c55e"),
    targetAmount: integer("target_amount").notNull(),
    savedAmount: integer("saved_amount").notNull().default(0),
    deadline: integer("deadline", { mode: "timestamp_ms" }),
    priority: text("priority").notNull().default("MEDIUM"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (t) => [index("goals_user_idx").on(t.userId)],
);

export const recurrings = sqliteTable(
  "recurrings",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    amount: integer("amount").notNull(),
    type: text("type").notNull().default("EXPENSE"),
    method: text("method").notNull().default("UPI"),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    accountId: text("account_id").references(() => accounts.id, { onDelete: "set null" }),
    merchant: text("merchant"),
    frequency: text("frequency").notNull().default("MONTHLY"), // DAILY | WEEKLY | MONTHLY | YEARLY
    interval: integer("interval").notNull().default(1),
    nextRun: integer("next_run", { mode: "timestamp_ms" }).notNull(),
    lastRun: integer("last_run", { mode: "timestamp_ms" }),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (t) => [index("recurrings_user_idx").on(t.userId)],
);

/* ---------------------------------- relations --------------------------------- */

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  categories: many(categories),
  transactions: many(transactions),
  budgets: many(budgets),
  goals: many(goals),
  recurrings: many(recurrings),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
  transactions: many(transactions),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, { fields: [categories.userId], references: [users.id] }),
  transactions: many(transactions),
  budgets: many(budgets),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  account: one(accounts, { fields: [transactions.accountId], references: [accounts.id] }),
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
  recurring: one(recurrings, { fields: [transactions.recurringId], references: [recurrings.id] }),
}));

export const budgetsRelations = relations(budgets, ({ one }) => ({
  user: one(users, { fields: [budgets.userId], references: [users.id] }),
  category: one(categories, { fields: [budgets.categoryId], references: [categories.id] }),
}));

export const recurringsRelations = relations(recurrings, ({ one, many }) => ({
  user: one(users, { fields: [recurrings.userId], references: [users.id] }),
  category: one(categories, { fields: [recurrings.categoryId], references: [categories.id] }),
  transactions: many(transactions),
}));

/* ------------------------------------ types ----------------------------------- */

export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type Recurring = typeof recurrings.$inferSelect;

export type TransactionWithRelations = Transaction & {
  category: Category | null;
  account: Pick<Account, "id" | "name" | "type" | "color" | "icon"> | null;
};

export type BudgetWithCategory = Budget & { category: Category | null };
export type RecurringWithCategory = Recurring & { category: Category | null };

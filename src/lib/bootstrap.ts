import { db } from "@/db";
import { accounts, categories, users } from "@/db/schema";
import { newId, slugify } from "@/lib/ids";
import { DEFAULT_CATEGORIES } from "@/lib/taxonomy";

export const DEFAULT_ACCOUNTS = [
  { name: "GPay", type: "UPI", upiId: "you@okhdfcbank", balance: 425000, color: "#6366f1", icon: "Smartphone", isDefault: true },
  { name: "Cash in hand", type: "CASH", upiId: null, balance: 85000, color: "#22c55e", icon: "Banknote", isDefault: false },
  { name: "Savings account", type: "BANK", upiId: null, balance: 1820000, color: "#0ea5e9", icon: "Landmark", isDefault: false },
];

/** Creates the default category set + starter wallets for a brand-new account. */
export async function bootstrapUser(userId: string, withAccounts = true) {
  await db.insert(categories).values(
    DEFAULT_CATEGORIES.map((c, i) => ({
      id: newId("cat_"),
      userId,
      name: c.name,
      slug: c.slug,
      emoji: c.emoji,
      color: c.color,
      kind: c.kind,
      sortOrder: i,
    })),
  );

  if (withAccounts) {
    await db.insert(accounts).values(
      DEFAULT_ACCOUNTS.map((a) => ({
        id: newId("acc_"),
        userId,
        name: a.name,
        type: a.type,
        upiId: a.upiId,
        balance: a.balance,
        color: a.color,
        icon: a.icon,
        isDefault: a.isDefault,
      })),
    );
  }
}

export async function ensureUserBootstrap(userId: string) {
  const existing = await db.query.categories.findMany({ where: (c, { eq }) => eq(c.userId, userId), columns: { id: true } });
  if (existing.length > 0) return;
  await bootstrapUser(userId);
}

export async function createUserWithDefaults(input: {
  name: string;
  email: string;
  passwordHash: string;
  college?: string | null;
  isDemo?: boolean;
  monthlyIncome?: number;
}) {
  const id = newId("usr_");
  await db.insert(users).values({
    id,
    name: input.name,
    email: input.email,
    passwordHash: input.passwordHash,
    college: input.college ?? null,
    isDemo: input.isDemo ?? false,
    monthlyIncome: input.monthlyIncome ?? 0,
    avatarHue: Math.floor(Math.random() * 360),
  });
  await bootstrapUser(id);
  return id;
}

export const uniqueSlug = (name: string, taken: string[]) => {
  const base = slugify(name) || "category";
  let slug = base;
  let n = 2;
  while (taken.includes(slug)) slug = `${base}-${n++}`;
  return slug;
};

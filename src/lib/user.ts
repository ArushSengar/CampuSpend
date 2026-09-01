import type { users } from "@/db/schema";

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  college: string | null;
  avatarHue: number;
  currency: string;
  monthlyIncome: number;
  aiProvider: string;
  isDemo: boolean;
  createdAt: Date;
};

/** The safe, client-facing shape of a user row. */
export function publicUser(user: typeof users.$inferSelect): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    college: user.college,
    avatarHue: user.avatarHue,
    currency: user.currency,
    monthlyIncome: user.monthlyIncome,
    aiProvider: user.aiProvider,
    isDemo: user.isDemo,
    createdAt: user.createdAt,
  };
}

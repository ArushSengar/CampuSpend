import { z } from "zod";

const money = z.coerce.number().positive("Amount must be greater than 0").max(100000000);
const optionalText = z.string().trim().max(200).optional().nullable();
const kind = z.enum(["EXPENSE", "INCOME"]);
const method = z.enum(["UPI", "CASH", "CARD", "BANK"]);

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(60),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(200),
  college: z.string().trim().max(80).optional().nullable(),
  loadDemo: z.coerce.boolean().optional().default(true),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export const transactionInput = z
  .object({
    amount: money,
    type: kind.default("EXPENSE"),
    method: method.default("UPI"),
    accountId: z.string().nullable().optional(),
    categoryId: z.string().nullable().optional(),
    merchant: optionalText,
    note: optionalText,
    occurredAt: z.coerce.date().optional(),
    source: z.enum(["MANUAL", "AI", "RECURRING", "SEED", "IMPORT"]).default("MANUAL"),
    rawText: optionalText,
    confidence: z.coerce.number().min(0).max(1).nullable().optional(),
    splits: z
      .array(z.object({ name: z.string().trim().min(1).max(40), amount: z.coerce.number().min(0) }))
      .max(10)
      .optional()
      .nullable(),
  })
  .strict();

export const transactionUpdate = transactionInput.partial();

export const categoryInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(40),
  emoji: z.string().trim().min(1).max(4).default("🧾"),
  color: z.string().trim().max(20).default("#6366f1"),
  kind: kind.default("EXPENSE"),
});

export const categoryUpdate = categoryInput.partial().extend({ archived: z.boolean().optional() });

export const accountInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(40),
  type: z.enum(["UPI", "CASH", "BANK", "CARD"]).default("UPI"),
  upiId: optionalText,
  balance: z.coerce.number().min(-100000000).max(100000000).default(0),
  color: z.string().trim().max(20).default("#6366f1"),
  icon: z.string().trim().max(30).default("Wallet"),
  isDefault: z.coerce.boolean().optional().default(false),
});

export const accountUpdate = accountInput.partial().extend({ archived: z.boolean().optional() });

export const budgetInput = z.object({
  categoryId: z.string().nullable().optional(),
  limit: money,
  period: z.enum(["MONTHLY", "WEEKLY"]).default("MONTHLY"),
  rollover: z.coerce.boolean().optional().default(false),
});

export const budgetUpdate = budgetInput.partial();

export const goalInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  emoji: z.string().trim().min(1).max(4).default("🎯"),
  color: z.string().trim().max(20).default("#22c55e"),
  targetAmount: money,
  savedAmount: z.coerce.number().min(0).default(0),
  deadline: z.coerce.date().nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
});

export const goalUpdate = goalInput.partial();

export const contributeInput = z.object({ amount: z.coerce.number().positive().max(1000000000) });

export const recurringInput = z.object({
  title: z.string().trim().min(1, "Title is required").max(60),
  amount: money,
  type: kind.default("EXPENSE"),
  method: method.default("UPI"),
  categoryId: z.string().nullable().optional(),
  accountId: z.string().nullable().optional(),
  merchant: optionalText,
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]).default("MONTHLY"),
  interval: z.coerce.number().int().min(1).max(24).default(1),
  nextRun: z.coerce.date(),
  active: z.coerce.boolean().optional().default(true),
});

export const recurringUpdate = recurringInput.partial();

export const profileUpdate = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  college: z.string().trim().max(80).nullable().optional(),
  monthlyIncome: z.coerce.number().min(0).max(1000000000).optional(),
  avatarHue: z.coerce.number().int().min(0).max(360).optional(),
  aiProvider: z.enum(["local", "openai", "gemini"]).optional(),
});

export const parseInput = z.object({ text: z.string().trim().min(1).max(500) });
export const askInput = z.object({ question: z.string().trim().min(1).max(400) });

export type TransactionInput = z.infer<typeof transactionInput>;
export type SignupInput = z.infer<typeof signupSchema>;

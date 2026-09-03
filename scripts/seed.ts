import { loadEnvFile } from "node:process";
import { eq } from "drizzle-orm";
import { db, ensurePragmas } from "../src/db";
import { users } from "../src/db/schema";
import { hashPassword } from "../src/lib/password";
import { applyDemoBundle, clearUserData } from "../src/lib/demo-apply";
import { DEMO_CREDENTIALS } from "../src/lib/demo";
import { createUserWithDefaults } from "../src/lib/bootstrap";

try {
  loadEnvFile(".env");
} catch {
  /* noop */
}

async function main() {
  if (process.env.SKIP_SEED === "1" || process.env.SKIP_SEED === "true") {
    console.log("→ SKIP_SEED is set; skipping demo data seeding.");
    process.exit(0);
  }

  await ensurePragmas();

  const existing = await db.query.users.findFirst({ where: eq(users.email, DEMO_CREDENTIALS.email) });

  let userId: string;
  if (existing) {
    console.log("→ demo user exists, resetting its data…");
    userId = existing.id;
    await clearUserData(userId);
  } else {
    console.log("→ creating demo user…");
    userId = await createUserWithDefaults({
      name: "Aarav Sharma",
      email: DEMO_CREDENTIALS.email,
      passwordHash: await hashPassword(DEMO_CREDENTIALS.password),
      college: "NIT Trichy",
      isDemo: true,
      monthlyIncome: 2000000, // ₹20,000/mo blended
    });
  }

  const result = await applyDemoBundle(userId, { replace: existing ? true : false });
  console.log(`✓ seeded ${result.transactions} transactions, ${result.budgets} budgets, ${result.goals} goals`);
  console.log(`  login: ${DEMO_CREDENTIALS.email} / ${DEMO_CREDENTIALS.password}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

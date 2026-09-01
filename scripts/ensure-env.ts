/**
 * Creates .env on first run (it is git-ignored, so a fresh clone won't have
 * one). Copies .env.example and generates a random AUTH_SECRET so sessions are
 * signed with something unique to this machine.
 */
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

function main() {
  if (existsSync(".env")) {
    // Back-fill a secret if the file exists without one.
    const current = readFileSync(".env", "utf8");
    if (!/AUTH_SECRET\s*=\s*".{16,}"/.test(current)) {
      writeFileSync(".env", `${current.trim()}\nAUTH_SECRET="${randomBytes(36).toString("base64url")}"\n`);
      console.log("→ added a generated AUTH_SECRET to .env");
    }
    return;
  }

  if (existsSync(".env.example")) {
    copyFileSync(".env.example", ".env");
  } else {
    writeFileSync(
      ".env",
      ['DATABASE_URL="file:./campuspend.db"', "", "# Optional LLM upgrade for the AI parser", "# OPENAI_API_KEY=\"\"", ""].join("\n"),
    );
  }

  const contents = readFileSync(".env", "utf8").replace(
    /AUTH_SECRET\s*=\s*".*"/,
    `AUTH_SECRET="${randomBytes(36).toString("base64url")}"`,
  );
  writeFileSync(".env", /AUTH_SECRET/.test(contents) ? contents : `${contents}\nAUTH_SECRET="${randomBytes(36).toString("base64url")}"\n`);
  console.log("→ created .env with a generated AUTH_SECRET");
}

main();

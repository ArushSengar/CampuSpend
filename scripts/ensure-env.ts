/**
 * Creates .env on first run (it is git-ignored, so a fresh clone won't have
 * one). Copies .env.example and generates a random AUTH_SECRET so sessions are
 * signed with something unique to this machine.
 */
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

/**
 * Hosted dev sandboxes (Arena/e2b, Codespaces, Gitpod) serve the app from a
 * TLS-terminating proxy and usually embed it in an iframe on another origin.
 * A SameSite=Lax cookie is a third-party cookie there and gets dropped, so
 * login silently bounces back to /login. Default those environments to the
 * cross-site-safe attributes instead.
 */
const PROXIED_SANDBOX = Boolean(process.env.E2B_SANDBOX || process.env.CODESPACES || process.env.GITPOD_WORKSPACE_ID);

function main() {
  if (existsSync(".env")) {
    if (PROXIED_SANDBOX && !/COOKIE_SECURE\s*=/.test(readFileSync(".env", "utf8"))) {
      writeFileSync(".env", `${readFileSync(".env", "utf8").trim()}\n\n# Running inside a proxied sandbox: allow the session cookie cross-site.\nCOOKIE_SECURE=1\n`);
      console.log("→ detected a hosted sandbox, set COOKIE_SECURE=1 in .env");
    }
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

  let contents = readFileSync(".env", "utf8").replace(
    /AUTH_SECRET\s*=\s*".*"/,
    `AUTH_SECRET="${randomBytes(36).toString("base64url")}"`,
  );
  contents = /AUTH_SECRET/.test(contents)
    ? contents
    : `${contents}\nAUTH_SECRET="${randomBytes(36).toString("base64url")}"\n`;
  if (PROXIED_SANDBOX) {
    contents = `${contents.trim()}\n\n# Running inside a proxied sandbox: allow the session cookie cross-site.\nCOOKIE_SECURE=1\n`;
  }
  writeFileSync(".env", contents);
  console.log("→ created .env with a generated AUTH_SECRET");
}

main();

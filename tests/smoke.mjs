/**
 * Runs tests/smoke-entry.tsx inside jsdom against a live dev server.
 *
 *   node tests/smoke.mjs            # expects http://localhost:3000
 *   SMOKE_BASE=http://localhost:3001 node tests/smoke.mjs
 *
 * A real browser cannot always be installed (Playwright/Chrome downloads are
 * blocked in some sandboxes), so this is the closest thing to a visual check:
 * the actual client components, real DOM, real API responses.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import * as esbuild from "esbuild";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const DEMO = {
  email: process.env.SMOKE_EMAIL ?? "demo@campuspend.app",
  password: process.env.SMOKE_PASSWORD ?? "campuspend",
};
const ENTRY = path.resolve("tests/smoke-entry.tsx");
const SRC = path.resolve("src");
const STUBS = path.resolve("tests/stubs");

const EXTENSIONS = ["", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts"];

/** `@/lib/x`, `next/navigation` and friends resolved to real files. */
const resolvePlugin = {
  name: "smoke-resolve",
  setup(build) {
    build.onResolve({ filter: /^@\// }, (args) => {
      const base = path.join(SRC, args.path.slice(2));
      for (const ext of EXTENSIONS) {
        if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) return { path: base + ext };
      }
      return { errors: [{ text: `cannot resolve ${args.path}` }] };
    });
    build.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: path.join(STUBS, "next-navigation.ts") }));
    build.onResolve({ filter: /^next\/link$/ }, () => ({ path: path.join(STUBS, "next-link.tsx") }));
    build.onResolve({ filter: /^next\/image$/ }, () => ({ path: path.join(STUBS, "next-image.tsx") }));
  },
};

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(DEMO),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  const setCookie = res.headers.get("set-cookie");
  const jar = res.headers.getSetCookie?.() ?? (setCookie ? [setCookie] : []);
  const cookie = jar.map((c) => c.split(";")[0]).join("; ");
  if (!cookie) throw new Error("login did not return a session cookie");
  return cookie;
}

function installDom(base) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: base,
    pretendToBeVisual: true,
  });
  const { window } = dom;

  window.matchMedia =
    window.matchMedia ??
    (() => ({ matches: false, media: "", addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  class Observer {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  window.ResizeObserver = window.ResizeObserver ?? Observer;
  // jsdom has no layout engine, so scrolling APIs are missing.
  window.Element.prototype.scrollTo = window.Element.prototype.scrollTo ?? function scrollTo() {};
  window.Element.prototype.scrollIntoView = window.Element.prototype.scrollIntoView ?? function scrollIntoView() {};
  window.scrollTo = window.scrollTo ?? (() => {});
  window.IntersectionObserver = window.IntersectionObserver ?? Observer;

  globalThis.window = window;
  globalThis.document = window.document;
  Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  for (const key of [
    "HTMLElement",
    "HTMLInputElement",
    "HTMLTextAreaElement",
    "HTMLSelectElement",
    "Element",
    "Node",
    "Event",
    "MouseEvent",
    "KeyboardEvent",
    "CustomEvent",
    "SVGElement",
    "DOMParser",
    "getComputedStyle",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "localStorage",
    "sessionStorage",
    "ResizeObserver",
    "IntersectionObserver",
    "MutationObserver",
  ]) {
    if (window[key] !== undefined) globalThis[key] = window[key];
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.__SMOKE_PUSHES__ = [];
  if (process.env.SMOKE_DUMP) {
    globalThis.__SMOKE_DUMP__ = {};
    globalThis.__SMOKE_HTML__ = {};
  }

  return dom;
}

function installFetch(cookie) {
  const nodeFetch = globalThis.fetch.bind(globalThis);
  const proxied = (input, init) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = raw.startsWith("http") ? raw : `${BASE}${raw.startsWith("/") ? raw : `/${raw}`}`;
    const headers = new Headers(init?.headers ?? {});
    if (cookie) headers.set("cookie", cookie);
    return nodeFetch(url, { ...init, headers });
  };
  globalThis.fetch = proxied;
  globalThis.window.fetch = proxied;
}

async function bundle() {
  const outfile = path.join(os.tmpdir(), `campuspend-smoke-${process.pid}.mjs`);
  await esbuild.build({
    entryPoints: [ENTRY],
    outfile,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    jsx: "automatic",
    sourcemap: "inline",
    logLevel: "warning",
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: [resolvePlugin],
  });
  return outfile;
}

async function main() {
  const cookie = await login();
  const dom = installDom(BASE);
  installFetch(cookie);

  const problems = [];
  const realError = console.error.bind(console);
  console.error = (...args) => {
    problems.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(" "));
    realError("    [console.error]", ...args);
  };

  const outfile = await bundle();
  const mod = await import(pathToFileURL(outfile).href);

  const overview = await (await fetch(`${BASE}/api/overview`, { headers: { cookie } })).json();
  const isEmpty = (overview?.totals?.transactions ?? 0) === 0;
  if (isEmpty) console.log("  empty account detected — running the empty-state pass");

  let failures = 0;
  try {
    const results = isEmpty ? await mod.runEmptyState() : await mod.runSmoke();
    console.log(`\n  ${"page".padEnd(14)}${"chars".padStart(7)}  result`);
    console.log(`  ${"-".repeat(52)}`);
    for (const r of results) {
      const status = r.ok ? "ok" : `MISSING: ${r.missing.join(", ")}`;
      if (!r.ok) failures++;
      console.log(`  ${r.name.padEnd(14)}${String(r.chars).padStart(7)}  ${status}`);
      if (!r.ok || isEmpty) console.log(`      sample: ${r.sample}`);
    }

    if (process.env.SMOKE_DUMP) {
      const dir = process.env.SMOKE_DUMP === "1" ? "/tmp/smoke" : process.env.SMOKE_DUMP;
      fs.mkdirSync(dir, { recursive: true });
      for (const [name, text] of Object.entries(globalThis.__SMOKE_DUMP__)) {
        fs.writeFileSync(path.join(dir, `${name}.txt`), `${text}\n`);
        fs.writeFileSync(path.join(dir, `${name}.html`), String(globalThis.__SMOKE_HTML__[name]));
      }
      console.log(`\n  dumped rendered text for ${Object.keys(globalThis.__SMOKE_DUMP__).length} pages → ${dir}`);
    }

    if (!isEmpty) {
      const flow = await mod.runQuickAddFlow();
      console.log(`\n  quick-add flow   ${flow.ok ? "ok" : "FAILED"}\n      ${flow.detail}`);
      if (!flow.ok) failures++;
    }
  } finally {
    console.error = realError;
    fs.rmSync(outfile, { force: true });
    dom.window.close();
  }

  const noise = problems.filter((p) => !/not wrapped in act|ReactDOM.render|useLayoutEffect does nothing/.test(p));
  if (noise.length) {
    console.log(`\n  ${noise.length} React console error(s):`);
    for (const p of [...new Set(noise)].slice(0, 10)) console.log(`      - ${p.slice(0, 200)}`);
  }

  console.log(failures === 0 ? "\n  smoke: all green\n" : `\n  smoke: ${failures} failure(s)\n`);
  process.exit(failures === 0 && noise.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

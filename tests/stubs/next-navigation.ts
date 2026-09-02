/**
 * Minimal stand-ins for Next's client navigation APIs, used only by the
 * jsdom smoke runner (tests/smoke.mjs). The real modules need a Next
 * runtime; these give the components something inert to talk to.
 */

export function useRouter() {
  return {
    push: (url: string) => {
      globalThis.__SMOKE_PUSHES__.push(url);
    },
    replace: () => {},
    refresh: () => {},
    back: () => {},
    forward: () => {},
    prefetch: () => {},
  };
}

export function usePathname() {
  return globalThis.__SMOKE_PATH__ ?? "/";
}

export function useSearchParams() {
  return new URLSearchParams(globalThis.__SMOKE_SEARCH__ ?? "");
}

export function useParams() {
  return {};
}

export function redirect() {
  throw new Error("redirect() called outside a Next request");
}

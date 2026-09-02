export {};

/** Globals the smoke runner (tests/smoke.mjs) injects before mounting React. */
declare global {
  var __SMOKE_PATH__: string | undefined;
  var __SMOKE_SEARCH__: string | undefined;
  var __SMOKE_DUMP__: Record<string, string> | undefined;
  var __SMOKE_HTML__: Record<string, string> | undefined;
  var __SMOKE_PUSHES__: string[];
}

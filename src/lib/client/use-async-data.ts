"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

/**
 * Small data-fetching hook.
 *
 * `loading` is derived (the stored result remembers which URL produced it) so
 * nothing calls setState synchronously from inside an effect — which keeps the
 * React Compiler lint rules happy and avoids a render cascade on every filter
 * change.
 */
export function useAsyncData<T>(url: string | null, initial: T) {
  const [result, setResult] = useState<{ url: string; data: T } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    api
      .get<T>(url)
      .then((data) => {
        if (cancelled) return;
        setResult({ url, data });
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Request failed");
      });
    return () => {
      cancelled = true;
    };
  }, [url, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return {
    data: result?.data ?? initial,
    error,
    loading: Boolean(url) && result?.url !== url && !error,
    reload,
  };
}

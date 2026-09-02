"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Check, Info, TriangleAlert, X, Zap } from "lucide-react";
import { cn } from "@/lib/cn";

export type ToastTone = "success" | "error" | "info" | "warning";

export type Toast = {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
  duration?: number;
};

type ToastContextValue = {
  toast: (t: Omit<Toast, "id">) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const ICONS: Record<ToastTone, ReactNode> = {
  success: <Check className="h-4 w-4" />,
  error: <X className="h-4 w-4" />,
  info: <Info className="h-4 w-4" />,
  warning: <TriangleAlert className="h-4 w-4" />,
};

const TONES: Record<ToastTone, string> = {
  success: "bg-success text-white dark:text-[#062012]",
  error: "bg-danger text-white dark:text-[#20050d]",
  info: "bg-info text-white dark:text-[#04202e]",
  warning: "bg-warning text-white dark:text-[#241703]",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev.slice(-3), { ...t, id }]);
      setTimeout(() => remove(id), t.duration ?? 4200);
    },
    [remove],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, description) => toast({ title, description, tone: "success" }),
      error: (title, description) => toast({ title, description, tone: "error" }),
      info: (title, description) => toast({ title, description, tone: "info" }),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "animate-slide-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl px-4 py-3 shadow-pop",
              TONES[t.tone],
            )}
          >
            <span className="mt-0.5 shrink-0">{ICONS[t.tone]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t.title}</p>
              {t.description ? <p className="mt-0.5 text-xs opacity-90">{t.description}</p> : null}
            </div>
            <button onClick={() => remove(t.id)} className="shrink-0 opacity-70 transition hover:opacity-100" aria-label="Dismiss">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function AiBadge({ label = "AI" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-primary">
      <Zap className="h-3 w-3" />
      {label}
    </span>
  );
}

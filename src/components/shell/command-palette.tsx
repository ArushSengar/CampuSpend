"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, CornerDownLeft, Moon, Plus, Search, Sparkles, Sun, Download, LogOut } from "lucide-react";
import { NAV_ITEMS } from "./nav";
import { cn } from "@/lib/cn";

export type Action = {
  id: string;
  label: string;
  hint?: string;
  icon: React.ElementType;
  run: () => void;
};

export function CommandPalette({
  open,
  onClose,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  actions: Action[];
}) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo<Action[]>(() => {
    const nav: Action[] = NAV_ITEMS.map((n) => ({
      id: n.href,
      label: n.label,
      hint: n.hint,
      icon: n.icon,
      run: () => {
        window.location.href = n.href;
      },
    }));
    const all = [...actions, ...nav];
    if (!query.trim()) return all;
    const q = query.toLowerCase();
    return all.filter((a) => `${a.label} ${a.hint ?? ""}`.toLowerCase().includes(q));
  }, [actions, query]);

  // Reset the palette whenever it opens (render-time state adjustment).
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setIndex(0);
    }
  }

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIndex((i) => Math.min(i + 1, items.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const item = items[index];
        if (item) {
          item.run();
          onClose();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, items, index, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center pt-[12vh]">
      <div className="absolute inset-0 bg-[#05060a]/60 backdrop-blur-[3px]" onClick={onClose} aria-hidden />
      <div className="animate-pop-in relative z-10 w-[min(34rem,92vw)] overflow-hidden rounded-2xl border border-border bg-surface shadow-pop">
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 text-subtle" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            placeholder="Search pages or run a command…"
            className="h-12 flex-1 bg-transparent text-sm text-fg placeholder:text-subtle focus:outline-none"
          />
          <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[0.65rem] text-subtle">esc</kbd>
        </div>
        <div className="max-h-[52vh] overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-subtle">Nothing matches “{query}”.</p>
          ) : (
            items.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => {
                    item.run();
                    onClose();
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                    i === index ? "bg-primary-soft text-primary" : "text-fg hover:bg-surface-2",
                  )}
                >
                  <Icon className={cn("h-4 w-4", i === index ? "text-primary" : "text-subtle")} />
                  <span className="flex-1 truncate text-sm font-medium">{item.label}</span>
                  {item.hint ? <span className="truncate text-xs text-subtle">{item.hint}</span> : null}
                  {i === index ? <CornerDownLeft className="h-3.5 w-3.5 text-subtle" /> : null}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function useCommandPaletteShortcut(setOpen: Dispatch<SetStateAction<boolean>>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setOpen]);
}

export const PALETTE_ICONS = { ArrowRight, Moon, Plus, Sparkles, Sun, Download, LogOut };

"use client";

import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

const fieldBase =
  "w-full rounded-2xl border border-border/80 bg-surface-2/70 backdrop-blur px-3.5 text-sm text-fg placeholder:text-subtle transition-all duration-150 " +
  "focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { leftIcon?: ReactNode; rightSlot?: ReactNode }
>(function Input({ className, leftIcon, rightSlot, ...props }, ref) {
  if (leftIcon || rightSlot) {
    return (
      <div className="relative">
        {leftIcon ? (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle">
            {leftIcon}
          </span>
        ) : null}
        <input
          ref={ref}
          className={cn(fieldBase, "h-10.5", leftIcon && "pl-10", rightSlot && "pr-10", className)}
          {...props}
        />
        {rightSlot ? (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2">{rightSlot}</span>
        ) : null}
      </div>
    );
  }
  return <input ref={ref} className={cn(fieldBase, "h-10.5", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(fieldBase, "min-h-20 py-2.5 resize-y", className)}
        {...props}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          fieldBase,
          "h-10.5 cursor-pointer appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9",
          className,
        )}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2386868b' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        }}
        {...props}
      >
        {children}
      </select>
    );
  },
);

export function Field({
  label,
  hint,
  error,
  children,
  required,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="flex items-center justify-between text-xs font-semibold text-muted">
        <span>
          {label}
          {required ? <span className="ml-0.5 text-danger">*</span> : null}
        </span>
        {hint ? <span className="text-[0.7rem] font-normal text-subtle">{hint}</span> : null}
      </span>
      {children}
      {error ? <span className="block text-xs font-medium text-danger">{error}</span> : null}
    </label>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  description?: string;
  id?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      {label ? (
        <div className="min-w-0">
          <p className="text-xs font-bold text-fg">{label}</p>
          {description ? <p className="text-[0.7rem] text-muted">{description}</p> : null}
        </div>
      ) : null}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 cursor-pointer",
          checked ? "bg-primary" : "bg-surface-3",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200",
            checked ? "left-[1.375rem]" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex rounded-full border border-border/80 bg-surface-2/80 p-0.5 backdrop-blur-md",
        className,
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-full font-semibold transition-all duration-150 cursor-pointer",
            size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-xs",
            value === opt.value
              ? "bg-surface text-fg shadow-sm"
              : "text-muted hover:text-fg",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

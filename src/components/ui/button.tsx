"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success" | "glass";
type Size = "xs" | "sm" | "md" | "lg" | "icon" | "icon-sm";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_1px_0_0_rgba(255,255,255,0.16)_inset,0_6px_18px_-8px_color-mix(in_oklab,var(--primary)_70%,transparent)]",
  secondary: "bg-surface-2 text-fg hover:bg-surface-3 border border-border",
  outline: "border border-border-strong bg-transparent text-fg hover:bg-surface-2",
  ghost: "bg-transparent text-muted hover:bg-surface-2 hover:text-fg",
  danger: "bg-danger text-white hover:brightness-110 dark:text-[#20050d]",
  success: "bg-success text-white hover:brightness-110 dark:text-[#062012]",
  glass: "bg-surface/70 backdrop-blur border border-border text-fg hover:bg-surface",
};

const sizes: Record<Size, string> = {
  xs: "h-7 px-2.5 text-xs gap-1 rounded-lg",
  sm: "h-9 px-3 text-sm gap-1.5 rounded-xl",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-5 text-[0.95rem] gap-2 rounded-2xl",
  icon: "h-10 w-10 rounded-xl",
  "icon-sm": "h-8 w-8 rounded-lg",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  block?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, leftIcon, rightIcon, block, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
        "disabled:opacity-50 disabled:pointer-events-none active:scale-[0.985]",
        variants[variant],
        sizes[size],
        block && "w-full",
        className,
      )}
      {...props}
    >
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
});

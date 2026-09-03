"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success" | "glass" | "pill";
type Size = "xs" | "sm" | "md" | "lg" | "icon" | "icon-sm";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-white hover:brightness-105 active:brightness-95 shadow-[0_1px_2px_rgba(0,0,0,0.1),0_4px_16px_-4px_color-mix(in_oklab,var(--primary)_50%,transparent)]",
  secondary:
    "bg-surface-2 text-fg hover:bg-surface-3 border border-border/80 backdrop-blur-md",
  outline:
    "border border-border bg-transparent text-fg hover:bg-surface-2",
  ghost:
    "bg-transparent text-muted hover:bg-surface-2/80 hover:text-fg",
  danger:
    "bg-danger text-white hover:brightness-110 active:brightness-95 shadow-[0_4px_16px_-4px_rgba(255,59,48,0.4)]",
  success:
    "bg-success text-white hover:brightness-110 active:brightness-95 shadow-[0_4px_16px_-4px_rgba(52,199,89,0.4)]",
  glass:
    "bg-surface/75 backdrop-blur-xl border border-border/80 text-fg hover:bg-surface hover:border-border",
  pill:
    "bg-surface-2 text-fg hover:bg-primary-soft hover:text-primary border border-border/60 rounded-full",
};

const sizes: Record<Size, string> = {
  xs: "h-7 px-2.5 text-xs gap-1 rounded-full font-medium",
  sm: "h-8.5 px-3.5 text-xs gap-1.5 rounded-full font-semibold",
  md: "h-10 px-4.5 text-sm gap-2 rounded-full font-semibold",
  lg: "h-12 px-6 text-base gap-2.5 rounded-full font-semibold",
  icon: "h-9.5 w-9.5 rounded-full",
  "icon-sm": "h-7.5 w-7.5 rounded-full",
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
        "inline-flex items-center justify-center transition-all duration-150 select-none cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
        "disabled:opacity-40 disabled:pointer-events-none active:scale-[0.96]",
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

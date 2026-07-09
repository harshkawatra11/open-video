"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variantCls: Record<Variant, string> = {
  primary: "bg-accent text-bg-0 hover:bg-accent-hi active:bg-accent-press font-medium",
  secondary: "bg-bg-3 text-fg-0 hover:bg-bg-4 border border-line-2",
  ghost: "bg-transparent text-fg-1 hover:bg-bg-3 hover:text-fg-0",
  danger: "bg-error/90 text-fg-0 hover:bg-error",
};

const sizeCls: Record<Size, string> = {
  sm: "h-7 px-2.5 text-[12px] rounded-sm gap-1.5",
  md: "h-9 px-3.5 text-[13px] rounded-md gap-2",
  lg: "h-11 px-5 text-[14px] rounded-md gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap transition-colors duration-std ease-std disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:shadow-focus",
        variantCls[variant],
        sizeCls[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";

import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "primary" | "success" | "danger" | "warning" | "zinc";
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  className,
  variant = "primary",
  ...props
}) => {
  return (
    <span
      className={twMerge(
        clsx(
          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider",
          {
            "bg-[#584bf7]/10 text-[#584bf7] glow-tag-primary": variant === "primary",
            "bg-emerald-500/10 text-emerald-600 glow-tag-emerald": variant === "success",
            "bg-red-500/10 text-red-600 glow-tag-rose": variant === "danger",
            "bg-amber-500/10 text-amber-600 glow-tag-amber": variant === "warning",
            "bg-zinc-100 text-zinc-600 border border-zinc-200": variant === "zinc",
          }
        ),
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};

import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "glass";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  ...props
}) => {
  return (
    <button
      disabled={disabled || isLoading}
      className={twMerge(
        clsx(
          "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
          {
            // Variants
            "bg-gradient-to-r from-sky-400 to-blue-600 hover:from-sky-500 hover:to-blue-700 text-white shadow-[0_4px_20px_rgba(56,189,248,0.25)] hover:shadow-[0_4px_25px_rgba(56,189,248,0.45)] border-0":
              variant === "primary",
            "bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/40 text-slate-100":
              variant === "secondary",
            "bg-destructive hover:bg-red-500 text-white shadow-[0_10px_20px_-5px_rgba(239,68,68,0.25)]":
              variant === "danger",
            "bg-transparent text-slate-400 hover:text-white hover:bg-slate-800/60":
              variant === "ghost",
            "glass-panel text-slate-200 hover:bg-sky-500/10 hover:border-sky-500/30":
              variant === "glass",

            // Sizes
            "px-3 py-1.5 text-xs": size === "sm",
            "px-4 py-2 text-sm": size === "md",
            "px-6 py-3 text-base": size === "lg",
          }
        ),
        className
      )}
      {...props}
    >
      {isLoading ? (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : null}
      {children}
    </button>
  );
};

import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

interface SpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const Spinner: React.FC<SpinnerProps> = ({ className, size = "md" }) => {
  return (
    <div
      className={twMerge(
        clsx("animate-spin rounded-full border-t-2 border-primary", {
          "h-4 w-4 border-t": size === "sm",
          "h-8 w-8 border-t-2": size === "md",
          "h-12 w-12 border-t-2": size === "lg",
        }),
        className
      )}
      style={{ borderRightColor: "transparent", borderBottomColor: "transparent" }}
    />
  );
};

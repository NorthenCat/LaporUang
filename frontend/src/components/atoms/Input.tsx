import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input: React.FC<InputProps> = ({
  className,
  error = false,
  ...props
}) => {
  return (
    <input
      className={twMerge(
        clsx(
          "w-full bg-slate-950/40 border border-zinc-800 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500 focus:bg-slate-950 transition-all duration-200 placeholder:text-zinc-500 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]",
          {
            "border-destructive focus:border-destructive focus:ring-destructive": error,
            "[color-scheme:dark]": true,
          }
        ),
        className
      )}
      onClick={(e) => {
        if (props.type === "date") {
          try {
            (e.target as HTMLInputElement).showPicker?.();
          } catch (err) {
            // Ignore if not supported
          }
        }
        props.onClick?.(e);
      }}
      {...props}
    />
  );
};

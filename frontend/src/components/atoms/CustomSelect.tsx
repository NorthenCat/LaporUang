"use client";
import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { twMerge } from "tailwind-merge";

interface Option {
  label: string;
  value: string | number;
}

interface CustomSelectProps {
  value: string | number;
  onChange: (value: string | number) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
  disabled = false,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value || opt.value === String(value) || String(opt.value) === String(value));

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <div className={twMerge("relative inline-block w-full", className)} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={twMerge(
          "w-full bg-slate-950/40 border border-zinc-800 text-slate-100 rounded-lg px-3 py-2 text-sm flex items-center justify-between focus:outline-none focus:border-sky-500 focus:bg-slate-950 transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder || "Pilih..."}</span>
        <ChevronDown className={twMerge("h-4 w-4 text-zinc-500 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-slate-950 border border-zinc-800 rounded-lg shadow-2xl shadow-black py-1">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-zinc-500">Kosong</div>
          ) : (
            options.map((opt) => {
              const isSelected = String(value) === String(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={twMerge(
                    "w-full text-left px-3 py-2.5 text-sm hover:bg-slate-800 transition-colors",
                    isSelected ? "text-sky-400 font-bold bg-sky-500/10" : "text-slate-200"
                  )}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

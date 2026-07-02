import React from "react";
import { formatIDR } from "@/utils/money";

interface BudgetRingProps {
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  planned: number;
  actual: number;
}

export const BudgetRing: React.FC<BudgetRingProps> = ({
  categoryName,
  categoryColor,
  planned,
  actual,
}) => {
  const percent = planned > 0 ? Math.min(Math.round((actual / planned) * 100), 200) : 0;
  const isOver = actual > planned;

  // SVG ring properties
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(percent, 100) / 100) * circumference;

  let ringColor = categoryColor;
  if (percent >= 100) {
    ringColor = "#ef4444"; // red warning
  } else if (percent >= 80) {
    ringColor = "#f59e0b"; // amber warning
  }

  return (
    <div className="glass-panel rounded-xl p-4 flex items-center gap-4 hover-scale">
      {/* SVG Circular Progress */}
      <div className="relative h-18 w-18 flex items-center justify-center shrink-0">
        <svg className="w-full h-full transform -rotate-90">
          {/* Track Ring */}
          <circle
            cx="36"
            cy="36"
            r={radius}
            className="stroke-zinc-800/60"
            strokeWidth="5"
            fill="transparent"
          />
          {/* Progress Ring */}
          <circle
            cx="36"
            cy="36"
            r={radius}
            stroke={ringColor}
            strokeWidth="5"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />
        </svg>
        <span className="absolute text-[10px] font-extrabold text-white">{percent}%</span>
      </div>

      <div className="flex flex-col gap-1 w-full min-w-0">
        <div className="flex justify-between items-center">
          <span className="font-semibold text-sm text-foreground truncate">{categoryName}</span>
          {isOver ? (
            <span className="text-[10px] font-extrabold uppercase text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 glow-tag-rose">
              Over Limit
            </span>
          ) : null}
        </div>
        
        <div className="flex justify-between items-center text-xs text-zinc-400">
          <span>Actual: {formatIDR(actual)}</span>
          <span>Limit: {formatIDR(planned)}</span>
        </div>
      </div>
    </div>
  );
};

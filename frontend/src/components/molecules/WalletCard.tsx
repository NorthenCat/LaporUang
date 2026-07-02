import React from "react";
import * as Icons from "lucide-react";
import { formatIDR } from "@/utils/money";

interface WalletCardProps {
  name: string;
  balance: number;
  type: string;
  color: string;
  icon: string;
  isArchived?: boolean;
  onClick?: () => void;
}

export const WalletCard: React.FC<WalletCardProps> = ({
  name,
  balance,
  type,
  color,
  icon,
  isArchived = false,
  onClick,
}) => {
  // Dynamically load icon from Lucide-React
  const IconComponent = (Icons as any)[icon] || Icons.Wallet;

  return (
    <div
      onClick={onClick}
      className="relative overflow-hidden rounded-xl p-5 hover-scale glass-panel cursor-pointer flex flex-col gap-6"
      style={{
        borderLeft: `4px solid ${color}`,
      }}
    >
      {/* Background glow based on wallet color */}
      <div
        className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10 blur-2xl pointer-events-none"
        style={{ backgroundColor: color }}
      />

      <div className="flex justify-between items-start">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground tracking-wide">{name}</span>
          <span className="text-xs text-zinc-500 capitalize tracking-wide">
            {type} {isArchived ? "(Diarsipkan)" : ""}
          </span>
        </div>
        <div
          className="p-2.5 rounded-lg text-zinc-200"
          style={{ backgroundColor: `${color}20` }}
        >
          <IconComponent className="h-5 w-5" style={{ color }} />
        </div>
      </div>

      <div className="flex flex-col gap-1 mt-auto">
        <span className="text-xs text-zinc-500 uppercase font-semibold tracking-wider">Saldo</span>
        <span className="text-2xl font-extrabold tracking-tight text-white">
          {formatIDR(balance)}
        </span>
      </div>
    </div>
  );
};

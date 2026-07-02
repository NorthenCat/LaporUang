import React, { useRef, useState } from "react";
import { WalletCard } from "../molecules/WalletCard";
import { Plus } from "lucide-react";

interface Wallet {
  id: string;
  name: string;
  balance: number;
  type: string;
  color: string;
  icon: string;
  is_archived: boolean;
}

interface WalletGridProps {
  wallets: Wallet[];
  isLoading?: boolean;
  onAddWallet?: () => void;
  onSelectWallet?: (wallet: Wallet) => void;
}

export const WalletGrid: React.FC<WalletGridProps> = ({
  wallets,
  isLoading = false,
  onAddWallet,
  onSelectWallet,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const scrollLeft = container.scrollLeft;
    const cardWidth = container.clientWidth * 0.92;
    const index = Math.round(scrollLeft / (cardWidth + 20)); // approx gap
    setActiveIndex(index);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3].map((idx) => (
          <div key={idx} className="h-36 glass-panel rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex md:grid md:grid-cols-2 lg:grid-cols-3 overflow-x-auto md:overflow-x-visible snap-x snap-mandatory scroll-smooth no-scrollbar gap-5 px-[4vw] md:px-0 -mx-4 md:mx-0 py-6 md:py-0"
    >
      {wallets.map((w, idx) => (
        <div
          key={w.id}
          className={`snap-center shrink-0 w-[92%] md:w-auto transition-all duration-300 ${
            activeIndex === idx
              ? "scale-[1.02] opacity-100 shadow-[0_0_20px_rgba(56,189,248,0.1)]"
              : "scale-[0.95] opacity-60 md:scale-100 md:opacity-100"
          }`}
        >
          <WalletCard
            name={w.name}
            balance={w.balance}
            type={w.type}
            color={w.color}
            icon={w.icon}
            isArchived={w.is_archived}
            onClick={() => onSelectWallet?.(w)}
          />
        </div>
      ))}

      {onAddWallet ? (
        <div
          className={`snap-center shrink-0 w-[85%] md:w-auto transition-all duration-300 ${
            activeIndex === wallets.length
              ? "scale-[1.02] opacity-100 shadow-[0_0_20px_rgba(56,189,248,0.1)]"
              : "scale-[0.95] opacity-60 md:scale-100 md:opacity-100"
          }`}
        >
          <button
            onClick={onAddWallet}
            className="w-full h-full min-h-[144px] border border-dashed border-zinc-800 hover:border-sky-500/50 bg-slate-950/20 hover:bg-sky-500/5 rounded-2xl flex flex-col items-center justify-center gap-3 group transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md"
          >
            <div className="p-3 bg-slate-900 group-hover:bg-sky-500/10 rounded-full group-hover:text-sky-400 transition-all duration-200 border border-zinc-800/80 group-hover:border-sky-500/20">
              <Plus className="h-5 w-5 text-zinc-500 group-hover:text-sky-400" />
            </div>
            <span className="text-sm font-bold text-zinc-400 group-hover:text-sky-400 tracking-wide transition-all">
              Tambah Dompet
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
};

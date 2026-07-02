"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ReceiptText,
  PieChart,
  TrendingUp,
  MessageSquareCode,
  Settings,
  LogOut,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  CalendarRange,
  Wallet as WalletIcon,
  X,
  Plus,
} from "lucide-react";

export const NavigationBar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [txMenuOpen, setTxMenuOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Hydrate collapsed state from localStorage
  useEffect(() => {
    const val = localStorage.getItem("sidebar_collapsed");
    if (val === "true") {
      setIsCollapsed(true);
    }
  }, []);

  const toggleCollapse = () => {
    const newVal = !isCollapsed;
    setIsCollapsed(newVal);
    localStorage.setItem("sidebar_collapsed", newVal ? "true" : "false");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user_email");
    router.push("/auth");
  };

  // Structured flat menu items under headers
  const menuGroups = [
    {
      title: "Transaksi",
      items: [
        { name: "Dompetku", href: "/", icon: WalletIcon },
        { name: "Riwayat Transaksi", href: "/transactions", icon: ReceiptText },
        { name: "Transaksi Rutin", href: "/fixed-expenses", icon: CalendarRange },
        { name: "Anggaran Kategori", href: "/budgets", icon: PieChart },
      ],
    },
    {
      title: "Analisis Pintar",
      items: [
        { name: "Proyeksi Kas", href: "/projections", icon: TrendingUp },
        { name: "Asisten AI", href: "/ai", icon: MessageSquareCode },
      ],
    },
    {
      title: "Master Data",
      items: [
        { name: "Pengaturan", href: "/settings", icon: Settings },
      ],
    },
  ];

  // For Mobile Radial Menu
  const mobileNavItems = [
    { name: "Dompetku", href: "/", icon: WalletIcon },
    { name: "Transaksi", href: "/transactions", icon: ReceiptText },
    { name: "Rutin", href: "/fixed-expenses", icon: CalendarRange },
    { name: "Anggaran", href: "/budgets", icon: PieChart },
    { name: "Proyeksi", href: "/projections", icon: TrendingUp },
    { name: "Asisten AI", href: "/ai", icon: MessageSquareCode },
    { name: "Setelan", href: "/settings", icon: Settings },
  ];

  return (
    <>
      {/* Mobile Radial Menu Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm animate-fade-in md:hidden"
        />
      )}

      {/* Desktop Sidebar (visible md and up) */}
      <aside
        className={`relative hidden md:flex flex-col glass-panel border-r border-border h-screen sticky top-0 shrink-0 p-4 transition-all duration-300 ${
          isCollapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Floating toggle sidebar button on the border */}
        <button
          onClick={toggleCollapse}
          className="absolute z-50 p-1 rounded-full border border-zinc-800 hover:border-sky-500/30 bg-[#090e17] text-zinc-400 hover:text-white cursor-pointer transition-all duration-200 shadow-md flex items-center justify-center"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          style={{ width: "30px", height: "30px", right: "-15px", top: "25px" }}
        >
          {isCollapsed ? <ChevronRight className="h-4.5 w-4.5" /> : <ChevronLeft className="h-4.5 w-4.5" />}
        </button>

        {/* Header Logo */}
        <div className={`flex items-center ${isCollapsed ? "justify-center" : "justify-between"} px-2 py-4 mb-6 relative`}>
          <div className="flex items-center gap-2">
            <div className="bg-sky-500/10 p-2.5 rounded-xl text-sky-400 border border-sky-500/20 shadow-[0_0_15px_rgba(56,189,248,0.25)] shrink-0">
              <TrendingDown className="h-5 w-5 stroke-[2.5]" />
            </div>
            {!isCollapsed && (
              <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent truncate animate-fade-in">
                LaporUang
              </span>
            )}
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex flex-col gap-4 w-full overflow-y-auto max-h-[calc(100vh-160px)] no-scrollbar">
          {menuGroups.map((group) => (
            <div key={group.title} className="flex flex-col gap-1 w-full">
              {/* Group Title - Hidden when collapsed */}
              {!isCollapsed && (
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 mt-2 mb-1 px-3.5 animate-fade-in">
                  {group.title}
                </span>
              )}
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    title={isCollapsed ? item.name : undefined}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                      isActive
                        ? "bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-[0_0_15px_rgba(56,189,248,0.15)]"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-800/40"
                    }`}
                  >
                    <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? "text-sky-400" : ""}`} />
                    {!isCollapsed && <span className="animate-fade-in">{item.name}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          title={isCollapsed ? "Keluar" : undefined}
          className={`flex items-center gap-3 px-3.5 py-2.5 mt-auto rounded-xl text-xs sm:text-sm font-semibold text-zinc-500 hover:text-red-400 hover:bg-red-500/5 transition-all duration-200 cursor-pointer ${
            isCollapsed ? "justify-center" : ""
          }`}
        >
          <LogOut className="h-4.5 w-4.5 shrink-0" />
          {!isCollapsed && <span>Keluar</span>}
        </button>
      </aside>

      {/* Mobile Sticky Floating radial menu (visible below md) */}
      {/* Overlay Backdrop */}
      <div 
        className={`md:hidden fixed inset-0 bg-[#090e17]/80 backdrop-blur-sm z-40 transition-opacity duration-300 ${isMobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      <div 
        className="md:hidden fixed z-50 flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        style={{
          left: "50%",
          top: isMobileMenuOpen ? "50%" : "calc(100% - 52px)", // 52px is bottom-6 (24px) + half button (28px)
          transform: "translate(-50%, -50%)"
        }}
      >
        {/* Floating Radial Items */}
        {mobileNavItems.map((item, i) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          const totalItems = mobileNavItems.length;
          const radius = 125; // Roulette wheel radius
          
          // 360 degrees spread starting from Top (-90 degrees)
          const theta = (-90 * Math.PI) / 180 + (i * (360 / totalItems) * Math.PI) / 180;

          const x = Math.cos(theta) * radius;
          const y = Math.sin(theta) * radius;

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute flex flex-col items-center gap-2 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
              style={{
                transform: isMobileMenuOpen
                  ? `translate(${x}px, ${y}px) scale(1)`
                  : "translate(0px, 0px) scale(0.3)",
                opacity: isMobileMenuOpen ? 1 : 0,
                pointerEvents: isMobileMenuOpen ? "auto" : "none",
                transitionDelay: isMobileMenuOpen ? `${i * 30}ms` : "0ms"
              }}
            >
              <div
                className={`w-14 h-14 rounded-full border flex items-center justify-center shadow-2xl backdrop-blur-md transition-all duration-200 ${
                  isActive
                    ? "bg-sky-500/20 text-sky-400 border-sky-500/40 shadow-[0_0_20px_rgba(56,189,248,0.3)]"
                    : "bg-slate-900/90 text-zinc-300 border-zinc-700 hover:text-white hover:bg-slate-800"
                }`}
              >
                <Icon className="h-6 w-6" />
              </div>
              <span className="text-[10px] font-bold text-zinc-200 bg-slate-950/80 px-2.5 py-1 rounded-full border border-zinc-800/80 whitespace-nowrap shadow-md">
                {item.name}
              </span>
            </Link>
          );
        })}

        {/* Main Floating Trigger Button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={`relative z-10 w-14 h-14 rounded-full flex items-center justify-center border cursor-pointer transition-all duration-500 shadow-xl ${
            isMobileMenuOpen
              ? "bg-zinc-800 border-zinc-700 text-white rotate-[135deg] scale-110"
              : "bg-sky-500 text-white border-sky-400/20 hover:bg-sky-400 shadow-[0_0_25px_rgba(56,189,248,0.45)]"
          }`}
          title="Toggle Navigation Menu"
        >
          <Plus className="h-6 w-6 transition-transform duration-300" />
        </button>
      </div>
    </>
  );
};

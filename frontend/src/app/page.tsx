"use client";

import React, { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/templates/MainLayout";
import { WalletGrid } from "@/components/organisms/WalletGrid";
import { BudgetRing } from "@/components/molecules/BudgetRing";
import { Button } from "@/components/atoms/Button";
import { FormField } from "@/components/molecules/FormField";
import { CurrencyFormField } from "@/components/molecules/CurrencyFormField";
import { CustomSelect } from "@/components/atoms/CustomSelect";
import { apiRequest } from "@/utils/api";
import { formatIDR } from "@/utils/money";
import {
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  TrendingDown,
  ReceiptText,
  Wallet,
  X,
  Sparkles,
  Clock,
} from "lucide-react";
import Link from "next/link";

interface WalletData {
  id: string;
  name: string;
  balance: number;
  type: string;
  color: string;
  icon: string;
  is_archived: boolean;
}

interface BudgetData {
  id: string;
  category_id: string;
  amount: number;
  category_name: string;
  category_color: string;
  category_icon: string;
  actual_spending: number;
}

interface TransactionData {
  id: string;
  wallet_id: string;
  category_id: string;
  type: string;
  amount: number;
  date: string;
  note?: string;
  merchant?: string;
}

export default function Dashboard() {
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [budgets, setBudgets] = useState<BudgetData[]>([]);
  const [recentTxns, setRecentTxns] = useState<TransactionData[]>([]);
  const [recurringRules, setRecurringRules] = useState<any[]>([]);
  // Mobile active highlights scroll tracking
  const highlightContainerRef = useRef<HTMLDivElement>(null);
  const [activeHighlightIndex, setActiveHighlightIndex] = useState(0);

  const handleHighlightScroll = () => {
    if (!highlightContainerRef.current) return;
    const container = highlightContainerRef.current;
    const scrollLeft = container.scrollLeft;
    // When width is narrow, the items are around 85vw width.
    // We can calculate active index by dividing scrollLeft by card width approx.
    const width = container.clientWidth;
    const cardWidth = width * 0.85;
    const index = Math.round(scrollLeft / (cardWidth + 20)); // 20px is gap-5
    setActiveHighlightIndex(index);
  };
  
  const [isLoading, setIsLoading] = useState(true);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);



  // Pay recurring rule states
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<any | null>(null);
  const [payWalletId, setPayWalletId] = useState("");
  const [payDate, setPayDate] = useState("");
  const [isPaySaving, setIsPaySaving] = useState(false);
  const [payError, setPayError] = useState("");

  // Add wallet form states
  const [walletName, setWalletName] = useState("");
  const [walletBalance, setWalletBalance] = useState("");
  const [walletType, setWalletType] = useState("cash");
  const [walletColor, setWalletColor] = useState("#584bf7");
  const [walletIcon, setWalletIcon] = useState("Wallet");
  const [isWalletSaving, setIsWalletSaving] = useState(false);
  const [walletError, setWalletError] = useState("");

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [walletData, budgetData, txnData, rulesData] = await Promise.all([
        apiRequest("/wallets").catch(() => []),
        apiRequest("/budgets").catch(() => []),
        apiRequest("/transactions").catch(() => []),
        apiRequest("/recurring-rules").catch(() => []),
      ]);

      setWallets(walletData || []);
      setBudgets(budgetData || []);
      setRecentTxns(txnData ? txnData.slice(0, 5) : []); // limit to 5 recent
      setRecurringRules(rulesData || []);
    } catch {
      // Handle error
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddWalletSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsWalletSaving(true);
    setWalletError("");

    const parsedBalance = parseInt(walletBalance, 10);
    if (isNaN(parsedBalance) || parsedBalance < 0) {
      setWalletError("Saldo awal harus berupa angka positif");
      setIsWalletSaving(false);
      return;
    }

    try {
      await apiRequest("/wallets", "POST", {
        name: walletName,
        balance: parsedBalance,
        type: walletType,
        color: walletColor,
        icon: walletIcon,
      });

      setIsWalletSaving(false);
      setIsWalletModalOpen(false);
      
      // Reset form
      setWalletName("");
      setWalletBalance("");
      
      // Refresh dashboard
      fetchDashboardData();
    } catch (err: any) {
      setWalletError(err.message || "Gagal membuat dompet");
      setIsWalletSaving(false);
    }
  };

  const handleExecutePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRule) return;

    setIsPaySaving(true);
    setPayError("");

    try {
      await apiRequest(`/recurring-rules/${selectedRule.id}/execute`, "POST", {
        wallet_id: payWalletId,
        execution_date: new Date(payDate).toISOString(),
      });

      setIsPaySaving(false);
      setIsPayModalOpen(false);
      setSelectedRule(null);
      fetchDashboardData();
    } catch (err: any) {
      setPayError(err.message || "Gagal memproses pembayaran");
      setIsPaySaving(false);
    }
  };

  // Compute stats
  const totalCombinedBalance = wallets
    .filter((w) => !w.is_archived)
    .reduce((sum, w) => sum + w.balance, 0);

  // Filter due soon or overdue bills (e.g. next_due_date within 3 days or in the past)
  const dueBills = recurringRules.filter((rule) => {
    if (!rule.next_due_date) return false;
    const dueDate = new Date(rule.next_due_date);
    const now = new Date();
    dueDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    
    // Check if already processed for this period
    if (rule.frequency === "monthly") {
      const dueYear = dueDate.getFullYear();
      const dueMonth = dueDate.getMonth();
      const nowYear = now.getFullYear();
      const nowMonth = now.getMonth();
      if ((dueYear > nowYear) || (dueYear === nowYear && dueMonth > nowMonth)) {
        return false;
      }
    } else if (rule.frequency === "yearly") {
      if (dueDate.getFullYear() > now.getFullYear()) return false;
    } else if (rule.frequency === "weekly" || rule.frequency === "biweekly" || rule.frequency === "every_other_week") {
      if (dueDate.getTime() > now.getTime()) return false;
    }

    const limitTime = now.getTime() + 3 * 24 * 60 * 60 * 1000;
    return dueDate.getTime() <= limitTime;
  });

  return (
    <MainLayout>
      <div className="flex flex-col gap-9 w-full max-w-6xl mx-auto animate-fade-in">
        
        {/* Upper Header Welcome */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 w-fit text-sky-400 text-[10px] font-extrabold uppercase tracking-widest shadow-sm glow-tag-primary">
              <Sparkles className="h-3 w-3" /> Rekap Finansial Anda
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Dashboard</h1>
            <p className="text-xs sm:text-sm text-zinc-400 font-medium">Analisis pengeluaran bulanan dan status kas Anda secara terpusat.</p>
          </div>
        </div>

        {/* Top Highlight Summary Card */}
        <div
          ref={highlightContainerRef}
          onScroll={handleHighlightScroll}
          className="flex md:grid md:grid-cols-3 overflow-x-auto md:overflow-x-visible snap-x snap-mandatory scroll-smooth no-scrollbar gap-5 px-[4vw] md:px-0 -mx-4 md:mx-0 py-6 md:py-0"
        >
          {/* Card 1: Combined Balance */}
          <div
            className={`snap-center shrink-0 w-[92%] md:w-auto transition-all duration-300 ${
              activeHighlightIndex === 0
                ? "scale-[1.02] opacity-100 shadow-[0_0_25px_rgba(34,211,238,0.15)]"
                : "scale-[0.95] opacity-60 md:scale-100 md:opacity-100"
            } glass-panel p-6 rounded-[24px] flex flex-col justify-between gap-5 border border-border hover-scale relative overflow-hidden`}
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-cyan-400" />
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Total Saldo Aktif</span>
              <div className="bg-cyan-500/10 p-2.5 rounded-xl text-cyan-400 border border-cyan-500/20 glow-tag-cyan">
                <Wallet className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                {formatIDR(totalCombinedBalance)}
              </span>
              <span className="text-[10px] text-zinc-500 font-semibold mt-1">Akumulasi seluruh rekening aktif</span>
            </div>
          </div>

          {/* Card 2: Combined Budget Limit */}
          <div
            className={`snap-center shrink-0 w-[92%] md:w-auto transition-all duration-300 ${
              activeHighlightIndex === 1
                ? "scale-[1.02] opacity-100 shadow-[0_0_25px_rgba(56,189,248,0.15)]"
                : "scale-[0.95] opacity-60 md:scale-100 md:opacity-100"
            } glass-panel p-6 rounded-[24px] flex flex-col justify-between gap-5 border border-border hover-scale relative overflow-hidden`}
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-sky-400" />
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Total Anggaran (Limit)</span>
              <div className="bg-sky-500/10 p-2.5 rounded-xl text-sky-400 border border-sky-500/20 glow-tag-sky">
                <ArrowUpRight className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                {formatIDR(budgets.reduce((sum, b) => sum + b.amount, 0))}
              </span>
              <span className="text-[10px] text-zinc-500 font-semibold mt-1">Target limit belanja bulanan</span>
            </div>
          </div>

          {/* Card 3: Combined Spending */}
          <div
            className={`snap-center shrink-0 w-[85%] md:w-auto transition-all duration-300 ${
              activeHighlightIndex === 2
                ? "scale-[1.02] opacity-100 shadow-[0_0_25px_rgba(99,102,241,0.15)]"
                : "scale-[0.95] opacity-60 md:scale-100 md:opacity-100"
            } glass-panel p-6 rounded-[24px] flex flex-col justify-between gap-5 border border-border hover-scale relative overflow-hidden`}
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-indigo-500" />
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Terpakai Anggaran</span>
              <div className="bg-indigo-500/10 p-2.5 rounded-xl text-indigo-400 border border-indigo-500/20 glow-tag-indigo">
                <ArrowDownRight className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                {formatIDR(budgets.reduce((sum, b) => sum + b.actual_spending, 0))}
              </span>
              <span className="text-[10px] text-zinc-500 font-semibold mt-1">Realisasi spending dari limit aktif</span>
            </div>
          </div>
        </div>

        {/* Quick Payment Alert Widget */}
        {dueBills.length > 0 ? (
          <div className="flex flex-col gap-4 p-5 glass-panel border border-sky-500/20 bg-sky-500/5 rounded-[24px] glow-tag-sky relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-sky-500" />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-xl">
                  <Clock className="h-4.5 w-4.5" />
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">Ada {dueBills.length} Jadwal Rutin Jatuh Tempo</span>
                  <span className="text-xs text-zinc-400 font-semibold">Segera konfirmasi pencatatan untuk memperbarui proyeksi arus kas Anda.</span>
                </div>
              </div>
              <Link href="/fixed-expenses" className="text-xs text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1">
                Kelola Semua Jadwal &rarr;
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
              {dueBills.map((bill) => {
                const isOverdue = bill.next_due_date && new Date(bill.next_due_date) < new Date();
                const isIncome = bill.type === "income";
                return (
                  <div key={bill.id} className={`flex justify-between items-center gap-3 p-3 bg-slate-950/40 border rounded-xl ${isIncome ? "border-cyan-500/20 bg-cyan-500/[0.02]" : "border-zinc-850"}`}>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${isIncome ? "bg-cyan-400" : "bg-sky-400"}`} />
                        <span className="text-xs font-bold text-white truncate">{bill.category_name}</span>
                      </div>
                      <span className="text-[10px] text-zinc-400 font-semibold truncate pl-3">
                        {bill.note || (isIncome ? "Pendapatan" : "Tagihan")} • {formatIDR(bill.amount)}
                      </span>
                      {bill.next_due_date && (
                        <span className={`text-[9px] font-bold mt-0.5 pl-3 ${isOverdue && !isIncome ? "text-indigo-400 animate-pulse" : isOverdue && isIncome ? "text-cyan-400" : "text-zinc-500"}`}>
                          {isIncome ? "Tanggal Cair:" : "Jatuh Tempo:"} {new Date(bill.next_due_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} {isOverdue && (isIncome ? "(Tersedia)" : "(Terlambat)")}
                        </span>
                      )}
                    </div>
                    <Button
                      onClick={() => {
                        setSelectedRule(bill);
                        setPayWalletId(bill.wallet_id);
                        setPayDate(new Date().toISOString().substring(0, 10));
                        setIsPayModalOpen(true);
                      }}
                      variant="primary"
                      className="px-3 py-1.5 text-[10px] font-extrabold h-fit shrink-0"
                    >
                      {isIncome ? "Cairkan" : "Bayar"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Wallets Ledger Section */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-white tracking-tight">Dompet Saya</h2>
          </div>
          <WalletGrid
            wallets={wallets}
            isLoading={isLoading}
            onAddWallet={() => setIsWalletModalOpen(true)}
          />
        </div>

        {/* Budgets & Recent Transactions Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Category Budgets Circular Indicators */}
          <div className="lg:col-span-1 flex flex-col gap-5">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-extrabold text-white tracking-tight">Anggaran Kategori</h2>
              <Link href="/budgets" className="text-xs text-sky-400 font-bold hover:underline">
                Lihat Semua
              </Link>
            </div>
            
            {isLoading ? (
              <div className="flex flex-col gap-3.5">
                {[1, 2].map((idx) => (
                  <div key={idx} className="h-20 glass-panel rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : budgets.length > 0 ? (
              <div className="flex flex-col gap-3.5">
                {budgets.slice(0, 3).map((b) => (
                  <BudgetRing
                    key={b.id}
                    categoryName={b.category_name}
                    categoryIcon={b.category_icon}
                    categoryColor={b.category_color}
                    planned={b.amount}
                    actual={b.actual_spending}
                  />
                ))}
              </div>
            ) : (
              <div className="glass-panel p-10 rounded-2xl flex flex-col items-center justify-center text-center gap-3 border border-zinc-200 border-dashed">
                <span className="text-xs text-zinc-500 font-semibold">Belum ada anggaran terdaftar</span>
                <Link href="/budgets">
                  <Button variant="ghost" size="sm" className="text-xs text-primary">
                    Buat Anggaran
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Recent Ledger History */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-extrabold text-white tracking-tight">Transaksi Terakhir</h2>
              <Link href="/transactions" className="text-xs text-sky-400 font-bold hover:underline">
                Buka Ledger
              </Link>
            </div>

            {isLoading ? (
              <div className="flex flex-col gap-3.5">
                {[1, 2, 3].map((idx) => (
                  <div key={idx} className="h-16 glass-panel rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : recentTxns.length > 0 ? (
              <div className="flex flex-col gap-3.5">
                {recentTxns.map((txn) => {
                  const isExpense = txn.type === "expense" || txn.type === "transfer";
                  const isIncome = txn.type === "income";
                  
                  return (
                    <div
                      key={txn.id}
                      className="glass-panel p-4 rounded-2xl flex items-center justify-between border border-zinc-800 hover:border-sky-500/25 transition duration-200 gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`p-2.5 rounded-xl shrink-0 ${
                            isIncome
                              ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 glow-tag-cyan"
                              : isExpense
                              ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 glow-tag-indigo"
                              : "bg-sky-500/10 text-sky-400 border border-sky-500/20 glow-tag-sky"
                          }`}
                        >
                          {isIncome ? (
                            <ArrowUpRight className="h-4.5 w-4.5" />
                          ) : isExpense ? (
                            <ArrowDownRight className="h-4.5 w-4.5" />
                          ) : (
                            <ReceiptText className="h-4.5 w-4.5" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-slate-100 truncate">
                            {txn.note || (isIncome ? "Pemasukan" : isExpense ? "Pengeluaran" : "Penyesuaian")}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-semibold truncate">
                            {txn.merchant ? `${txn.merchant} • ` : ""}
                            {new Date(txn.date).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-sm font-extrabold tracking-tight shrink-0 whitespace-nowrap ${
                          isIncome ? "text-cyan-400" : isExpense ? "text-indigo-400" : "text-sky-400"
                        }`}
                      >
                        {isExpense ? "-" : isIncome ? "+" : txn.amount < 0 ? "-" : "+"}{formatIDR(Math.abs(txn.amount))}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="glass-panel p-12 rounded-2xl flex flex-col items-center justify-center text-center gap-3 border border-zinc-200 border-dashed">
                <ReceiptText className="h-8 w-8 text-zinc-400 stroke-[1.5]" />
                <div className="flex flex-col">
                  <span className="text-xs text-zinc-500 font-semibold">Belum ada transaksi terdaftar</span>
                  <span className="text-[10px] text-zinc-400 font-medium">Tekan 'Catat Transaksi' untuk memulai catatan perdana.</span>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Tambah Dompet Modal */}
      {isWalletModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-[28px] border border-zinc-800 shadow-2xl overflow-hidden flex flex-col">
            <div className="flex justify-between items-center px-6 py-5 border-b border-zinc-800">
              <h2 className="text-lg font-bold text-white">Tambah Dompet Baru</h2>
              <button
                onClick={() => setIsWalletModalOpen(false)}
                className="text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddWalletSubmit} className="p-6 flex flex-col gap-5">
              {walletError ? (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-semibold">
                  {walletError}
                </div>
              ) : null}

              <FormField
                label="Nama Dompet"
                type="text"
                placeholder="Contoh: Cash Dompet, Bank BCA, Gopay"
                value={walletName}
                onChange={(e) => setWalletName(e.target.value)}
                required
                id="walletName"
              />

              <CurrencyFormField
                label="Saldo Awal"
                placeholder="Contoh: 500000"
                value={walletBalance}
                onValueChange={setWalletBalance}
                required
                id="walletBalance"
              />

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-400">TIPE DOMPET</label>
                  <CustomSelect
                    value={walletType}
                    onChange={(val) => setWalletType(String(val))}
                    options={[
                      { label: "Tunai (Cash)", value: "cash" },
                      { label: "Rekening Bank", value: "bank" },
                      { label: "e-Wallet", value: "e-wallet" },
                      { label: "Kartu Kredit", value: "card" },
                      { label: "Tabungan", value: "savings" },
                    ]}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-400">WARNA AKSEN</label>
                  <div className="flex gap-2 items-center h-full">
                    <input
                      type="color"
                      value={walletColor}
                      onChange={(e) => setWalletColor(e.target.value)}
                      className="bg-transparent border-0 h-9 w-10 p-0 cursor-pointer block shrink-0"
                    />
                    <span className="text-xs font-extrabold text-white uppercase">{walletColor}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-zinc-800">
                <Button type="button" variant="ghost" onClick={() => setIsWalletModalOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" variant="primary" isLoading={isWalletSaving}>
                  Simpan Dompet
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Pay Confirmation Modal on Dashboard */}
      {isPayModalOpen && selectedRule ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-800">
              <h2 className="text-lg font-bold text-white">
                {selectedRule.type === "income" ? "Konfirmasi Pencairan Dana" : "Konfirmasi Pembayaran"}
              </h2>
              <button
                onClick={() => {
                  setIsPayModalOpen(false);
                  setSelectedRule(null);
                }}
                className="text-zinc-500 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleExecutePayment} className="p-6 flex flex-col gap-5">
              {payError ? (
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg text-xs font-semibold">
                  {payError}
                </div>
              ) : null}

              <div className={`p-4 border rounded-xl flex flex-col gap-1.5 ${
                selectedRule.type === "income" 
                  ? "bg-cyan-500/5 border-cyan-500/10" 
                  : "bg-sky-500/5 border-sky-500/10"
              }`}>
                <span className="text-xs text-zinc-400 font-semibold uppercase">Detail Jadwal</span>
                <span className="text-base font-extrabold text-white">{selectedRule.category_name}</span>
                <span className={`text-sm font-bold ${selectedRule.type === "income" ? "text-cyan-400" : "text-sky-400"}`}>
                  {formatIDR(selectedRule.amount)}
                </span>
                {selectedRule.note && <span className="text-xs text-zinc-500 italic mt-0.5">"{selectedRule.note}"</span>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase">
                  {selectedRule.type === "income" ? "Rekening Penerima Dana" : "Pilih Rekening Pembayar"}
                </label>
                <CustomSelect
                  value={payWalletId}
                  onChange={(val) => setPayWalletId(String(val))}
                  options={wallets.map((w) => ({ label: w.name, value: w.id }))}
                />
              </div>

              <FormField
                label="Tanggal Pencatatan"
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                required
                id="payDate"
              />

              <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-zinc-800">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => {
                    setIsPayModalOpen(false);
                    setSelectedRule(null);
                  }}
                >
                  Batal
                </Button>
                <Button type="submit" variant="primary" isLoading={isPaySaving}>
                  {selectedRule.type === "income" ? "Konfirmasi Terima Dana" : "Konfirmasi Lunas"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </MainLayout>
  );
}

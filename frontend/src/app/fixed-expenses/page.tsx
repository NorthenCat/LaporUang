"use client";

import React, { useState, useEffect } from "react";
import { MainLayout } from "@/components/templates/MainLayout";
import { FormField } from "@/components/molecules/FormField";
import { CurrencyFormField } from "@/components/molecules/CurrencyFormField";
import { CustomSelect } from "@/components/atoms/CustomSelect";
import { Button } from "@/components/atoms/Button";
import { apiRequest } from "@/utils/api";
import { 
  CalendarClock, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  Wallet as WalletIcon,
  CreditCard,
  TrendingDown,
  Clock,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  type: string;
}

interface Wallet {
  id: string;
  name: string;
  balance: number;
}

interface RecurringRule {
  id: string;
  wallet_id: string;
  category_id: string;
  amount: number;
  note?: string;
  type: string;
  frequency: string;
  start_date: string;
  end_date?: string;
  next_due_date?: string;
  last_generated_at?: string;
  wallet_name: string;
  category_name: string;
  category_icon: string;
}

export default function FixedExpensesPage() {
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Tab view: expense (Tagihan) or income (Pendapatan Rutin)
  const [activeTab, setActiveTab] = useState<"expense" | "income">("expense");

  // Form state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<RecurringRule | null>(null);

  // Create form fields
  const [ruleType, setRuleType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [walletId, setWalletId] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [startDate, setStartDate] = useState(new Date().toISOString().substring(0, 10));
  const [endDate, setEndDate] = useState("");

  // Pay form fields
  const [payWalletId, setPayWalletId] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().substring(0, 10));

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(val);
  };

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [rulesData, catsData, walletsData] = await Promise.all([
        apiRequest("/recurring-rules"),
        apiRequest("/categories"),
        apiRequest("/wallets"),
      ]);
      setRules(rulesData || []);
      setCategories(catsData || []);
      setWallets((walletsData || []).filter((w: any) => !w.is_archived));

      // Set default categories
      if (catsData && catsData.length > 0) {
        const expenseCats = catsData.filter((c: any) => c.type === "expense");
        if (expenseCats.length > 0 && ruleType === "expense") setCategoryId(expenseCats[0].id);
      }
      if (walletsData && walletsData.length > 0) {
        const activeWallets = walletsData.filter((w: any) => !w.is_archived);
        if (activeWallets.length > 0) setWalletId(activeWallets[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Update default category when ruleType switches in form
  useEffect(() => {
    const filtered = categories.filter((c) => c.type === ruleType);
    if (filtered.length > 0) {
      setCategoryId(filtered[0].id);
    }
  }, [ruleType, categories]);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg("");

    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg("Jumlah transaksi harus bernilai positif");
      setIsSaving(false);
      return;
    }

    try {
      const reqBody: any = {
        wallet_id: walletId,
        category_id: categoryId,
        amount: parsedAmount,
        type: ruleType,
        frequency,
        start_date: new Date(startDate).toISOString(),
      };

      if (note) reqBody.note = note;
      if (endDate) {
        // Set end date to the end of the selected day
        const endD = new Date(endDate);
        endD.setHours(23, 59, 59, 999);
        reqBody.end_date = endD.toISOString();
      }

      await apiRequest("/recurring-rules", "POST", reqBody);

      setIsSaving(false);
      setIsCreateModalOpen(false);
      setAmount("");
      setNote("");
      setEndDate("");
      fetchInitialData();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal membuat aturan rutin");
      setIsSaving(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm("Hapus aturan transaksi rutin ini?")) return;

    try {
      await apiRequest(`/recurring-rules/${id}`, "DELETE");
      fetchInitialData();
    } catch (err: any) {
      alert(err.message || "Gagal menghapus");
    }
  };

  const openPayModal = (rule: RecurringRule) => {
    setSelectedRule(rule);
    setPayWalletId(rule.wallet_id);
    setPayDate(new Date().toISOString().substring(0, 10));
    setIsPayModalOpen(true);
  };

  const handleExecutePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRule) return;

    setIsSaving(true);
    setErrorMsg("");

    try {
      await apiRequest(`/recurring-rules/${selectedRule.id}/execute`, "POST", {
        wallet_id: payWalletId,
        execution_date: new Date(payDate).toISOString(),
      });

      setIsSaving(false);
      setIsPayModalOpen(false);
      setSelectedRule(null);
      fetchInitialData();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal memproses transaksi");
      setIsSaving(false);
    }
  };

  const getFreqLabel = (freq: string) => {
    switch (freq) {
      case "weekly": return "Mingguan";
      case "biweekly": return "Dua Mingguan";
      case "monthly": return "Bulanan";
      case "yearly": return "Tahunan";
      default: return freq;
    }
  };

  const isAlreadyProcessed = (rule: RecurringRule) => {
    if (!rule.next_due_date) return false;
    const dueDate = new Date(rule.next_due_date);
    const now = new Date();

    // Reset hours to allow daily precision
    dueDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);

    if (rule.frequency === "monthly") {
      const dueYear = dueDate.getFullYear();
      const dueMonth = dueDate.getMonth();
      const nowYear = now.getFullYear();
      const nowMonth = now.getMonth();
      return (dueYear > nowYear) || (dueYear === nowYear && dueMonth > nowMonth);
    }
    if (rule.frequency === "yearly") {
      return dueDate.getFullYear() > now.getFullYear();
    }
    if (rule.frequency === "weekly" || rule.frequency === "biweekly") {
      return dueDate.getTime() > now.getTime();
    }
    return false;
  };

  const filteredRules = rules.filter((r) => r.type === activeTab);
  const formFilteredCategories = categories.filter((c) => c.type === ruleType);

  return (
    <MainLayout>
      <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Transaksi Rutin</h1>
            <p className="text-xs sm:text-sm text-zinc-500 font-medium">Kelola cicilan tetap, langganan bulanan, dan pemasukan berkala seperti gaji.</p>
          </div>
          <Button
            onClick={() => {
              setRuleType(activeTab);
              setIsCreateModalOpen(true);
            }}
            variant="primary"
            className="flex items-center gap-1.5 shrink-0"
          >
            <Plus className="h-4 w-4" /> Tambah Jadwal
          </Button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 p-1 bg-slate-950/60 border border-zinc-800/80 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("expense")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "expense"
                ? "bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Tagihan / Pengeluaran
          </button>
          <button
            onClick={() => setActiveTab("income")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "income"
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Pendapatan Rutin
          </button>
        </div>

        {/* Rules Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="h-44 glass-panel rounded-2xl animate-pulse" />
            <div className="h-44 glass-panel rounded-2xl animate-pulse" />
          </div>
        ) : filteredRules.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredRules.map((rule) => {
              const isOverdue = rule.next_due_date && new Date(rule.next_due_date) < new Date();
              const isIncome = rule.type === "income";

              return (
                <div
                  key={rule.id}
                  className="glass-panel p-5 rounded-2xl border border-zinc-800 flex flex-col justify-between gap-4 relative overflow-hidden"
                >
                  <div className={`absolute top-0 left-0 right-0 h-1 ${isIncome ? "bg-cyan-400" : "bg-sky-500"}`} />
                  
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl border ${
                        isIncome 
                          ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20 glow-tag-cyan" 
                          : "bg-sky-500/10 text-sky-400 border-sky-500/20 glow-tag-sky"
                      }`}>
                        {isIncome ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-white text-base">{rule.category_name}</span>
                        <span className="text-xs text-zinc-400 font-semibold">{rule.note || (isIncome ? "Pendapatan berkala" : "Tagihan rutin")}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-1.5 text-zinc-500 hover:text-indigo-400 bg-zinc-900 border border-zinc-850 hover:bg-indigo-500/5 rounded transition cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-1 mt-2">
                    <div className="flex justify-between text-xs font-semibold text-zinc-400">
                      <span>Jumlah Uang:</span>
                      <span className="text-white font-extrabold">{formatIDR(rule.amount)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold text-zinc-400">
                      <span>Frekuensi:</span>
                      <span className={`uppercase tracking-wider text-[10px] border px-2 py-0.5 rounded-full ${
                        isIncome
                          ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                          : "bg-sky-500/10 text-sky-400 border-sky-500/20"
                      }`}>
                        {getFreqLabel(rule.frequency)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold text-zinc-400">
                      <span>{isIncome ? "Dompet Penerima:" : "Dompet Pengirim:"}</span>
                      <span className="text-zinc-300 font-semibold">{rule.wallet_name}</span>
                    </div>
                    {rule.end_date && (
                      <div className="flex justify-between text-xs font-semibold text-zinc-400">
                        <span>Berlaku s.d:</span>
                        <span className="text-zinc-300 font-semibold">
                          {new Date(rule.end_date).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    )}
                    {rule.next_due_date && (
                      <div className="flex justify-between text-xs font-semibold text-zinc-400">
                        <span>Tanggal Cair:</span>
                        <span className={`font-bold ${isOverdue && !isIncome ? "text-indigo-400" : isOverdue && isIncome ? "text-cyan-400" : "text-zinc-300"}`}>
                          {new Date(rule.next_due_date).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                          {isOverdue && (isIncome ? " (Tersedia)" : " (Terlambat)")}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 w-full mt-2">
                    {isAlreadyProcessed(rule) ? (
                      <div className="w-full flex items-center justify-center gap-1.5 text-xs py-2 bg-slate-900 border border-zinc-800 text-zinc-500 rounded-xl font-bold uppercase select-none">
                        <Check className="h-4 w-4 text-emerald-500" />
                        {isIncome ? "Sudah Diterima" : "Sudah Lunas"}
                      </div>
                    ) : (
                      <Button
                        onClick={() => openPayModal(rule)}
                        variant="primary"
                        className="w-full flex items-center justify-center gap-1.5 text-xs py-2"
                      >
                        <Check className="h-4 w-4" /> {isIncome ? "Konfirmasi Terima Dana" : "Laksanakan Pembayaran"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="glass-panel p-16 rounded-2xl flex flex-col items-center justify-center text-center gap-3 border border-zinc-800 border-dashed">
            <CalendarClock className="h-10 w-10 text-zinc-600 stroke-[1.5]" />
            <div className="flex flex-col">
              <span className="text-xs text-zinc-500 font-semibold">Belum ada jadwal transaksi rutin</span>
              <span className="text-[10px] text-zinc-600">Tekan 'Tambah Jadwal' untuk menjadwalkan gaji rutin atau cicilan belanja Anda.</span>
            </div>
          </div>
        )}
      </div>

      {/* Create Rule Modal */}
      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-800">
              <h2 className="text-lg font-bold text-white">Tambah Aturan Rutin</h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-zinc-500 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="p-6 flex flex-col gap-5">
              {errorMsg ? (
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg text-xs font-semibold">
                  {errorMsg}
                </div>
              ) : null}

              {/* Type selector (Income or Expense) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase">Tipe Transaksi</label>
                <CustomSelect
                  value={ruleType}
                  onChange={(val) => setRuleType(String(val))}
                  options={[
                    { label: "Pengeluaran (Tagihan Rutin)", value: "expense" },
                    { label: "Pemasukan (Pendapatan Rutin)", value: "income" },
                  ]}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase">Kategori</label>
                <CustomSelect
                  value={categoryId}
                  onChange={(val) => setCategoryId(String(val))}
                  options={formFilteredCategories.map((c) => ({ label: c.name, value: c.id }))}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase">Dompet Sumber/Tujuan</label>
                <CustomSelect
                  value={walletId}
                  onChange={(val) => setWalletId(String(val))}
                  options={wallets.map((w) => ({ label: w.name, value: w.id }))}
                />
              </div>

              <CurrencyFormField
                label="Jumlah Uang (Rupiah)"
                placeholder="Contoh: 500000"
                value={amount}
                onValueChange={setAmount}
                required
                id="amount"
              />

              <FormField
                label="Deskripsi / Catatan"
                type="text"
                placeholder={ruleType === "income" ? "Gaji pokok bulanan, bonus, dll" : "Cicilan bulanan, Netflix, dll"}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                id="note"
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-400 uppercase">Siklus</label>
                  <CustomSelect
                    value={frequency}
                    onChange={(val) => setFrequency(String(val))}
                    options={[
                      { label: "Harian", value: "daily" },
                      { label: "Mingguan", value: "weekly" },
                      { label: "Bulanan", value: "monthly" },
                      { label: "Tahunan", value: "yearly" },
                    ]}
                  />
                </div>

                <FormField
                  label="Mulai Tanggal"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  id="startDate"
                />

                <FormField
                  label="Tanggal Berakhir (Opsional)"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  id="endDate"
                />
              </div>

              <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-zinc-800">
                <Button type="button" variant="ghost" onClick={() => setIsCreateModalOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" variant="primary" isLoading={isSaving}>
                  Tambah
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Pay Confirmation Modal */}
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
              {errorMsg ? (
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg text-xs font-semibold">
                  {errorMsg}
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
                  {formatIDR(selectedRule.amount)} ({getFreqLabel(selectedRule.frequency)})
                </span>
                {selectedRule.note && <span className="text-xs text-zinc-500 italic mt-0.5">"{selectedRule.note}"</span>}
              </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-400 uppercase">
                    {selectedRule.type === "income" ? "Terima ke Dompet" : "Bayar dari Dompet"}
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
                <Button type="submit" variant="primary" isLoading={isSaving}>
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

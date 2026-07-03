"use client";

import React, { useState, useEffect } from "react";
import { MainLayout } from "@/components/templates/MainLayout";
import { apiRequest } from "@/utils/api";
import { formatIDR } from "@/utils/money";
import { Button } from "@/components/atoms/Button";
import { FormField } from "@/components/molecules/FormField";
import { CurrencyFormField } from "@/components/molecules/CurrencyFormField";
import { CustomSelect } from "@/components/atoms/CustomSelect";
import { PieChart, Plus, Trash2, X, AlertTriangle } from "lucide-react";

interface Budget {
  id: string;
  category_id: string;
  amount: number;
  period_start: string;
  period_end: string;
  category_name: string;
  category_color: string;
  category_icon: string;
  actual_spending: number;
}

interface Category {
  id: string;
  name: string;
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [budgetPeriodType, setBudgetPeriodType] = useState<"monthly" | "custom">("monthly");

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [budgetData, catData] = await Promise.all([
        apiRequest("/budgets").catch(() => []),
        apiRequest("/categories").catch(() => []),
      ]);
      setBudgets(budgetData || []);
      setCategories(catData || []);
      
      if (catData && catData.length > 0) {
        setCategoryId(catData[0].id);
      }

      // Default periods (current month)
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .substring(0, 10);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString()
        .substring(0, 10);
      setPeriodStart(startOfMonth);
      setPeriodEnd(endOfMonth);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg("");

    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg("Limit anggaran harus bernilai positif");
      setIsSaving(false);
      return;
    }

    try {
      await apiRequest("/budgets", "POST", {
        category_id: categoryId,
        amount: parsedAmount,
        period_start: new Date(periodStart).toISOString(),
        period_end: new Date(periodEnd).toISOString(),
      });

      setIsSaving(false);
      setIsModalOpen(false);
      setAmount("");
      fetchInitialData();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal membuat anggaran");
      setIsSaving(false);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    if (!confirm("Hapus limit anggaran untuk kategori ini?")) return;

    try {
      await apiRequest(`/budgets/${id}`, "DELETE");
      fetchInitialData();
    } catch (err: any) {
      alert(err.message || "Gagal menghapus anggaran");
    }
  };

  const filteredBudgets = budgets.filter((b) => {
    const d = new Date(b.period_start);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  return (
    <MainLayout>
      <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Anggaran Kategori</h1>
            <p className="text-xs sm:text-sm text-zinc-500">Kendalikan pengeluaran bulanan Anda per kategori dengan limitasi visual.</p>
          </div>
          <Button
            onClick={() => setIsModalOpen(true)}
            variant="primary"
            className="flex items-center gap-1.5 shrink-0"
          >
            <Plus className="h-4 w-4" /> Buat Anggaran
          </Button>
        </div>

        {/* Filters */}
        <div className="glass-panel p-4 rounded-2xl flex gap-4 border border-zinc-800 shrink-0">
          <CustomSelect
            value={selectedMonth}
            onChange={(val) => setSelectedMonth(Number(val))}
            className="flex-1 sm:flex-none sm:w-40"
            options={[
              { label: "Januari", value: 0 },
              { label: "Februari", value: 1 },
              { label: "Maret", value: 2 },
              { label: "April", value: 3 },
              { label: "Mei", value: 4 },
              { label: "Juni", value: 5 },
              { label: "Juli", value: 6 },
              { label: "Agustus", value: 7 },
              { label: "September", value: 8 },
              { label: "Oktober", value: 9 },
              { label: "November", value: 10 },
              { label: "Desember", value: 11 },
            ]}
          />
          <CustomSelect
            value={selectedYear}
            onChange={(val) => setSelectedYear(Number(val))}
            className="flex-1 sm:flex-none sm:w-32"
            options={[...Array(5)].map((_, i) => {
              const year = new Date().getFullYear() - 2 + i;
              return { label: String(year), value: year };
            })}
          />
        </div>

        {/* Budgets List with Progress bars */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[1, 2].map((idx) => (
              <div key={idx} className="h-28 glass-panel rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredBudgets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredBudgets.map((b) => {
              const percent = b.amount > 0 ? Math.round((b.actual_spending / b.amount) * 100) : 0;
              const isOver = b.actual_spending > b.amount;
              const barWidth = Math.min(percent, 100) + "%";

              return (
                <div
                  key={b.id}
                  className="glass-panel p-5 rounded-2xl border border-zinc-800 flex flex-col gap-4 relative overflow-hidden"
                >
                  {isOver ? (
                    <div className="absolute top-0 right-0 left-0 h-1 bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                  ) : null}

                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <span className="font-semibold text-white text-base">{b.category_name}</span>
                      <span className="text-xs text-zinc-500">
                        {new Date(b.period_start).toLocaleDateString("id-ID", { month: "short" })}{" "}
                        -{" "}
                        {new Date(b.period_end).toLocaleDateString("id-ID", { month: "short", year: "numeric" })}
                      </span>
                    </div>

                    <button
                      onClick={() => handleDeleteBudget(b.id)}
                      className="p-1.5 text-zinc-500 hover:text-indigo-400 bg-zinc-900 border border-zinc-850 hover:bg-indigo-500/5 rounded transition cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex justify-between items-center text-xs mt-2">
                    <span className="font-bold text-zinc-400">
                      Aktual: {formatIDR(b.actual_spending)}
                    </span>
                    <span className="font-bold text-zinc-400">Limit: {formatIDR(b.amount)}</span>
                  </div>

                  {/* Horizontal Progress Bar */}
                  <div className="flex flex-col gap-1.5 w-full">
                    <div className="w-full h-2.5 bg-slate-950 border border-zinc-900 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isOver ? "bg-indigo-500" : percent >= 80 ? "bg-blue-500" : "bg-sky-400"
                        }`}
                        style={{ width: barWidth }}
                      />
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-zinc-500 font-semibold uppercase">
                        Persentase Pemakaian
                      </span>
                      <span
                        className={`text-xs font-extrabold ${
                          isOver ? "text-indigo-400" : percent >= 80 ? "text-blue-400" : "text-sky-400"
                        }`}
                      >
                        {percent}%
                      </span>
                    </div>
                  </div>

                  {/* Over limit alert banner inside card */}
                  {isOver ? (
                    <div className="flex items-center gap-2 p-2.5 bg-indigo-500/10 rounded-lg text-indigo-400 border border-indigo-500/20 glow-tag-indigo text-xs font-semibold mt-1">
                      <AlertTriangle className="h-4 w-4" /> Anggaran terlampaui sebesar{" "}
                      {formatIDR(b.actual_spending - b.amount)}!
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="glass-panel p-16 rounded-2xl flex flex-col items-center justify-center text-center gap-3 border border-zinc-800 border-dashed">
            <PieChart className="h-10 w-10 text-zinc-600 stroke-[1.5]" />
            <div className="flex flex-col">
              <span className="text-xs text-zinc-500 font-semibold">Belum ada anggaran bulanan dibuat</span>
              <span className="text-[10px] text-zinc-600">Tekan 'Buat Anggaran' untuk membatasi pengeluaran per kategori.</span>
            </div>
          </div>
        )}
      </div>

      {/* Create Budget Modal */}
      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-800">
              <h2 className="text-lg font-bold text-white">Buat Anggaran Baru</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-500 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBudget} className="p-6 flex flex-col gap-5">
              {errorMsg ? (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-semibold">
                  {errorMsg}
                </div>
              ) : null}

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Kategori
                </label>
                <CustomSelect
                  value={categoryId}
                  onChange={(val) => setCategoryId(String(val))}
                  options={categories.map((c) => ({ label: c.name, value: c.id }))}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Tipe Periode
                </label>
                <CustomSelect
                  value={budgetPeriodType}
                  onChange={(val) => {
                    const type = val as "monthly" | "custom";
                    setBudgetPeriodType(type);
                    if (type === "monthly") {
                      const now = new Date();
                      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
                        .toISOString()
                        .substring(0, 10);
                      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
                        .toISOString()
                        .substring(0, 10);
                      setPeriodStart(startOfMonth);
                      setPeriodEnd(endOfMonth);
                    }
                  }}
                  options={[
                    { label: "Bulanan (Otomatis Bulan Berjalan)", value: "monthly" },
                    { label: "Rentang Waktu (Kustom Tanggal)", value: "custom" },
                  ]}
                />
              </div>

              <CurrencyFormField
                label="Limit Anggaran"
                placeholder="Contoh: 1500000"
                value={amount}
                onValueChange={setAmount}
                required
                id="amount"
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Mulai Periode"
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  required
                  id="periodStart"
                  disabled={budgetPeriodType === "monthly"}
                  className={budgetPeriodType === "monthly" ? "opacity-50 cursor-not-allowed" : ""}
                />

                <FormField
                  label="Berakhir Periode"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  required
                  id="periodEnd"
                  disabled={budgetPeriodType === "monthly"}
                  className={budgetPeriodType === "monthly" ? "opacity-50 cursor-not-allowed" : ""}
                />
              </div>

              <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-zinc-800">
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" variant="primary" isLoading={isSaving}>
                  Buat Limit
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </MainLayout>
  );
}

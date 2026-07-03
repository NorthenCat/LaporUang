"use client";

import React, { useState, useEffect } from "react";
import { MainLayout } from "@/components/templates/MainLayout";
import { Button } from "@/components/atoms/Button";
import { FormField } from "@/components/molecules/FormField";
import { CurrencyFormField } from "@/components/molecules/CurrencyFormField";
import { CustomSelect } from "@/components/atoms/CustomSelect";
import { apiRequest } from "@/utils/api";
import { formatIDR } from "@/utils/money";
import { ArrowLeft, Calendar, Save, Trash2, ArrowUpRight, ArrowDownRight, LayoutDashboard } from "lucide-react";
import Link from "next/link";

interface RecurringRule {
  id: string;
  category_name: string;
  amount: number;
  type: string;
  frequency: string;
}

interface Adjustment {
  id: string;
  date: string;
  amount: number;
  type: string;
  note?: string;
}

export default function SimulatePage() {
  const [routines, setRoutines] = useState<RecurringRule[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [adjDate, setAdjDate] = useState(new Date().toISOString().substring(0, 10));
  const [adjAmount, setAdjAmount] = useState("");
  const [adjType, setAdjType] = useState("subtract"); // subtract (expense), add (income)
  const [adjNote, setAdjNote] = useState("");
  
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [rulesData, adjsData] = await Promise.all([
        apiRequest("/recurring_rules"),
        apiRequest("/projections/adjustments"),
      ]);
      setRoutines(rulesData || []);
      setAdjustments(adjsData || []);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg("");

    const parsedAmount = parseInt(adjAmount, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg("Jumlah harus berupa angka positif");
      setIsSaving(false);
      return;
    }

    try {
      await apiRequest("/projections/adjustments", "POST", {
        date: new Date(adjDate).toISOString(),
        amount: parsedAmount,
        type: adjType,
        note: adjNote ? adjNote : undefined,
      });

      setIsSaving(false);
      setAdjAmount("");
      setAdjNote("");
      fetchInitialData();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal membuat penyesuaian");
      setIsSaving(false);
    }
  };

  const handleDeleteAdjustment = async (id: string) => {
    if (!confirm("Hapus simulasi penyesuaian cash flow ini?")) return;

    try {
      await apiRequest(`/projections/adjustments/${id}`, "DELETE");
      fetchInitialData();
    } catch (err: any) {
      alert(err.message || "Gagal menghapus penyesuaian");
    }
  };

  // Calculate routine summaries
  const monthlyIncome = routines
    .filter(r => r.type === "income")
    .reduce((sum, r) => {
      if (r.frequency === "monthly") return sum + r.amount;
      if (r.frequency === "weekly") return sum + (r.amount * 4);
      if (r.frequency === "daily") return sum + (r.amount * 30);
      if (r.frequency === "yearly") return sum + (r.amount / 12);
      return sum;
    }, 0);

  const monthlyExpense = routines
    .filter(r => r.type === "expense" || r.type === "transfer")
    .reduce((sum, r) => {
      if (r.frequency === "monthly") return sum + r.amount;
      if (r.frequency === "weekly") return sum + (r.amount * 4);
      if (r.frequency === "daily") return sum + (r.amount * 30);
      if (r.frequency === "yearly") return sum + (r.amount / 12);
      return sum;
    }, 0);

  const netMonthly = monthlyIncome - monthlyExpense;

  return (
    <MainLayout>
      <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
          <div className="flex flex-col gap-1">
            <Link href="/projections" className="flex items-center gap-1.5 text-xs font-bold text-sky-400 hover:text-sky-300 transition-colors mb-2 w-fit">
              <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Proyeksi
            </Link>
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Simulasi Penyesuaian</h1>
            <p className="text-xs sm:text-sm text-zinc-500">Rencanakan kas masa depan dan hitung sisa kas rutin bulanan Anda.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Routine Context */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5 text-sky-400" /> Kas Rutin Bulanan
            </h2>
            
            <div className="glass-panel p-5 rounded-2xl border border-zinc-800/50 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Total Pemasukan Rutin</span>
                <span className="text-xl font-bold text-emerald-400">+{formatIDR(monthlyIncome)}</span>
              </div>
              
              <div className="w-full h-px bg-zinc-800/50" />

              <div className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Total Pengeluaran Rutin</span>
                <span className="text-xl font-bold text-rose-400">-{formatIDR(monthlyExpense)}</span>
              </div>

              <div className="w-full h-px bg-zinc-800/50" />
              
              <div className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Sisa Kas Bulanan (Net)</span>
                <span className={`text-2xl font-black tracking-tight ${netMonthly >= 0 ? "text-sky-400" : "text-rose-500"}`}>
                  {netMonthly >= 0 ? "+" : "-"}{formatIDR(Math.abs(netMonthly))}
                </span>
              </div>
            </div>

            <div className="text-xs text-zinc-500 bg-sky-950/20 border border-sky-900/30 p-4 rounded-xl leading-relaxed">
              <span className="font-bold text-sky-400 block mb-1">💡 Tips Simulasi:</span>
              Angka di atas adalah sisa kas ideal Anda per bulan berdasarkan daftar Transaksi Rutin. Gunakan fitur penyesuaian di kanan untuk memasukkan rencana tambahan di luar rutinitas (misal: servis mobil, liburan) dan lihat efeknya di grafik Proyeksi Kas!
            </div>
          </div>

          {/* Right Column: Adjustments Form and List */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            
            {/* Form */}
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-bold text-white tracking-tight">Tambah Rencana Kas</h2>
              
              <form onSubmit={handleCreateAdjustment} className="glass-panel p-5 sm:p-6 rounded-2xl border border-zinc-800/50 flex flex-col gap-4">
                {errorMsg ? (
                  <div className="p-3 rounded-lg bg-red-950/50 border border-red-900 text-red-200 text-xs text-center font-medium">
                    {errorMsg}
                  </div>
                ) : null}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-zinc-400 ml-1">Jenis Penyesuaian</label>
                    <CustomSelect
                      value={adjType}
                      onChange={(val) => setAdjType(String(val))}
                      className="w-full"
                      options={[
                        { label: "Kas Keluar (-)", value: "subtract" },
                        { label: "Kas Masuk (+)", value: "add" },
                      ]}
                    />
                  </div>
                  <FormField
                    label="Tanggal Eksekusi"
                    type="date"
                    value={adjDate}
                    onChange={(e) => setAdjDate(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <CurrencyFormField
                    label="Nominal"
                    value={adjAmount}
                    onValueChange={setAdjAmount}
                    placeholder="Contoh: 250000"
                    required
                  />
                  <FormField
                    label="Catatan / Skenario (Opsional)"
                    value={adjNote}
                    onChange={(e) => setAdjNote(e.target.value)}
                    placeholder="Contoh: Servis Mobil Tahunan"
                  />
                </div>

                <Button type="submit" variant="primary" disabled={isSaving} className="mt-2 w-full sm:w-auto self-end font-bold text-sm tracking-wide py-2.5 px-6 rounded-full">
                  {isSaving ? "Menyimpan..." : (
                    <>
                      <Save className="h-4 w-4 mr-1.5" /> Tambah Rencana
                    </>
                  )}
                </Button>
              </form>
            </div>

            {/* List */}
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-bold text-white tracking-tight">Daftar Rencana Penyesuaian</h2>
              
              {isLoading ? (
                <div className="flex flex-col gap-3">
                  {[1, 2].map((idx) => (
                    <div key={idx} className="h-16 glass-panel rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : adjustments.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {adjustments.map((a) => (
                    <div
                      key={a.id}
                      className="glass-panel p-4 rounded-xl flex items-center justify-between border border-zinc-800 hover:border-sky-500/25 transition group"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2.5 rounded-full flex items-center justify-center shrink-0 ${
                          a.type === "subtract" ? "bg-rose-500/10 text-rose-400" : a.type === "add" ? "bg-emerald-500/10 text-emerald-400" : "bg-sky-500/10 text-sky-400"
                        }`}>
                          {a.type === "subtract" ? <ArrowDownRight className="h-4 w-4" /> : a.type === "add" ? <ArrowUpRight className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-200">
                            {a.note || `Simulasi ${a.type === "add" ? "Kas Masuk" : "Kas Keluar"}`}
                          </span>
                          <span className="text-xs text-zinc-500">
                            Tanggal: {new Date(a.date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className={`font-bold text-sm tracking-wide ${
                          a.type === "subtract" ? "text-rose-400" : a.type === "add" ? "text-emerald-400" : "text-sky-400"
                        }`}>
                          {a.type === "subtract" ? "-" : a.type === "add" ? "+" : "Target: "}
                          {formatIDR(a.amount)}
                        </span>
                        
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleDeleteAdjustment(a.id)}
                            className="p-1.5 rounded-md hover:bg-slate-800 text-zinc-400 hover:text-rose-400 transition-colors"
                            title="Hapus Rencana"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="glass-panel p-10 rounded-2xl flex flex-col items-center justify-center text-center gap-2 border border-zinc-800 border-dashed">
                  <span className="text-xs text-zinc-500 font-bold">Tidak ada penyesuaian aktif</span>
                  <span className="text-[11px] text-zinc-600 max-w-[280px]">
                    Tambahkan skenario pengeluaran/pemasukan di form atas untuk melihat dampaknya di Proyeksi Kas.
                  </span>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </MainLayout>
  );
}

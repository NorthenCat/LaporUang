"use client";

import React, { useState, useEffect } from "react";
import { MainLayout } from "@/components/templates/MainLayout";
import { ProjectionChart } from "@/components/organisms/ProjectionChart";
import { Button } from "@/components/atoms/Button";
import { FormField } from "@/components/molecules/FormField";
import { CurrencyFormField } from "@/components/molecules/CurrencyFormField";
import { apiRequest } from "@/utils/api";
import { formatIDR } from "@/utils/money";
import { Calendar, Plus, Trash2, X, TrendingUp, AlertCircle } from "lucide-react";

interface Adjustment {
  id: string;
  date: string;
  amount: number;
  type: string;
  note?: string;
}

export default function ProjectionsPage() {
  const [projectionData, setProjectionData] = useState<any>(null);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [adjDate, setAdjDate] = useState(new Date().toISOString().substring(0, 10));
  const [adjAmount, setAdjAmount] = useState("");
  const [adjType, setAdjType] = useState("add"); // add, subtract, set
  const [adjNote, setAdjNote] = useState("");
  
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [proj, adjs] = await Promise.all([
        apiRequest("/projections"),
        apiRequest("/projections/adjustments"),
      ]);
      setProjectionData(proj);
      setAdjustments(adjs || []);
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
      setIsModalOpen(false);
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

  return (
    <MainLayout>
      <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Proyeksi Cash Flow</h1>
            <p className="text-xs sm:text-sm text-zinc-500">Simulasikan saldo harian masa depan untuk mendeteksi potensi saldo minus.</p>
          </div>
          <Button
            onClick={() => setIsModalOpen(true)}
            variant="primary"
            className="flex items-center gap-1.5 shrink-0"
          >
            <Plus className="h-4 w-4" /> Simulasikan Penyesuaian
          </Button>
        </div>

        {/* Projection Chart Component */}
        {isLoading ? (
          <div className="h-80 w-full flex items-center justify-center glass-panel rounded-xl">
            <span className="text-sm text-zinc-500 animate-pulse">Menghitung proyeksi harian...</span>
          </div>
        ) : projectionData ? (
          <ProjectionChart
            data={projectionData.points}
            minBalance={projectionData.min_balance}
            minBalanceDate={projectionData.min_balance_date}
            potentialDeficitDate={projectionData.potential_deficit_date}
          />
        ) : (
          <div className="glass-panel p-16 rounded-2xl flex flex-col items-center justify-center text-center gap-3 border border-zinc-800 border-dashed">
            <TrendingUp className="h-10 w-10 text-zinc-600 stroke-[1.5]" />
            <span className="text-xs text-zinc-500 font-semibold">Gagal memuat proyeksi cash flow</span>
          </div>
        )}

        {/* Adjustments simulation ledger */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-white tracking-tight">Simulasi Penyesuaian Kas</h2>
          
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
                  className="glass-panel p-4 rounded-xl flex items-center justify-between border border-zinc-800 hover:border-sky-500/25 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-slate-900 text-sky-400 border border-zinc-800/80 shadow-[0_0_10px_rgba(56,189,248,0.1)]">
                      <Calendar className="h-4.5 w-4.5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-white">
                        {a.note || `Simulasi ${a.type === "set" ? "Saldo Target" : a.type === "add" ? "Kas Masuk" : "Kas Keluar"}`}
                      </span>
                      <span className="text-xs text-zinc-500">
                        Tanggal: {new Date(a.date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} • Tipe: {a.type}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-sm font-extrabold text-white">
                      {a.type === "subtract" ? "-" : a.type === "add" ? "+" : "Target: "}
                      {formatIDR(a.amount)}
                    </span>
                    <button
                      onClick={() => handleDeleteAdjustment(a.id)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 bg-zinc-900 hover:bg-red-500/5 rounded border border-zinc-850 transition cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-panel p-10 rounded-2xl flex flex-col items-center justify-center text-center gap-2 border border-zinc-800 border-dashed">
              <AlertCircle className="h-6 w-6 text-zinc-650" />
              <span className="text-xs text-zinc-500 font-semibold">Tidak ada penyesuaian simulasi aktif</span>
              <span className="text-[10px] text-zinc-600 max-w-[280px]">
                Tekan tombol di atas untuk menyisipkan kas bayangan guna mensimulasikan kenaikan gaji, pembelian aset, atau pelunasan hutang.
              </span>
            </div>
          )}
        </div>

      </div>

      {/* Adjustment Modal Overlay */}
      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-800">
              <h2 className="text-lg font-bold text-white">Buat Simulasi Penyesuaian</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-500 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAdjustment} className="p-6 flex flex-col gap-5">
              {errorMsg ? (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-semibold">
                  {errorMsg}
                </div>
              ) : null}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase">Tipe Penyesuaian</label>
                <select
                  value={adjType}
                  onChange={(e) => setAdjType(e.target.value)}
                  className="w-full bg-slate-900 border border-zinc-800 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500 focus:bg-slate-950"
                >
                  <option value="add">Tambah Kas (Simulasi Pemasukan)</option>
                  <option value="subtract">Kurangi Kas (Simulasi Pengeluaran)</option>
                  <option value="set">Atur Ulang Kas (Saldo Target Baru)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <CurrencyFormField
                  label="Jumlah (Rupiah)"
                  placeholder="Contoh: 1000000"
                  value={adjAmount}
                  onValueChange={setAdjAmount}
                  required
                  id="adjAmount"
                />

                <FormField
                  label="Tanggal Kejadian"
                  type="date"
                  value={adjDate}
                  onChange={(e) => setAdjDate(e.target.value)}
                  required
                  id="adjDate"
                />
              </div>

              <FormField
                label="Catatan Simulasi"
                type="text"
                placeholder="Contoh: Bonus Tahunan, Rencana Beli Laptop"
                value={adjNote}
                onChange={(e) => setAdjNote(e.target.value)}
                id="adjNote"
              />

              <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-zinc-800">
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" variant="primary" isLoading={isSaving}>
                  Terapkan Simulasi
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </MainLayout>
  );
}

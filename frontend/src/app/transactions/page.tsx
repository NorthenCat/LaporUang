"use client";

import React, { useState, useEffect } from "react";
import { MainLayout } from "@/components/templates/MainLayout";
import { apiRequest, uploadReceiptRequest } from "@/utils/api";
import { formatIDR } from "@/utils/money";
import { Button } from "@/components/atoms/Button";
import { TransactionModal } from "@/components/organisms/TransactionModal";
import { CustomSelect } from "@/components/atoms/CustomSelect";
import { FormField } from "@/components/molecules/FormField";
import {
  Search,
  Filter,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRightLeft,
  Settings2,
  Trash2,
  Paperclip,
  Camera,
  X,
  FileImage,
} from "lucide-react";

interface Transaction {
  id: string;
  wallet_id: string;
  category_id: string;
  type: string;
  amount: number;
  date: string;
  note?: string;
  merchant?: string;
  transfer_group_id?: string;
}

interface Wallet {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter states
  const now = new Date();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedWallet, setSelectedWallet] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  // Receipt modal state
  const [activeReceiptTxId, setActiveReceiptTxId] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [txnData, walletData, catData] = await Promise.all([
        apiRequest("/transactions"),
        apiRequest("/wallets"),
        apiRequest("/categories"),
      ]);
      setTransactions(txnData || []);
      setWallets(walletData || []);
      setCategories(catData || []);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus transaksi ini? Saldo dompet akan disesuaikan otomatis.")) {
      return;
    }

    try {
      await apiRequest(`/transactions/${id}`, "DELETE");
      // Refresh list
      fetchInitialData();
    } catch (err: any) {
      alert(err.message || "Gagal menghapus transaksi");
    }
  };

  // Receipt handlers
  const handleOpenReceiptModal = async (txnId: string) => {
    setActiveReceiptTxId(txnId);
    setReceiptFile(null);
    setAttachmentUrl(null);
    
    try {
      const att = await apiRequest(`/transactions/${txnId}/attachment`);
      if (att && att.file_path) {
        setAttachmentUrl(`http://localhost:8282${att.file_path}`);
      }
    } catch {
      // no attachment found or error, ignore
    }
  };

  const handleReceiptUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptFile || !activeReceiptTxId) return;

    setUploadingReceipt(true);
    try {
      const res = await uploadReceiptRequest(receiptFile, activeReceiptTxId);
      if (res && res.file_path) {
        setAttachmentUrl(`http://localhost:8282${res.file_path}`);
        alert("Lampiran kuitansi berhasil diunggah!");
      }
    } catch (err: any) {
      alert(err.message || "Gagal mengunggah kuitansi");
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleDeleteReceipt = async () => {
    if (!activeReceiptTxId) return;
    if (!confirm("Apakah Anda yakin ingin menghapus kuitansi ini?")) return;

    try {
      await apiRequest(`/transactions/${activeReceiptTxId}/attachment`, "DELETE");
      setAttachmentUrl(null);
      setReceiptFile(null);
      alert("Kuitansi berhasil dihapus.");
    } catch (err: any) {
      alert(err.message || "Gagal menghapus kuitansi");
    }
  };

  // Filter & Search Logic
  const filteredTxns = transactions.filter((t) => {
    const searchLower = search.toLowerCase();
    const matchesSearch = (t.note?.toLowerCase() || "").includes(searchLower) || 
                          (t.merchant?.toLowerCase() || "").includes(searchLower);
    
    const matchesType = filterType === "all" || t.type === filterType;
    const matchesWallet = selectedWallet === "all" || t.wallet_id === selectedWallet;

    const d = new Date(t.date);
    const matchesMonth = d.getMonth() === selectedMonth;
    const matchesYear = d.getFullYear() === selectedYear;

    return (search === "" || matchesSearch) && matchesType && matchesWallet && matchesMonth && matchesYear;
  });

  // Group by Date helper
  const groupedTxns: { [date: string]: Transaction[] } = {};
  filteredTxns.forEach((t) => {
    const formattedDate = new Date(t.date).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    if (!groupedTxns[formattedDate]) {
      groupedTxns[formattedDate] = [];
    }
    groupedTxns[formattedDate].push(t);
  });

  return (
    <MainLayout>
      <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Ledger Transaksi</h1>
            <p className="text-xs sm:text-sm text-zinc-500">Daftar menyeluruh transaksi kas masuk dan keluar akun Anda.</p>
          </div>
        </div>

        {/* Filter controls */}
        <div className="glass-panel p-5 rounded-2xl flex flex-col sm:flex-row gap-4 border border-zinc-800">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Cari deskripsi catatan atau toko..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950/40 border border-zinc-800 text-slate-100 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-sky-500 placeholder:text-zinc-500 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
            />
          </div>

          <div className="flex gap-3">
            {/* Filter Wallet */}
            <CustomSelect
              value={selectedWallet}
              onChange={(val) => setSelectedWallet(String(val))}
              className="w-40"
              options={[
                { label: "Semua Dompet", value: "all" },
                ...wallets.map((w) => ({ label: w.name, value: w.id }))
              ]}
            />

            {/* Filter Type */}
            <CustomSelect
              value={filterType}
              onChange={(val) => setFilterType(String(val))}
              className="w-36"
              options={[
                { label: "Semua Tipe", value: "all" },
                { label: "Pemasukan", value: "income" },
                { label: "Pengeluaran", value: "expense" },
                { label: "Transfer", value: "transfer" },
                { label: "Penyesuaian", value: "adjustment" },
              ]}
            />
          </div>
        </div>

        {/* Action and Time Filter */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <Button
            onClick={() => setIsTxModalOpen(true)}
            variant="primary"
            className="flex items-center justify-center gap-1.5 shrink-0 w-full sm:w-auto px-6 py-3 rounded-full font-bold text-xs uppercase tracking-wider shadow-lg shadow-sky-500/20"
          >
            <Plus className="h-4 w-4" /> Catat Transaksi
          </Button>
          
          <div className="flex gap-3 w-full sm:w-auto">
            <CustomSelect
              value={selectedMonth}
              onChange={(val) => setSelectedMonth(Number(val))}
              className="w-full sm:w-36"
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
              className="w-full sm:w-32"
              options={Array.from({ length: 5 }).map((_, i) => {
                const year = new Date().getFullYear() - 2 + i;
                return { label: String(year), value: year };
              })}
            />
          </div>
        </div>

        {/* List of Transactions */}
        {isLoading ? (
          <div className="flex flex-col gap-6">
            {[1, 2].map((idx) => (
              <div key={idx} className="flex flex-col gap-3">
                <div className="h-4 w-32 bg-zinc-900 rounded animate-pulse" />
                <div className="h-16 glass-panel rounded-xl animate-pulse" />
                <div className="h-16 glass-panel rounded-xl animate-pulse" />
              </div>
            ))}
          </div>
        ) : Object.keys(groupedTxns).length > 0 ? (
          <div className="flex flex-col gap-8">
            {Object.keys(groupedTxns).map((dateStr) => (
              <div key={dateStr} className="flex flex-col gap-3.5">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{dateStr}</h3>
                
                <div className="flex flex-col gap-3">
                  {groupedTxns[dateStr].map((txn) => {
                    const isExpense = txn.type === "expense" || txn.type === "transfer";
                    const isIncome = txn.type === "income";
                    const walletName = wallets.find((w) => w.id === txn.wallet_id)?.name || "Dompet";
                    const categoryName = categories.find((c) => c.id === txn.category_id)?.name || "Kategori";

                    return (
                      <div
                        key={txn.id}
                        className="relative glass-panel p-4 rounded-xl flex items-center justify-between border border-zinc-800/50 hover:border-zinc-700 transition-colors group gap-4 overflow-hidden"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`p-2.5 rounded-full flex items-center justify-center shrink-0 ${
                            isExpense ? "bg-rose-500/10 text-rose-400" : isIncome ? "bg-emerald-500/10 text-emerald-400" : "bg-sky-500/10 text-sky-400"
                          }`}>
                            {isExpense ? <ArrowDownRight className="h-4 w-4" /> : isIncome ? <ArrowUpRight className="h-4 w-4" /> : <ArrowRightLeft className="h-4 w-4" />}
                          </div>
                          
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-bold text-slate-200 truncate">
                              {txn.note || "Transaksi"}
                            </span>
                            <span className="text-xs text-zinc-500 truncate">
                              {walletName} • {categoryName}
                              {txn.merchant && ` • ${txn.merchant}`}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`font-bold text-sm tracking-wide whitespace-nowrap ${
                            isExpense ? "text-rose-400" : isIncome ? "text-emerald-400" : "text-sky-400"
                          }`}>
                            {isExpense ? "-" : isIncome ? "+" : txn.amount < 0 ? "-" : "+"}{formatIDR(Math.abs(txn.amount))}
                          </span>
                          
                          {/* Actions */}
                          <div className="absolute right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/90 backdrop-blur-md p-1.5 rounded-lg border border-zinc-700/50 shadow-lg">
                            <button
                              onClick={() => handleOpenReceiptModal(txn.id)}
                              className="p-1.5 rounded-md hover:bg-slate-800 text-zinc-400 hover:text-sky-400 transition-colors"
                              title="Lampiran Kuitansi"
                            >
                              <Paperclip className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(txn.id)}
                              className="p-1.5 rounded-md hover:bg-slate-800 text-zinc-400 hover:text-rose-400 transition-colors"
                              title="Hapus Transaksi"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-panel p-16 rounded-2xl flex flex-col items-center justify-center text-center gap-3 border border-zinc-800 border-dashed">
            <Search className="h-10 w-10 text-zinc-600 stroke-[1.5]" />
            <div className="flex flex-col gap-1">
              <span className="text-sm text-zinc-300 font-bold">Tidak ada transaksi</span>
              <span className="text-xs text-zinc-500">
                Data transaksi tidak ditemukan pada bulan dan tahun ini.<br />
                Cobalah memilih bulan lain di filter atas.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Receipt Modal Overlay */}
      {activeReceiptTxId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Camera className="h-5 w-5 text-primary" /> Kuitansi & Lampiran
              </h2>
              <button
                onClick={() => setActiveReceiptTxId(null)}
                className="text-zinc-500 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-6">
              {attachmentUrl ? (
                <div className="flex flex-col gap-3 items-center">
                  <div className="relative w-full aspect-video rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center">
                    <img
                      src={attachmentUrl}
                      alt="Receipt Attachment"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="flex gap-4 items-center">
                    <a
                      href={attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-sky-400 hover:underline"
                    >
                      Buka Gambar
                    </a>
                    <button
                      type="button"
                      onClick={handleDeleteReceipt}
                      className="text-xs font-bold text-rose-400 hover:underline"
                    >
                      Hapus Gambar
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleReceiptUpload} className="flex flex-col gap-5">
                  <div className="flex flex-col items-center justify-center border border-dashed border-zinc-800 hover:border-sky-500/40 bg-slate-900/25 rounded-xl p-8 cursor-pointer relative group transition-all">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      required
                    />
                    <FileImage className="h-10 w-10 text-zinc-500 group-hover:text-sky-400 transition" />
                    <span className="text-xs font-bold text-zinc-400 mt-3">
                      {receiptFile ? receiptFile.name : "Klik / Seret Gambar Kuitansi"}
                    </span>
                    <span className="text-[10px] text-zinc-500 mt-1">Ukuran file maksimal 10MB</span>
                  </div>

                  {receiptFile ? (
                    <Button type="submit" variant="primary" isLoading={uploadingReceipt} className="w-full">
                      Unggah Lampiran
                    </Button>
                  ) : null}
                </form>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        onSuccess={() => {
          setIsTxModalOpen(false);
          fetchInitialData();
        }}
      />
    </MainLayout>
  );
}

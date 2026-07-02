"use client";

import React, { useState, useEffect } from "react";
import { MainLayout } from "@/components/templates/MainLayout";
import { apiRequest, uploadReceiptRequest } from "@/utils/api";
import { formatIDR } from "@/utils/money";
import { Button } from "@/components/atoms/Button";
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
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedWallet, setSelectedWallet] = useState<string>("all");

  // Receipt modal state
  const [activeReceiptTxId, setActiveReceiptTxId] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);

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
    
    // Look if attachment already exists in database (fetch transactions details if needed, or simply seek path)
    // For this simple implementation, we can query attachments or let users upload.
    // Let's check:
    try {
      // Look up if this transaction has an attachment (mock search, or check if we can query attachments endpoint).
      // We will check if the user settings has standard upload locations.
    } catch {
      // ignore
    }
  };

  const handleReceiptUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptFile || !activeReceiptTxId) return;

    setUploadingReceipt(true);
    try {
      const res = await uploadReceiptRequest(receiptFile, activeReceiptTxId);
      if (res && res.file_path) {
        setAttachmentUrl(`http://localhost:8080${res.file_path}`);
        alert("Lampiran kuitansi berhasil diunggah!");
      }
    } catch (err: any) {
      alert(err.message || "Gagal mengunggah kuitansi");
    } finally {
      setUploadingReceipt(false);
    }
  };

  // Filter & Search Logic
  const filteredTxns = transactions.filter((t) => {
    const matchesSearch = t.note?.toLowerCase().includes(search.toLowerCase()) || 
                          t.merchant?.toLowerCase().includes(search.toLowerCase()) ||
                          false;
    
    const matchesType = filterType === "all" || t.type === filterType;
    const matchesWallet = selectedWallet === "all" || t.wallet_id === selectedWallet;

    return (search === "" || matchesSearch) && matchesType && matchesWallet;
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
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Ledger Transaksi</h1>
          <p className="text-xs sm:text-sm text-zinc-500">Daftar menyeluruh transaksi kas masuk dan keluar akun Anda.</p>
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
            <select
              value={selectedWallet}
              onChange={(e) => setSelectedWallet(e.target.value)}
              className="bg-slate-900 border border-zinc-800 text-slate-100 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-sky-500 focus:bg-slate-950"
            >
              <option value="all">Semua Dompet</option>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>

            {/* Filter Type */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-slate-900 border border-zinc-800 text-slate-100 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-sky-500 focus:bg-slate-950"
            >
              <option value="all">Semua Tipe</option>
              <option value="income">Pemasukan</option>
              <option value="expense">Pengeluaran</option>
              <option value="transfer">Transfer</option>
              <option value="adjustment">Penyesuaian</option>
            </select>
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
                        className="glass-panel p-4 rounded-xl flex items-center justify-between border border-zinc-800 hover:border-zinc-700 transition gap-4"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`p-2.5 rounded-lg shrink-0 ${
                              isIncome
                                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 glow-tag-cyan"
                                : isExpense
                                ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 glow-tag-indigo"
                                : "bg-sky-500/10 text-sky-400 border border-sky-500/20 glow-tag-sky"
                            }`}
                          >
                            {isIncome ? (
                              <ArrowUpRight className="h-4.5 w-4.5" />
                            ) : txn.type === "transfer" ? (
                              <ArrowRightLeft className="h-4.5 w-4.5" />
                            ) : isExpense ? (
                              <ArrowDownRight className="h-4.5 w-4.5" />
                            ) : (
                              <Settings2 className="h-4.5 w-4.5" />
                            )}
                          </div>

                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-semibold text-white truncate">
                              {txn.note || (isIncome ? "Pemasukan" : isExpense ? "Pengeluaran" : "Penyesuaian")}
                            </span>
                            <span className="text-xs text-zinc-500 truncate">
                              {txn.merchant ? `${txn.merchant} • ` : ""}
                              {walletName} • {categoryName}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <span
                            className={`text-sm font-extrabold tracking-tight ${
                              isIncome ? "text-cyan-400" : isExpense ? "text-indigo-400" : "text-sky-400"
                            }`}
                          >
                            {isExpense ? "-" : isIncome ? "+" : ""}
                            {formatIDR(txn.amount)}
                          </span>

                          {/* Quick receipt upload/view button */}
                          <button
                            onClick={() => handleOpenReceiptModal(txn.id)}
                            className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-white rounded border border-zinc-800 cursor-pointer"
                            title="Lampirkan Kuitansi"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                          </button>

                          {/* Delete button */}
                          <button
                            onClick={() => handleDelete(txn.id)}
                            className="p-1.5 bg-zinc-900 hover:bg-red-950/20 text-zinc-500 hover:text-red-400 rounded border border-zinc-800 cursor-pointer"
                            title="Hapus Transaksi"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
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
            <Filter className="h-10 w-10 text-zinc-600 stroke-[1.5]" />
            <div className="flex flex-col">
              <span className="text-xs text-zinc-500 font-semibold">Tidak ditemukan hasil transaksi</span>
              <span className="text-[10px] text-zinc-600">Coba ubah kata kunci pencarian atau bersihkan filter dompet/tipe.</span>
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
                  <a
                    href={attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Buka Gambar di Tab Baru
                  </a>
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
    </MainLayout>
  );
}

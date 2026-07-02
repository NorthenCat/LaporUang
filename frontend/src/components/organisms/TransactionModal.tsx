"use client";

import React, { useState, useEffect } from "react";
import * as Icons from "lucide-react";
import { apiRequest } from "@/utils/api";
import { Button } from "../atoms/Button";
import { FormField } from "../molecules/FormField";
import { CurrencyFormField } from "../molecules/CurrencyFormField";
import { CurrencyInput } from "../atoms/CurrencyInput";

interface Wallet {
  id: string;
  name: string;
  type: string;
  color: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
  color: string;
}

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form states
  const [type, setType] = useState<"income" | "expense" | "transfer" | "adjustment">("expense");
  const [walletId, setWalletId] = useState("");
  const [toWalletId, setToWalletId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [note, setNote] = useState("");
  const [merchant, setMerchant] = useState("");

  // Splits states
  const [isSplit, setIsSplit] = useState(false);
  const [splits, setSplits] = useState<{ categoryId: string; amount: number; note: string }[]>([
    { categoryId: "", amount: 0, note: "" },
  ]);

  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchFormOptions();
    }
  }, [isOpen]);

  const fetchFormOptions = async () => {
    try {
      const [walletData, categoryData] = await Promise.all([
        apiRequest("/wallets"),
        apiRequest("/categories"),
      ]);
      setWallets(walletData || []);
      setCategories(categoryData || []);
      
      if (walletData && walletData.length > 0) {
        setWalletId(walletData[0].id);
        if (walletData.length > 1) {
          setToWalletId(walletData[1].id);
        }
      }
      if (categoryData && categoryData.length > 0) {
        setCategoryId(categoryData[0].id);
      }
    } catch (err: any) {
      setErrorMsg("Gagal memuat opsi form");
    }
  };

  const handleAddSplit = () => {
    setSplits([...splits, { categoryId: "", amount: 0, note: "" }]);
  };

  const handleRemoveSplit = (idx: number) => {
    const next = [...splits];
    next.splice(idx, 1);
    setSplits(next);
  };

  const handleSplitChange = (idx: number, field: string, val: any) => {
    const next = [...splits];
    next[idx] = { ...next[idx], [field]: val };
    setSplits(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");

    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg("Jumlah transaksi harus berupa angka positif");
      setIsLoading(false);
      return;
    }

    // Validate splits if enabled
    let parsedSplits = [];
    if (isSplit && type === "expense") {
      let splitSum = 0;
      for (const sp of splits) {
        if (!sp.categoryId) {
          setErrorMsg("Semua baris pecahan harus memilih kategori");
          setIsLoading(false);
          return;
        }
        if (sp.amount <= 0) {
          setErrorMsg("Jumlah pecahan harus positif");
          setIsLoading(false);
          return;
        }
        splitSum += sp.amount;
        parsedSplits.push({
          category_id: sp.categoryId,
          amount: sp.amount,
          note: sp.note ? sp.note : undefined,
        });
      }

      if (splitSum > parsedAmount) {
        setErrorMsg(`Jumlah pecahan (${splitSum}) tidak boleh melebihi total transaksi (${parsedAmount})`);
        setIsLoading(false);
        return;
      }
    }

    try {
      const payload: any = {
        wallet_id: walletId,
        type,
        amount: parsedAmount,
        date: new Date(date).toISOString(),
        note: note ? note : undefined,
        merchant: merchant ? merchant : undefined,
      };

      if (type !== "adjustment" && type !== "transfer") {
        payload.category_id = categoryId;
      }

      if (type === "transfer") {
        payload.to_wallet_id = toWalletId;
      }

      if (parsedSplits.length > 0) {
        payload.splits = parsedSplits;
      }

      await apiRequest("/transactions", "POST", payload);
      setIsLoading(false);
      onSuccess();
      onClose();

      // Reset form
      setAmount("");
      setNote("");
      setMerchant("");
      setIsSplit(false);
      setSplits([{ categoryId: "", amount: 0, note: "" }]);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal membuat transaksi");
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const targetType = type === "transfer" ? "expense" : (type === "adjustment" ? "expense" : type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-lg rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-bold text-white">Tambah Transaksi</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition cursor-pointer">
            <Icons.X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex flex-col gap-5">
          {errorMsg ? (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-semibold">
              {errorMsg}
            </div>
          ) : null}

          {/* Type Tab Selector */}
          <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-950/80 border border-zinc-800/80 rounded-lg">
            {(["expense", "income", "transfer", "adjustment"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`py-1.5 text-xs font-bold rounded-md capitalize transition cursor-pointer ${
                  type === t
                    ? "bg-gradient-to-r from-sky-400 to-blue-600 text-white shadow-[0_0_10px_rgba(56,189,248,0.35)]"
                    : "text-zinc-400 hover:text-slate-100"
                }`}
              >
                {t === "expense" ? "Pengeluaran" : t === "income" ? "Pemasukan" : t === "transfer" ? "Transfer" : "Adjusment"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Wallet Selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase">
                {type === "transfer" ? "Dari Dompet" : "Dompet"}
              </label>
              <select
                value={walletId}
                onChange={(e) => setWalletId(e.target.value)}
                className="w-full bg-slate-900 border border-zinc-800 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500"
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            {/* To Wallet Selection (only for transfers) */}
            {type === "transfer" ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase">Tujuan Dompet</label>
                <select
                  value={toWalletId}
                  onChange={(e) => setToWalletId(e.target.value)}
                  className="w-full bg-slate-900 border border-zinc-800 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : type !== "adjustment" ? (
              /* Category Selection (Not for adjustments or transfers) */
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase">Kategori</label>
                <select
                  value={categoryId}
                  disabled={isSplit}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-slate-900 border border-zinc-800 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500 disabled:opacity-40"
                >
                  {categories
                    .filter((c) => c.type === targetType)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase">Info Adjusment</label>
                <div className="text-xs text-zinc-500 py-2.5 px-1 bg-zinc-900/40 rounded border border-zinc-800/40">
                  Mengubah saldo dompet langsung ke jumlah target.
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <CurrencyFormField
              label={type === "adjustment" ? "Target Saldo" : "Jumlah Uang"}
              placeholder="Contoh: 25000"
              value={amount}
              onValueChange={setAmount}
              required
            />

            <FormField
              label="Tanggal"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {type !== "adjustment" && type !== "transfer" ? (
            <FormField
              label="Penerima / Toko (Merchant)"
              type="text"
              placeholder="Contoh: Supermarket Abadi"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
            />
          ) : null}

          <FormField
            label="Catatan"
            type="text"
            placeholder="Ketik catatan tambahan..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          {/* Split Transactions Checkbox (Expense only) */}
          {type === "expense" ? (
            <div className="flex flex-col gap-3 pt-3 border-t border-zinc-800">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isSplit}
                  onChange={(e) => setIsSplit(e.target.checked)}
                  className="rounded bg-zinc-900 border-zinc-800 text-primary focus:ring-primary h-4 w-4"
                />
                <span className="text-xs font-bold text-zinc-300 uppercase">Pecah Transaksi (Split)</span>
              </label>

              {isSplit ? (
                <div className="flex flex-col gap-3.5 mt-2 bg-zinc-950/30 p-4 rounded-xl border border-zinc-900">
                  <span className="text-[11px] font-bold text-zinc-400 tracking-wider uppercase">Pecahan Anggaran</span>
                  {splits.map((sp, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select
                        value={sp.categoryId}
                        onChange={(e) => handleSplitChange(idx, "categoryId", e.target.value)}
                        className="bg-slate-900 border border-zinc-800 text-slate-100 rounded-lg px-2 py-1 text-xs focus:outline-none w-1/3 focus:border-sky-500"
                      >
                        <option value="">Kategori</option>
                        {categories
                          .filter((c) => c.type === "expense")
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>

                      <CurrencyInput
                        placeholder="Jumlah"
                        value={sp.amount || ""}
                        onValueChange={(val) => handleSplitChange(idx, "amount", parseInt(val, 10) || 0)}
                        className="bg-slate-900 border border-zinc-800 text-slate-100 rounded-lg px-2 py-1 text-xs focus:outline-none w-1/3 focus:border-sky-500"
                      />

                      <input
                        type="text"
                        placeholder="Memo"
                        value={sp.note}
                        onChange={(e) => handleSplitChange(idx, "note", e.target.value)}
                        className="bg-slate-900 border border-zinc-800 text-slate-100 rounded-lg px-2 py-1 text-xs focus:outline-none w-1/3 focus:border-sky-500"
                      />

                      <button
                        type="button"
                        onClick={() => handleRemoveSplit(idx)}
                        disabled={splits.length <= 1}
                        className="text-zinc-500 hover:text-red-400 p-1 disabled:opacity-20 cursor-pointer"
                      >
                        <Icons.Trash className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddSplit}
                    className="text-xs font-bold text-primary hover:text-indigo-400 flex items-center gap-1.5 self-start cursor-pointer mt-1"
                  >
                    <Icons.Plus className="h-3.5 w-3.5" /> Tambah Kategori
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Footer Submit Buttons */}
          <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-zinc-800">
            <Button type="button" variant="ghost" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" variant="primary" isLoading={isLoading}>
              Simpan Transaksi
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

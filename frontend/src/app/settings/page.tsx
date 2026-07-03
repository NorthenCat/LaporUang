"use client";

import React, { useState, useEffect } from "react";
import { MainLayout } from "@/components/templates/MainLayout";
import { Button } from "@/components/atoms/Button";
import { FormField } from "@/components/molecules/FormField";
import { CustomSelect } from "@/components/atoms/CustomSelect";
import { apiRequest } from "@/utils/api";
import { ShieldAlert, ShieldCheck, Key, Settings, User } from "lucide-react";

export default function SettingsPage() {
  const [pinEnabled, setPinEnabled] = useState(false);
  const [idleTimeout, setIdleTimeout] = useState(300);
  const [currency, setCurrency] = useState("IDR");
  const [isLoading, setIsLoading] = useState(true);

  // Toggle PIN flow states
  const [showPINSetup, setShowPINSetup] = useState(false);
  const [newPIN, setNewPIN] = useState("");
  const [confirmPIN, setConfirmPIN] = useState("");
  const [pinError, setPINError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [email, setEmail] = useState("");

  useEffect(() => {
    fetchSettings();
    if (typeof window !== "undefined") {
      setEmail(localStorage.getItem("user_email") || "Akun Pengguna");
    }
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest("/settings");
      if (res) {
        setPinEnabled(res.pin_enabled);
        setIdleTimeout(res.idle_timeout_seconds || 300);
        setCurrency(res.currency_code || "IDR");
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const handlePINSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPINError("");

    if (newPIN.length !== 4 || isNaN(parseInt(newPIN, 10))) {
      setPINError("PIN harus berupa 4 digit angka");
      return;
    }

    if (newPIN !== confirmPIN) {
      setPINError("PIN konfirmasi tidak cocok");
      return;
    }

    setIsSaving(true);
    try {
      const hash = await hashPIN(newPIN);
      await apiRequest("/settings", "POST", {
        idle_timeout_seconds: idleTimeout,
        currency_code: currency,
        pin_hash: hash,
      });

      alert("PIN Lock berhasil diaktifkan!");
      setPinEnabled(true);
      setShowPINSetup(false);
      setNewPIN("");
      setConfirmPIN("");
    } catch (err: any) {
      setPINError(err.message || "Gagal mengaktifkan PIN Lock");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisablePIN = async () => {
    const rawPIN = prompt("Masukkan PIN 4 digit Anda saat ini untuk menonaktifkan:");
    if (!rawPIN) return;

    setIsSaving(true);
    try {
      const hash = await hashPIN(rawPIN);
      
      // Verify first
      const verifyRes = await apiRequest("/settings/verify-pin", "POST", { pin_hash: hash });
      
      if (verifyRes && verifyRes.valid) {
        const disablePINVal = ""; // empty string disables PIN hash
        await apiRequest("/settings", "POST", {
          idle_timeout_seconds: idleTimeout,
          currency_code: currency,
          pin_hash: disablePINVal,
        });

        alert("PIN Lock dinonaktifkan!");
        setPinEnabled(false);
      } else {
        alert("PIN yang Anda masukkan salah!");
      }
    } catch (err: any) {
      alert(err.message || "Gagal menonaktifkan PIN Lock");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveGeneralSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await apiRequest("/settings", "POST", {
        idle_timeout_seconds: parseInt(idleTimeout.toString(), 10),
        currency_code: currency,
      });
      alert("Pengaturan umum berhasil disimpan!");
    } catch (err: any) {
      alert(err.message || "Gagal menyimpan pengaturan");
    } finally {
      setIsSaving(false);
    }
  };

  // Web Crypto SHA-256 matching lock screen
  const hashPIN = async (rawPIN: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(rawPIN + "laporuang_salt_9876"); // static salt matching overlay
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  return (
    <MainLayout>
      <div className="flex flex-col gap-8 w-full max-w-2xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Pengaturan</h1>
          <p className="text-xs sm:text-sm text-zinc-500">Sesuaikan proteksi keamanan PIN, timeout, dan unit mata uang aplikasi Anda.</p>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-5">
            <div className="h-28 glass-panel rounded-xl animate-pulse" />
            <div className="h-44 glass-panel rounded-xl animate-pulse" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            
            {/* Account Card Profile */}
            <div className="glass-panel p-5 rounded-2xl border border-zinc-800 flex items-center gap-4">
              <div className="h-12 w-12 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-xl flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(56,189,248,0.15)]">
                <User className="h-6 w-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Akun Terdaftar</span>
                <span className="text-base font-bold text-white mt-0.5">{email}</span>
              </div>
            </div>

            {/* General configurations */}
            <div className="glass-panel p-6 rounded-2xl border border-zinc-800 flex flex-col gap-6">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Settings className="h-4.5 w-4.5 text-sky-400" /> Pengaturan Umum
              </h2>
              
              <form onSubmit={handleSaveGeneralSettings} className="flex flex-col gap-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-400 uppercase">Unit Mata Uang</label>
                    <CustomSelect
                      value={currency}
                      onChange={(val) => setCurrency(String(val))}
                      options={[
                        { label: "IDR (Rupiah)", value: "IDR" },
                        { label: "USD (Dolar US)", value: "USD" },
                        { label: "EUR (Euro)", value: "EUR" },
                        { label: "SGD (Dolar Singapore)", value: "SGD" },
                      ]}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-400 uppercase">Idle Timeout Penguncian</label>
                    <CustomSelect
                      value={idleTimeout}
                      onChange={(val) => setIdleTimeout(Number(val))}
                      options={[
                        { label: "1 Menit", value: 60 },
                        { label: "5 Menit", value: 300 },
                        { label: "15 Menit", value: 900 },
                        { label: "30 Menit", value: 1800 },
                      ]}
                    />
                  </div>
                </div>

                <Button type="submit" variant="primary" className="self-end" isLoading={isSaving}>
                  Simpan Setelan Umum
                </Button>
              </form>
            </div>

            {/* PIN Security Configurations */}
            <div className="glass-panel p-6 rounded-2xl border border-zinc-800 flex flex-col gap-5">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Key className="h-4.5 w-4.5 text-sky-400" /> Keamanan & PIN Lock
              </h2>

              <div className="flex items-start gap-3 p-4 bg-zinc-950/40 border border-zinc-900 rounded-xl">
                {pinEnabled ? (
                  <ShieldCheck className="h-5 w-5 text-cyan-400 shrink-0" />
                ) : (
                  <ShieldAlert className="h-5 w-5 text-sky-400 shrink-0" />
                )}
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-bold text-white">
                    Status PIN Lock: {pinEnabled ? "Aktif" : "Nonaktif"}
                  </span>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Mencegah akses ilegal dengan mengunci antarmuka aplikasi setelah idle timeout atau jika layar berpindah/tab diminimalkan.
                  </p>
                </div>
              </div>

              {!pinEnabled ? (
                !showPINSetup ? (
                  <Button onClick={() => setShowPINSetup(true)} variant="glass" className="w-full">
                    Aktifkan Kunci PIN 4 Digit
                  </Button>
                ) : (
                  <form onSubmit={handlePINSetupSubmit} className="flex flex-col gap-4 p-4 bg-zinc-950/30 rounded-xl border border-zinc-900">
                    <span className="text-xs font-bold text-zinc-300 uppercase tracking-wide">Setel PIN Baru</span>
                    
                    {pinError ? (
                      <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-semibold">
                        {pinError}
                      </div>
                    ) : null}

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        label="PIN Baru (4 Digit)"
                        type="password"
                        maxLength={4}
                        placeholder="••••"
                        value={newPIN}
                        onChange={(e) => setNewPIN(e.target.value)}
                        required
                        id="newPIN"
                      />

                      <FormField
                        label="Konfirmasi PIN"
                        type="password"
                        maxLength={4}
                        placeholder="••••"
                        value={confirmPIN}
                        onChange={(e) => setConfirmPIN(e.target.value)}
                        required
                        id="confirmPIN"
                      />
                    </div>

                    <div className="flex gap-2 justify-end mt-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setShowPINSetup(false)}>
                        Batal
                      </Button>
                      <Button type="submit" variant="primary" size="sm" isLoading={isSaving}>
                        Simpan PIN
                      </Button>
                    </div>
                  </form>
                )
              ) : (
                <Button onClick={handleDisablePIN} variant="danger" className="w-full" isLoading={isSaving}>
                  Nonaktifkan Kunci PIN
                </Button>
              )}
            </div>

          </div>
        )}
      </div>
    </MainLayout>
  );
}

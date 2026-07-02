"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/atoms/Button";
import { FormField } from "@/components/molecules/FormField";
import { apiRequest } from "@/utils/api";
import { TrendingDown } from "lucide-react";

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    // If token already exists, redirect to dashboard
    const token = localStorage.getItem("token");
    if (token) {
      router.push("/");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");

    if (!isLogin && password !== confirmPassword) {
      setErrorMsg("Password konfirmasi tidak cocok");
      setIsLoading(false);
      return;
    }

    try {
      const endpoint = isLogin ? "/auth/login" : "/auth/register";
      const payload = { email, password };
      
      const res = await apiRequest(endpoint, "POST", payload);

      if (res && res.token) {
        localStorage.setItem("token", res.token);
        localStorage.setItem("user_email", res.email);
        router.push("/");
      } else {
        setErrorMsg("Gagal melakukan login, periksa respons server");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terdapat kegagalan saat otentikasi");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090e17] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glowing Blobs */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[450px] h-[450px] rounded-full bg-sky-500/5 blur-3xl pointer-events-none" />

      <div className="flex flex-col items-center gap-6 max-w-md w-full relative z-10">
        
        {/* App Logo Header */}
        <div className="flex items-center gap-2 mb-2">
          <div className="bg-sky-500/10 p-2.5 rounded-xl text-sky-400 border border-sky-500/20 shadow-[0_0_15px_rgba(56,189,248,0.25)]">
            <TrendingDown className="h-6 w-6 stroke-[2.5]" />
          </div>
          <span className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent">
            LaporUang
          </span>
        </div>

        {/* Card Form */}
        <div className="w-full glass-panel border border-border rounded-2xl p-6 sm:p-8 shadow-2xl flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-xl font-extrabold text-white tracking-tight">
              {isLogin ? "Selamat Datang Kembali" : "Buat Akun Baru"}
            </h2>
            <p className="text-xs text-zinc-400">
              {isLogin
                ? "Masuk untuk mengakses pembukuan dan analisis keuangan Anda."
                : "Mulai perjalanan finansial mandiri dengan pencatatan yang rapi."}
            </p>
          </div>

          {errorMsg ? (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-semibold">
              {errorMsg}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <FormField
              label="Alamat Email"
              type="email"
              placeholder="nama@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              id="email"
            />
            <FormField
              label="Kata Sandi"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              id="password"
            />
            {!isLogin ? (
              <FormField
                label="Konfirmasi Kata Sandi"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                id="confirmPassword"
              />
            ) : null}

            <Button type="submit" variant="primary" className="w-full mt-2" isLoading={isLoading}>
              {isLogin ? "Masuk ke Akun" : "Daftar Akun"}
            </Button>
          </form>

          {/* Toggle Login/Register */}
          <div className="text-center text-xs text-zinc-500 border-t border-zinc-800 pt-4">
            {isLogin ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setErrorMsg("");
              }}
              className="text-sky-400 hover:text-sky-300 hover:underline font-bold cursor-pointer ml-1"
            >
              {isLogin ? "Daftar sekarang" : "Masuk sekarang"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, Delete, Circle } from "lucide-react";
import { apiRequest } from "@/utils/api";

interface PINLockOverlayProps {
  onUnlock: () => void;
}

export const PINLockOverlay: React.FC<PINLockOverlayProps> = ({ onUnlock }) => {
  const [pin, setPin] = useState<string>("");
  const [error, setError] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);

  useEffect(() => {
    if (pin.length === 4) {
      verifyPIN();
    }
  }, [pin]);

  const verifyPIN = async () => {
    setIsChecking(true);
    setError(false);

    try {
      // Calculate hash on client side
      const hash = await hashPIN(pin);
      
      const res = await apiRequest("/settings/verify-pin", "POST", { pin_hash: hash });
      
      if (res && res.valid) {
        onUnlock();
      } else {
        // Trigger shake animation and clear
        setError(true);
        setTimeout(() => {
          setPin("");
          setError(false);
        }, 600);
      }
    } catch {
      setError(true);
      setPin("");
    } finally {
      setIsChecking(false);
    }
  };

  // Hashing helper using standard Web Crypto API PBKDF2/SHA256
  const hashPIN = async (rawPIN: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(rawPIN + "laporuang_salt_9876"); // static salt
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  const handleKeyPress = (num: string) => {
    if (pin.length < 4 && !isChecking) {
      setPin((prev) => prev + num);
    }
  };

  const handleDelete = () => {
    if (pin.length > 0 && !isChecking) {
      setPin((prev) => prev.slice(0, -1));
    }
  };

  return (
    <div className="fixed inset-0 z-[999] bg-[#090e17] flex flex-col items-center justify-center p-4">
      {/* Background glow blobs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

      <div className="flex flex-col items-center gap-6 max-w-sm w-full text-center relative">
        <div className="bg-primary/10 p-3 rounded-full border border-primary/20 shadow-[0_4px_15px_-3px_rgba(88,75,247,0.15)] text-primary">
          <ShieldCheck className="h-8 w-8 stroke-[1.5]" />
        </div>

        <div className="flex flex-col gap-1.5">
          <h2 className="text-xl font-extrabold text-white tracking-tight">PIN Lock Aktif</h2>
          <p className="text-xs text-zinc-400 max-w-[240px]">
            Ketik PIN 4 digit untuk membuka aplikasi LaporUang Anda.
          </p>
        </div>

        {/* PIN Indicators */}
        <div
          className={`flex gap-5 py-4 transition-transform duration-200 ${
            error ? "animate-bounce text-red-500" : ""
          }`}
        >
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = pin.length > idx;
            return (
              <Circle
                key={idx}
                className={`h-4.5 w-4.5 transition-all duration-150 ${
                  isFilled
                    ? "fill-sky-400 text-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.5)]"
                    : "text-zinc-800 fill-zinc-800"
                }`}
              />
            );
          })}
        </div>

        {/* Circular Key Pad */}
        <div className="grid grid-cols-3 gap-4.5 w-full max-w-[280px] mt-6">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num)}
              className="h-16 w-16 text-xl font-bold bg-slate-900/40 hover:bg-sky-500/10 text-white rounded-full border border-zinc-800/80 hover:border-sky-500/30 flex items-center justify-center active:scale-90 transition-all cursor-pointer shadow-md hover:shadow-sky-500/10 duration-200"
            >
              {num}
            </button>
          ))}
          
          <div className="flex items-center justify-center" />
          
          <button
            type="button"
            onClick={() => handleKeyPress("0")}
            className="h-16 w-16 text-xl font-bold bg-slate-900/40 hover:bg-sky-500/10 text-white rounded-full border border-zinc-800/80 hover:border-sky-500/30 flex items-center justify-center active:scale-90 transition-all cursor-pointer shadow-md hover:shadow-sky-500/10 duration-200"
          >
            0
          </button>
          
          <button
            type="button"
            onClick={handleDelete}
            className="h-16 w-16 text-zinc-400 hover:text-zinc-700 flex items-center justify-center active:scale-90 transition-all cursor-pointer"
          >
            <Delete className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

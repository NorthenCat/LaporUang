"use client";

import React, { useState, useEffect } from "react";
import { MainLayout } from "@/components/templates/MainLayout";
import { ProjectionChart } from "@/components/organisms/ProjectionChart";
import { CustomSelect } from "@/components/atoms/CustomSelect";
import { apiRequest } from "@/utils/api";
import { TrendingUp } from "lucide-react";
import Link from "next/link";

interface Adjustment {
  id: string;
  date: string;
  amount: number;
  type: string;
  note?: string;
}

export default function ProjectionsPage() {
  const [projectionData, setProjectionData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  useEffect(() => {
    fetchInitialData();
  }, [selectedMonth, selectedYear]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const startDate = new Date(selectedYear, selectedMonth, 1, 12).toISOString();
      const endDate = new Date(selectedYear, selectedMonth + 1, 0, 12).toISOString();

      const [proj] = await Promise.all([
        apiRequest(`/projections?start_date=${startDate}&end_date=${endDate}`),
      ]);
      setProjectionData(proj);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
            <div className="flex gap-3 w-full sm:w-auto">
              <CustomSelect
                value={selectedMonth}
                onChange={(val) => setSelectedMonth(Number(val))}
                className="flex-1 sm:w-36"
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
                className="flex-1 sm:w-28"
                options={Array.from({ length: 5 }).map((_, i) => {
                  const year = new Date().getFullYear() - 2 + i;
                  return { label: String(year), value: year };
                })}
              />
            </div>
          </div>
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

        <div className="flex justify-center mt-2">
          <Link
            href="/projections/simulate"
            className="flex w-full sm:w-auto justify-center items-center gap-1.5 shadow-lg shadow-sky-500/20 py-3 px-8 rounded-full font-bold text-sm tracking-wide bg-sky-500 hover:bg-sky-400 text-white transition-colors"
          >
            Mulai Simulasi Penyesuaian Kas
          </Link>
        </div>

      </div>
    </MainLayout>
  );
}

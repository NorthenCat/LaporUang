"use client";

import React, { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { formatIDR } from "@/utils/money";
import { ShieldAlert } from "lucide-react";

interface ProjectionPoint {
  date: string;
  balance: number;
  events: string[];
}

interface ProjectionChartProps {
  data: ProjectionPoint[];
  minBalance: number;
  minBalanceDate: string;
  potentialDeficitDate: string;
}

export const ProjectionChart: React.FC<ProjectionChartProps> = ({
  data,
  minBalance,
  minBalanceDate,
  potentialDeficitDate,
}) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="h-80 w-full flex items-center justify-center glass-panel rounded-xl">
        <span className="text-sm text-zinc-500 animate-pulse">Memuat chart proyeksi...</span>
      </div>
    );
  }

  // Format dates for X-Axis (e.g. 24 Jun)
  const chartData = data.map((pt) => {
    const d = new Date(pt.date);
    const formattedDate = d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    });
    return {
      ...pt,
      displayDate: formattedDate,
    };
  });

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="glass-panel p-4 rounded-xl shadow-xl flex flex-col gap-2 max-w-xs border border-zinc-800">
          <span className="text-xs font-bold text-zinc-400">{dataPoint.date}</span>
          <span className="text-base font-extrabold text-white">
            {formatIDR(dataPoint.balance)}
          </span>
          {dataPoint.events && dataPoint.events.length > 0 ? (
            <div className="flex flex-col gap-1 mt-1 pt-2 border-t border-zinc-800">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                Event Hari Ini:
              </span>
              {dataPoint.events.map((ev: string, idx: number) => (
                <span key={idx} className="text-xs text-zinc-300 truncate">
                  • {ev}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {potentialDeficitDate ? (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 glow-tag-indigo">
          <ShieldAlert className="h-5 w-5 text-indigo-400 shrink-0" />
          <div className="flex flex-col">
            <span className="text-sm font-bold text-indigo-300">Peringatan Defisit Saldo!</span>
            <span className="text-xs text-zinc-400">
              Saldo diproyeksikan akan jatuh di bawah Rp 0 pertama kali pada{" "}
              <strong className="text-white">{potentialDeficitDate}</strong>. Sesuaikan anggaran atau pemasukan Anda.
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 glow-tag-cyan">
          <ShieldAlert className="h-5 w-5 text-cyan-400 shrink-0 rotate-180" />
          <div className="flex flex-col">
            <span className="text-sm font-bold text-cyan-300">Cash Flow Aman</span>
            <span className="text-xs text-zinc-400">
              Saldo diproyeksikan tetap berada di atas batas aman Rp 0 selama rentang proyeksi.
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="glass-panel p-4 rounded-xl flex flex-col">
          <span className="text-xs font-semibold text-zinc-400 uppercase">Saldo Minimum Diproyeksikan</span>
          <span className="text-xl font-bold text-white mt-1">{formatIDR(minBalance)}</span>
          <span className="text-xs text-zinc-500 mt-0.5">Tanggal: {minBalanceDate}</span>
        </div>
        <div className="glass-panel p-4 rounded-xl flex flex-col">
          <span className="text-xs font-semibold text-zinc-400 uppercase">Durasi Proyeksi</span>
          <span className="text-xl font-bold text-white mt-1">{data.length} Hari</span>
          <span className="text-xs text-zinc-500 mt-0.5">
            {data[0]?.date} s/d {data[data.length - 1]?.date}
          </span>
        </div>
      </div>

      <div className="glass-panel p-5 rounded-xl h-80 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="displayDate"
              stroke="#71717a"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#71717a"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => `Rp ${val / 1000}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="#38bdf8"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorBalance)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

"use client";

import { useEffect, useState, useCallback } from "react";
import type { FuelLog } from "@/lib/supabase";
import { formatIDR, formatDate, exportToCSV } from "@/lib/utils";
import { CAPTAIN_NAMES, BOAT_NAMES } from "@/lib/constants";

type Filters = {
  boat: string;
  captain: string;
  from: string;
  to: string;
};

export default function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [filters, setFilters] = useState<Filters>({ boat: "", captain: "", from: "", to: "" });
  const [logs, setLogs] = useState<FuelLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortAsc, setSortAsc] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.boat) params.set("boat", filters.boat);
    if (filters.captain) params.set("captain", filters.captain);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    const res = await fetch(`/api/logs?${params}`);
    const data = await res.json();
    setLogs(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [filters]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const sorted = [...logs].sort((a, b) => {
    const diff = new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime();
    return sortAsc ? diff : -diff;
  });

  const totalLiters = logs.reduce((s, l) => s + Number(l.liters), 0);
  const totalCost = logs.reduce((s, l) => s + Number(l.cost_idr), 0);

  // Group by boat
  const byBoat = logs.reduce<Record<string, { liters: number; cost: number }>>((acc, l) => {
    if (!acc[l.boat_name]) acc[l.boat_name] = { liters: 0, cost: 0 };
    acc[l.boat_name].liters += Number(l.liters);
    acc[l.boat_name].cost += Number(l.cost_idr);
    return acc;
  }, {});

  // Group by captain
  const byCaptain = logs.reduce<Record<string, { liters: number; cost: number }>>((acc, l) => {
    if (!acc[l.captain_name]) acc[l.captain_name] = { liters: 0, cost: 0 };
    acc[l.captain_name].liters += Number(l.liters);
    acc[l.captain_name].cost += Number(l.cost_idr);
    return acc;
  }, {});

  function handleExport() {
    const rows = sorted.map((l) => ({
      Tanggal: formatDate(l.logged_at),
      Kapten: l.captain_name,
      Kapal: l.boat_name,
      "Pelabuhan Asal": l.route.split(" → ")[0] ?? l.route,
      "Pelabuhan Tujuan": l.route.split(" → ")[1] ?? "",
      "Volume (L)": l.liters,
      "Biaya (IDR)": l.cost_idr,
      Catatan: l.notes ?? "",
    }));
    exportToCSV(rows as unknown as Record<string, unknown>[], `bbm-logs-${Date.now()}.csv`);
  }

  async function handleLogout() {
    await fetch("/api/auth", { method: "DELETE" });
    onLogout();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {false && (
        <div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">⛽ BBM Recap</h1>
          <p className="text-xs text-gray-500">Admin Dashboard</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-100 transition-colors"
        >
          Logout
        </button>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Kapal</label>
            <select
              value={filters.boat}
              onChange={(e) => setFilters((f) => ({ ...f, boat: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Semua Kapal</option>
              {BOAT_NAMES.map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Kapten</label>
            <select
              value={filters.captain}
              onChange={(e) => setFilters((f) => ({ ...f, captain: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Semua Kapten</option>
              {CAPTAIN_NAMES.filter((n) => n !== "Other").map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Dari Tanggal</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Sampai Tanggal</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-600 text-white rounded-2xl p-4 shadow">
            <p className="text-xs font-medium opacity-80">Total Volume</p>
            <p className="text-2xl font-bold mt-1">
              {totalLiters.toLocaleString("id-ID", { maximumFractionDigits: 1 })}
            </p>
            <p className="text-xs opacity-70">liter</p>
          </div>
          <div className="bg-emerald-600 text-white rounded-2xl p-4 shadow">
            <p className="text-xs font-medium opacity-80">Total Biaya</p>
            <p className="text-lg font-bold mt-1 leading-tight">
              {formatIDR(totalCost)}
            </p>
          </div>
          <div className="bg-violet-600 text-white rounded-2xl p-4 shadow">
            <p className="text-xs font-medium opacity-80">Jumlah Trip</p>
            <p className="text-2xl font-bold mt-1">{logs.length}</p>
            <p className="text-xs opacity-70">entri</p>
          </div>
        </div>

        {/* Breakdown tables */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* By Boat */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-700">Per Kapal</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="text-left px-4 py-2">Kapal</th>
                    <th className="text-right px-4 py-2">Liter</th>
                    <th className="text-right px-4 py-2">Biaya</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(byBoat).map(([boat, v]) => (
                    <tr key={boat} className="border-t border-gray-50">
                      <td className="px-4 py-2 font-medium">{boat}</td>
                      <td className="px-4 py-2 text-right">
                        {v.liters.toLocaleString("id-ID", { maximumFractionDigits: 1 })}
                      </td>
                      <td className="px-4 py-2 text-right text-xs">{formatIDR(v.cost)}</td>
                    </tr>
                  ))}
                  {Object.keys(byBoat).length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-4 text-gray-400 text-center">Tidak ada data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* By Captain */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-700">Per Kapten</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="text-left px-4 py-2">Kapten</th>
                    <th className="text-right px-4 py-2">Liter</th>
                    <th className="text-right px-4 py-2">Biaya</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(byCaptain).map(([cap, v]) => (
                    <tr key={cap} className="border-t border-gray-50">
                      <td className="px-4 py-2 font-medium">{cap}</td>
                      <td className="px-4 py-2 text-right">
                        {v.liters.toLocaleString("id-ID", { maximumFractionDigits: 1 })}
                      </td>
                      <td className="px-4 py-2 text-right text-xs">{formatIDR(v.cost)}</td>
                    </tr>
                  ))}
                  {Object.keys(byCaptain).length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-4 text-gray-400 text-center">Tidak ada data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Main table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-700">
              Log BBM{" "}
              <span className="text-gray-400 font-normal text-sm">({logs.length} entri)</span>
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSortAsc((s) => !s)}
                className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
              >
                {sortAsc ? "↑ Terlama" : "↓ Terbaru"}
              </button>
              <button
                onClick={handleExport}
                className="text-xs bg-blue-600 text-white rounded-lg px-3 py-1.5 hover:bg-blue-700 transition-colors"
              >
                Export CSV
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-gray-400">Memuat data…</div>
          ) : sorted.length === 0 ? (
            <div className="py-16 text-center text-gray-400">Tidak ada data ditemukan</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                  <tr>
                    <th className="text-left px-4 py-3">Tanggal</th>
                    <th className="text-left px-4 py-3">Kapten</th>
                    <th className="text-left px-4 py-3">Kapal</th>
                    <th className="text-left px-4 py-3">Asal</th>
                    <th className="text-left px-4 py-3">Tujuan</th>
                    <th className="text-right px-4 py-3">Liter</th>
                    <th className="text-right px-4 py-3">Biaya (IDR)</th>
                    <th className="text-left px-4 py-3">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((log) => (
                    <tr key={log.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                        {formatDate(log.logged_at)}
                      </td>
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{log.captain_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{log.boat_name}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-[140px] truncate" title={log.route.split(" → ")[0]}>
                        {log.route.split(" → ")[0] ?? log.route}
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[140px] truncate" title={log.route.split(" → ")[1]}>
                        {log.route.split(" → ")[1] ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {Number(log.liters).toLocaleString("id-ID", { maximumFractionDigits: 1 })}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {formatIDR(Number(log.cost_idr))}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate" title={log.notes ?? ""}>
                        {log.notes ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

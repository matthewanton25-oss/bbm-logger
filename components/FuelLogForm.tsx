"use client";

import { useState, useEffect } from "react";
import { toLocalDatetimeValue } from "@/lib/utils";

type FormState = {
  captainName: string;
  captainOther: string;
  boatName: string;
  departPort: string;
  arrivalPort: string;
  loggedAt: string;
  liters: string;
  notes: string;
};

function freshForm(): FormState {
  return {
    captainName: "",
    captainOther: "",
    boatName: "",
    departPort: "",
    arrivalPort: "",
    loggedAt: toLocalDatetimeValue(new Date()),
    liters: "",
    notes: "",
  };
}

export default function FuelLogForm() {
  const [form, setForm] = useState<FormState>(freshForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [captains, setCaptains] = useState<string[]>([]);
  const [boats, setBoats] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/captains").then(r => r.json()).then(d => setCaptains(d.map((c: {name: string}) => c.name)));
    fetch("/api/boats").then(r => r.json()).then(d => setBoats(d.map((b: {name: string}) => b.name)));
  }, []);

  function set(key: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  }

  function validate() {
    const e: Record<string, string> = {};
    const captain = form.captainName === "Other" ? form.captainOther.trim() : form.captainName;
    if (!captain) e.captainName = "Nama kapten wajib diisi";
    if (!form.boatName) e.boatName = "Nama kapal wajib diisi";
    if (!form.departPort.trim()) e.departPort = "Pelabuhan asal wajib diisi";
    if (!form.arrivalPort.trim()) e.arrivalPort = "Pelabuhan tujuan wajib diisi";
    if (!form.loggedAt) e.loggedAt = "Tanggal & waktu wajib diisi";
    if (!form.liters || isNaN(Number(form.liters)) || Number(form.liters) <= 0)
      e.liters = "Masukkan volume BBM yang valid";
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      document.querySelector("[data-error]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitting(true);
    try {
      const captain = form.captainName === "Other" ? form.captainOther.trim() : form.captainName;
      const route = `${form.departPort.trim()} → ${form.arrivalPort.trim()}`;

      await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          captain_name: captain,
          boat_name: form.boatName,
          route,
          logged_at: new Date(form.loggedAt).toISOString(),
          liters: Number(form.liters),
          cost_idr: 0,
          notes: form.notes.trim() || null,
        }),
      });

      setSuccess(true);
    } catch (err) {
      alert("Gagal menyimpan. Periksa koneksi internet dan coba lagi.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setForm(freshForm());
    setErrors({});
    setSuccess(false);
  }

  if (success) {
    return (
      <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center px-6 text-center gap-6">
        <div className="text-7xl">✅</div>
        <h2 className="text-2xl font-bold text-green-700">Berhasil Tersimpan!</h2>
        <p className="text-green-600 text-lg">Data BBM berhasil dicatat. Terima kasih, Kapten!</p>
        <button
          onClick={reset}
          className="mt-4 bg-green-600 text-white text-lg font-semibold px-8 py-4 rounded-2xl active:bg-green-700 transition-colors shadow-lg"
        >
          Catat BBM Berikutnya
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 pb-8">

      {/* Captain Name */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Nama Kapten <span className="text-red-500">*</span>
        </label>
        <select
          value={form.captainName}
          onChange={(e) => set("captainName", e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-4 py-4 text-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Pilih Kapten --</option>
          {captains.map((n) => <option key={n} value={n}>{n}</option>)}
          <option value="Other">Lainnya...</option>
        </select>
        {form.captainName === "Other" && (
          <input
            type="text"
            placeholder="Masukkan nama kapten"
            value={form.captainOther}
            onChange={(e) => set("captainOther", e.target.value)}
            className="mt-3 w-full border border-gray-300 rounded-xl px-4 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
        {errors.captainName && <p data-error className="text-red-500 text-sm mt-1">{errors.captainName}</p>}
      </div>

      {/* Boat Name */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Nama Kapal <span className="text-red-500">*</span>
        </label>
        <select
          value={form.boatName}
          onChange={(e) => set("boatName", e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-4 py-4 text-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Pilih Kapal --</option>
          {boats.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        {errors.boatName && <p data-error className="text-red-500 text-sm mt-1">{errors.boatName}</p>}
      </div>

      {/* Ports */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Pelabuhan Asal <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          placeholder="Contoh: Marina Ancol"
          value={form.departPort}
          onChange={(e) => set("departPort", e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-4 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.departPort && <p data-error className="text-red-500 text-sm mt-1">{errors.departPort}</p>}
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Pelabuhan Tujuan <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          placeholder="Contoh: Pulau Sepa"
          value={form.arrivalPort}
          onChange={(e) => set("arrivalPort", e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-4 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.arrivalPort && <p data-error className="text-red-500 text-sm mt-1">{errors.arrivalPort}</p>}
      </div>

      {/* Date & Time */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Tanggal & Waktu <span className="text-red-500">*</span>
        </label>
        <input
          type="datetime-local"
          value={form.loggedAt}
          onChange={(e) => set("loggedAt", e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-4 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.loggedAt && <p data-error className="text-red-500 text-sm mt-1">{errors.loggedAt}</p>}
      </div>

      {/* Liters */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Volume BBM (Liter) <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          inputMode="decimal"
          placeholder="0"
          min="0"
          step="0.1"
          value={form.liters}
          onChange={(e) => set("liters", e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-4 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.liters && <p data-error className="text-red-500 text-sm mt-1">{errors.liters}</p>}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Catatan (opsional)
        </label>
        <textarea
          placeholder="Informasi tambahan jika ada..."
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={3}
          className="w-full border border-gray-300 rounded-xl px-4 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-blue-600 text-white text-xl font-bold py-5 rounded-2xl shadow-lg active:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? "Menyimpan…" : "Simpan Data BBM"}
      </button>

    </form>
  );
}

"use client";

import { useState, useEffect } from "react";
import AdminDashboard from "@/components/AdminDashboard";

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Check if already authed via cookie (server will reject /api/logs if not)
  useEffect(() => {
    fetch("/api/logs?_check=1")
      .then((r) => {
        // If we get a 403 we know we need to login
        if (r.status === 403) setAuthed(false);
        else setAuthed(true);
      })
      .catch(() => setAuthed(false));
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthed(true);
    } else {
      setError("Password salah. Coba lagi.");
    }
    setLoading(false);
  }

  if (authed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">Memuat…</p>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-800 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-xl">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">🔒</div>
            <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">Masukkan password untuk melanjutkan</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              className="w-full border border-gray-300 rounded-xl px-4 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl text-lg disabled:opacity-50 hover:bg-blue-700 transition-colors"
            >
              {loading ? "Masuk…" : "Masuk"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <AdminDashboard onLogout={() => setAuthed(false)} />;
}

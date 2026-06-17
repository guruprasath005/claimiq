/**
 * Screen 2 — Scheme Confirm
 * Shown only when insurer could not be auto-detected from the case sheet.
 * Doctor searches and selects the correct insurer + plan.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Insurer {
  slug: string;
  insurer: string;
}

export default function ConfirmPage() {
  const params           = useSearchParams();
  const sessionId        = params.get("session") ?? "";
  const router           = useRouter();

  const [insurers, setInsurers]   = useState<Insurer[]>([]);
  const [query, setQuery]         = useState("");
  const [selected, setSelected]   = useState<string | null>(null);
  const [planName, setPlanName]   = useState("");
  const [loading, setLoading]     = useState(false);

  useEffect(() => {
    fetch("/api/schemes")
      .then((r) => r.json())
      .then((d) => setInsurers(d.insurers ?? []));
  }, []);

  const filtered = insurers.filter((i) =>
    i.insurer.toLowerCase().includes(query.toLowerCase())
  );

  async function handleConfirm() {
    if (!selected) return;
    setLoading(true);

    await fetch("/api/schemes/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        insurer_slug: selected,
        plan_name: planName || null,
      }),
    });

    router.push(`/results?session=${sessionId}&insurer=${selected}`);
  }

  return (
    <main className="min-h-screen flex flex-col items-center gap-6 p-6 bg-slate-50">
      <h1 className="text-xl font-semibold text-slate-800 mt-8">
        Select Insurance Scheme
      </h1>
      <p className="text-slate-500 text-sm -mt-4">
        Could not auto-detect from the case sheet. Please confirm.
      </p>

      <input
        className="w-full max-w-md border rounded-xl px-4 py-3 text-slate-800
                   focus:outline-none focus:ring-2 focus:ring-blue-400"
        placeholder="Search insurer..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <ul className="w-full max-w-md bg-white rounded-2xl shadow divide-y max-h-80 overflow-y-auto">
        {filtered.map((i) => (
          <li
            key={i.slug}
            className={`px-4 py-3 cursor-pointer hover:bg-blue-50 transition-colors
                        ${selected === i.slug ? "bg-blue-100 font-medium" : ""}`}
            onClick={() => setSelected(i.slug)}
          >
            {i.insurer}
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-4 py-3 text-slate-400">No match found</li>
        )}
      </ul>

      {selected && (
        <input
          className="w-full max-w-md border rounded-xl px-4 py-3 text-slate-800
                     focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Plan name (optional, e.g. Medi Classic)"
          value={planName}
          onChange={(e) => setPlanName(e.target.value)}
        />
      )}

      <button
        disabled={!selected || loading}
        onClick={handleConfirm}
        className="w-full max-w-md bg-blue-600 text-white rounded-xl py-3 font-medium
                   disabled:opacity-40 hover:bg-blue-700 transition-colors"
      >
        {loading ? "Processing..." : "Confirm & Evaluate"}
      </button>
    </main>
  );
}

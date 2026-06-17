/**
 * Screen 1 — Capture
 * Doctor/nurse uploads or takes a photo of the case sheet.
 * On success, if insurer was auto-detected → go to /results
 * If not detected → go to /confirm (scheme selection)
 */

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function CapturePage() {
  const inputRef             = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const router               = useRouter();

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);

    const form = new FormData();
    form.append("file", file);

    try {
      const res  = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) throw new Error(data.detail || "Upload failed");

      // Store session in sessionStorage for next screens
      sessionStorage.setItem("session", JSON.stringify(data));

      if (data.insurer_slug) {
        // Scheme auto-detected — go straight to results
        router.push(`/results?session=${data.session_id}&insurer=${data.insurer_slug}`);
      } else {
        // Need doctor to pick scheme
        router.push(`/confirm?session=${data.session_id}`);
      }
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-6 bg-slate-50">
      <h1 className="text-2xl font-semibold text-slate-800">Insurance Claim Assistant</h1>

      <div
        className="w-full max-w-md border-2 border-dashed border-slate-300 rounded-2xl p-12
                   flex flex-col items-center gap-4 cursor-pointer hover:border-blue-400
                   hover:bg-blue-50 transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        <span className="text-5xl">📄</span>
        <p className="text-slate-600 text-center">
          Tap to take a photo or upload the patient case sheet
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>

      {loading && (
        <p className="text-blue-600 animate-pulse">
          Running OCR — extracting patient data...
        </p>
      )}
      {error && <p className="text-red-500">{error}</p>}
    </main>
  );
}

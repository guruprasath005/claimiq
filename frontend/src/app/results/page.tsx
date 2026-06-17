/**
 * Screen 3 — Results
 * Shows: claim verdict, copy-paste paragraph summary, ICD codes, missing items.
 * Triggers /evaluate on mount.
 */

"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

interface IcdCode {
  code: string;
  description: string;
  scheme_covered: boolean;
  restriction_note: string | null;
}

interface Evaluation {
  verdict: "APPROVABLE" | "PARTIAL" | "REJECTED" | "UNKNOWN";
  verdict_reason: string;
  summary_paragraph: string;
  icd_codes: IcdCode[];
  missing_items: string[];
  retrieved_sections: string[];
}

const VERDICT_STYLE: Record<string, string> = {
  APPROVABLE: "bg-green-100 text-green-800 border-green-300",
  PARTIAL:    "bg-yellow-100 text-yellow-800 border-yellow-300",
  REJECTED:   "bg-red-100 text-red-800 border-red-300",
  UNKNOWN:    "bg-slate-100 text-slate-700 border-slate-300",
};

const VERDICT_ICON: Record<string, string> = {
  APPROVABLE: "✅",
  PARTIAL:    "⚠️",
  REJECTED:   "❌",
  UNKNOWN:    "❓",
};

export default function ResultsPage() {
  const params     = useSearchParams();
  const sessionId  = params.get("session") ?? "";
  const insurer    = params.get("insurer") ?? "";
  const router     = useRouter();

  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [copied, setCopied]         = useState(false);

  useEffect(() => {
    if (!sessionId || !insurer) return;

    fetch("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, insurer_slug: insurer }),
    })
      .then((r) => r.json())
      .then((d) => { setEvaluation(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [sessionId, insurer]);

  function copyParagraph() {
    if (!evaluation) return;
    navigator.clipboard.writeText(evaluation.summary_paragraph);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50">
      <p className="text-blue-600 animate-pulse text-lg">Evaluating claim...</p>
      <p className="text-slate-400 text-sm">Searching policy rules · Matching ICD codes · Generating summary</p>
    </main>
  );

  if (error) return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 p-6">
      <p className="text-red-500">{error}</p>
      <button onClick={() => router.push("/")} className="text-blue-600 underline">Start over</button>
    </main>
  );

  if (!evaluation) return null;

  const verdict = evaluation.verdict;

  return (
    <main className="min-h-screen bg-slate-50 p-4 pb-12">
      <div className="max-w-2xl mx-auto flex flex-col gap-5 mt-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-800">Claim Summary</h1>
          <button onClick={() => router.push("/")} className="text-sm text-blue-600 underline">
            New case
          </button>
        </div>

        {/* Verdict */}
        <div className={`border rounded-2xl p-4 ${VERDICT_STYLE[verdict]}`}>
          <p className="text-lg font-bold">
            {VERDICT_ICON[verdict]} {verdict}
          </p>
          <p className="text-sm mt-1">{evaluation.verdict_reason}</p>
        </div>

        {/* Summary paragraph */}
        <div className="bg-white rounded-2xl shadow p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-700">Summary (copy-paste ready)</h2>
            <button
              onClick={copyParagraph}
              className="text-sm bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
            {evaluation.summary_paragraph}
          </p>
        </div>

        {/* Missing items */}
        {evaluation.missing_items.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <h2 className="font-semibold text-amber-800 mb-2">What&apos;s Missing</h2>
            <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
              {evaluation.missing_items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {/* ICD Codes */}
        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="font-semibold text-slate-700 mb-3">ICD-10 Codes</h2>
          <div className="flex flex-col gap-2">
            {evaluation.icd_codes.map((c, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className={`font-mono font-bold ${c.scheme_covered ? "text-green-700" : "text-red-600"}`}>
                  {c.code}
                </span>
                <div>
                  <p className="text-slate-700">{c.description}</p>
                  {c.restriction_note && (
                    <p className="text-amber-600 text-xs mt-0.5">{c.restriction_note}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Source sections (debug / transparency) */}
        <details className="text-xs text-slate-400">
          <summary className="cursor-pointer">Sections retrieved from policy</summary>
          <ul className="mt-2 list-disc list-inside space-y-0.5">
            {evaluation.retrieved_sections.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </details>

      </div>
    </main>
  );
}

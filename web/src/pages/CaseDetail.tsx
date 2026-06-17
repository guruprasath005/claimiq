import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, Check, ChevronDown, ChevronUp, Flag, ThumbsUp } from 'lucide-react'
import { getCase, updateVerdict } from '../api/client'
import type { Case, Verdict } from '../api/types'

const VERDICT_LABEL: Record<Verdict, string> = {
  APPROVABLE: 'Approvable',
  PARTIAL:    'Partial',
  REJECTED:   'Rejected',
  UNKNOWN:    'Pending',
}

const VERDICT_SYMBOL: Record<Verdict, string> = {
  APPROVABLE: '✓',
  PARTIAL:    '~',
  REJECTED:   '✕',
  UNKNOWN:    '○',
}

function MetaField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
      <p className="text-[13px] font-semibold text-gray-900 leading-snug">{value}</p>
    </div>
  )
}

export default function CaseDetail() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [c,       setC]       = useState<Case | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied,  setCopied]  = useState(false)
  const [sectionsOpen, setSectionsOpen] = useState(false)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    if (!id) return
    getCase(id)
      .then(setC)
      .catch(() => setC(null))
      .finally(() => setLoading(false))
  }, [id])

  async function handleVerdict(v: Verdict) {
    if (!c || saving) return
    setSaving(true)
    try {
      const updated = await updateVerdict(c.id, v)
      setC(updated)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  function copy() {
    if (!c?.summary_paragraph) return
    navigator.clipboard.writeText(c.summary_paragraph)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[13px] text-gray-300 font-medium">Loading case…</p>
      </div>
    )
  }

  if (!c) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-gray-400 text-sm">Case not found.</p>
        <button onClick={() => navigate('/')} className="text-[13px] font-medium text-gray-900 underline">
          Back to dashboard
        </button>
      </div>
    )
  }

  const initials = (c.patient_name ?? '??').split(' ').map(n => n[0]).join('').slice(0, 2)

  return (
    <div className="flex flex-col gap-5 max-w-6xl mx-auto">

      {/* ── Back nav ─────────────────────────────────────────────────────── */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-[12px] font-medium text-gray-400 hover:text-gray-900 transition-colors w-fit"
      >
        <ArrowLeft size={13} strokeWidth={2.5} /> Dashboard
      </button>

      {/* ── Main layout: left panel + right content ───────────────────────── */}
      <div className="flex gap-5 items-start">

        {/* ── Left panel (sticky) ─────────────────────────────────────────── */}
        <div
          className="w-72 shrink-0 bg-white rounded-2xl flex flex-col"
          style={{ border: '1px solid #EBEBEB', position: 'sticky', top: 24 }}
        >
          {/* Avatar + name */}
          <div className="px-7 pt-8 pb-6" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <div className="w-14 h-14 rounded-full bg-gray-900 flex items-center justify-center mb-4">
              <span className="text-white text-[17px] font-bold">{initials}</span>
            </div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">{c.id}</p>
            <h2 className="text-[20px] font-extrabold text-gray-900 leading-tight tracking-tight">
              {c.patient_name ?? '—'}
            </h2>
            <p className="text-[12px] text-gray-400 font-medium mt-1">
              {c.age ? `${c.age}y` : '—'} · {c.gender === 'M' ? 'Male' : c.gender === 'F' ? 'Female' : '—'}
            </p>

            {/* Verdict */}
            <div className="mt-5 flex items-baseline gap-2">
              <span className="text-[22px] font-extrabold text-gray-900 leading-none">
                {VERDICT_SYMBOL[c.verdict]}
              </span>
              <span className="text-[15px] font-bold text-gray-900">
                {VERDICT_LABEL[c.verdict]}
              </span>
            </div>
            {c.verdict_reason && (
              <p className="text-[11px] text-gray-400 leading-snug mt-1.5">{c.verdict_reason}</p>
            )}
          </div>

          {/* Meta fields */}
          <div className="px-7 py-6 flex flex-col gap-5" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <MetaField label="Department"  value={c.department} />
            <MetaField label="Doctor"      value={c.treating_doctor} />
            <MetaField label="Insurer"     value={c.insurer} />
            <MetaField label="Plan"        value={c.plan_name} />
            <MetaField label="Policy No."  value={c.policy_number} />
            <MetaField label="TPA"         value={c.tpa_name} />
            <MetaField label="Sum Insured" value={c.sum_insured} />
          </div>

          {/* Dates */}
          <div className="px-7 py-6 grid grid-cols-2 gap-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <MetaField label="Admitted"   value={c.admission_date} />
            <MetaField label="Discharged" value={c.discharge_date ?? 'Ongoing'} />
          </div>

          {/* Action buttons */}
          <div className="px-7 py-5 flex flex-col gap-2">
            <button
              disabled={saving}
              onClick={() => handleVerdict(c.verdict === 'APPROVABLE' ? 'UNKNOWN' : 'APPROVABLE')}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-full text-[12px] font-bold border transition-all disabled:opacity-50
                ${c.verdict === 'APPROVABLE'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-800 hover:text-gray-900'
                }`}
            >
              <ThumbsUp size={12} strokeWidth={2.5} />
              {c.verdict === 'APPROVABLE' ? 'Approved' : 'Approve Claim'}
            </button>
            <button
              disabled={saving}
              onClick={() => handleVerdict(c.verdict === 'REJECTED' ? 'UNKNOWN' : 'REJECTED')}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-full text-[12px] font-bold border transition-all disabled:opacity-50
                ${c.verdict === 'REJECTED'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-800 hover:text-gray-900'
                }`}
            >
              <Flag size={12} strokeWidth={2.5} />
              {c.verdict === 'REJECTED' ? 'Flagged' : 'Flag for Review'}
            </button>
          </div>
        </div>

        {/* ── Right content ────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">

          {/* Diagnosis & Procedures */}
          <div className="bg-white rounded-2xl px-8 py-6" style={{ border: '1px solid #EBEBEB' }}>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">
              Diagnosis & Procedures
            </p>
            <div className="flex flex-col gap-1.5">
              {c.diagnosis.map((d, i) => (
                <p key={i} className="text-[15px] font-semibold text-gray-900">{d}</p>
              ))}
              <div className="mt-1 flex flex-wrap gap-x-4">
                {c.procedures.map((p, i) => (
                  <p key={i} className="text-[13px] text-gray-400">{p}</p>
                ))}
              </div>
            </div>
          </div>

          {/* TPA Summary paragraph */}
          {c.summary_paragraph && (
            <div className="bg-white rounded-2xl px-8 py-6" style={{ border: '1px solid #EBEBEB' }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  TPA Summary Paragraph
                </p>
                <button
                  onClick={copy}
                  className="flex items-center gap-1.5 text-[11px] font-bold px-3.5 py-1.5 rounded-full bg-gray-900 text-white hover:bg-gray-700 transition-colors"
                >
                  {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                </button>
              </div>
              <p className="text-[14px] text-gray-600 leading-[1.8]">
                {c.summary_paragraph}
              </p>
            </div>
          )}

          {/* ICD-10 codes */}
          {c.icd_codes.length > 0 && (
            <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #EBEBEB' }}>
              <div className="px-8 py-5" style={{ borderBottom: '1px solid #F3F4F6' }}>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">ICD-10 Codes</p>
              </div>
              <div>
                {c.icd_codes.map((icd, i) => (
                  <div
                    key={i}
                    className="grid px-8 py-4 items-start"
                    style={{
                      gridTemplateColumns: '90px 1fr auto',
                      gap: '16px',
                      ...(i < c.icd_codes.length - 1 ? { borderBottom: '1px solid #F9FAFB' } : {}),
                    }}
                  >
                    <span className="font-mono text-[13px] font-bold text-gray-900">{icd.code}</span>
                    <div>
                      <p className="text-[13px] font-medium text-gray-800">{icd.description}</p>
                      {icd.restriction_note && (
                        <p className="text-[11px] text-gray-400 mt-0.5">{icd.restriction_note}</p>
                      )}
                    </div>
                    <span className="text-[11px] font-bold text-gray-400 shrink-0">
                      {icd.scheme_covered ? '✓ Covered' : '✕ Excluded'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Missing items */}
          {c.missing_items.length > 0 && (
            <div className="bg-white rounded-2xl px-8 py-6" style={{ border: '1px solid #EBEBEB' }}>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-5">
                Missing Items
              </p>
              <ol className="flex flex-col gap-4">
                {c.missing_items.map((item, i) => (
                  <li key={i} className="flex items-start gap-4">
                    <span className="font-mono text-[10px] font-bold text-gray-300 mt-0.5 shrink-0 pt-0.5">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <p className="text-[14px] text-gray-700 leading-snug">{item}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Policy sections consulted */}
          {c.retrieved_sections.length > 0 && (
            <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #EBEBEB' }}>
              <button
                onClick={() => setSectionsOpen(!sectionsOpen)}
                className="w-full flex items-center justify-between px-8 py-5 hover:bg-gray-50 transition-colors"
              >
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Policy Sections Consulted
                  <span className="ml-2 normal-case tracking-normal font-medium text-gray-300">
                    {c.retrieved_sections.length} sources
                  </span>
                </p>
                {sectionsOpen
                  ? <ChevronUp size={13} className="text-gray-300" strokeWidth={2.5} />
                  : <ChevronDown size={13} className="text-gray-300" strokeWidth={2.5} />
                }
              </button>

              {sectionsOpen && (
                <div className="px-8 pb-6" style={{ borderTop: '1px solid #F3F4F6' }}>
                  <div className="grid grid-cols-2 gap-x-10 gap-y-2.5 pt-5">
                    {c.retrieved_sections.map((s, i) => (
                      <p key={i} className="text-[12px] text-gray-500 flex items-center gap-2.5">
                        <span className="font-mono text-[10px] text-gray-300 shrink-0">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        {s}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

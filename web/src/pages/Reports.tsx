import { useState, useEffect } from 'react'
import { getReports } from '../api/client'
import type { ReportData, MonthData, InsurerStat, RejectionReason } from '../api/types'

// ── Ring chart ────────────────────────────────────────────────────────────────

const R  = 68
const SW = 14
const CX = 100
const CY = 100
const C  = 2 * Math.PI * R

function RingChart({ data, total, approvalRate }: {
  data: { approvable: number; partial: number; rejected: number; unknown: number }
  total: number
  approvalRate: number
}) {
  const segments = [
    { value: data.approvable, fill: '#111827', label: 'Approvable' },
    { value: data.partial,    fill: '#6b7280', label: 'Partial'    },
    { value: data.rejected,   fill: '#d1d5db', label: 'Rejected'   },
    { value: data.unknown,    fill: '#e5e7eb', label: 'Pending'    },
  ]

  let accumulated = 0
  return (
    <div className="flex items-center gap-8">
      <svg viewBox="0 0 200 200" className="w-44 h-44 shrink-0">
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#F3F4F6" strokeWidth={SW} />
        {segments.map(seg => {
          const dash   = total > 0 ? (seg.value / total) * C : 0
          const offset = C - accumulated * (total > 0 ? C / total : 0)
          accumulated += seg.value
          if (seg.value === 0) return null
          return (
            <circle
              key={seg.label}
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke={seg.fill}
              strokeWidth={SW}
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={offset}
              strokeLinecap="butt"
              style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
            />
          )
        })}
        <text x={CX} y={CY - 6} textAnchor="middle" fontSize={26} fontWeight="800" fill="#111827">
          {approvalRate}%
        </text>
        <text x={CX} y={CY + 14} textAnchor="middle" fontSize={10} fontWeight="600" fill="#9ca3af"
          style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Approved
        </text>
      </svg>

      <div className="flex flex-col gap-3.5">
        {segments.map(s => (
          <div key={s.label} className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.fill }} />
            <div>
              <p className="text-[13px] font-semibold text-gray-900 leading-none">{s.label}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {s.value} case{s.value !== 1 ? 's' : ''} · {total > 0 ? Math.round(s.value / total * 100) : 0}%
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Monthly trend ─────────────────────────────────────────────────────────────

const LW = 460; const LH = 100; const LPX = 20; const LPY = 12
const LIW = LW - LPX * 2; const LIH = LH - LPY * 2

function MonthlyChart({ monthly }: { monthly: MonthData[] }) {
  if (monthly.length === 0) {
    return (
      <div className="flex items-center justify-center h-24">
        <p className="text-[12px] text-gray-300">No data yet</p>
      </div>
    )
  }

  const maxM = Math.max(...monthly.map(d => d.cases), 1)
  const step = LIW / Math.max(monthly.length - 1, 1)

  function mpt(i: number, val: number) {
    return { x: LPX + i * step, y: LPY + LIH - (val / maxM) * LIH }
  }

  const totalPts    = monthly.map((d, i) => mpt(i, d.cases))
  const approvedPts = monthly.map((d, i) => mpt(i, d.approved))

  const line = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  const area = (pts: { x: number; y: number }[]) =>
    `${line(pts)} L ${pts[pts.length - 1].x} ${LPY + LIH} L ${pts[0].x} ${LPY + LIH} Z`

  return (
    <svg viewBox={`0 0 ${LW} ${LH + 24}`} className="w-full" style={{ overflow: 'visible' }}>
      {[0, 0.5, 1].map(t => (
        <line key={t}
          x1={LPX} y1={LPY + LIH - t * LIH}
          x2={LPX + LIW} y2={LPY + LIH - t * LIH}
          stroke="#F3F4F6" strokeWidth={1}
        />
      ))}
      <path d={area(totalPts)} fill="#F9FAFB" />
      <path d={line(totalPts)} fill="none" stroke="#E5E7EB" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <path d={area(approvedPts)} fill="#F3F4F6" />
      <path d={line(approvedPts)} fill="none" stroke="#111827" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {monthly.map((d, i) => {
        const tp = totalPts[i]
        const ap = approvedPts[i]
        const isLast = i === monthly.length - 1
        return (
          <g key={d.month}>
            <circle cx={tp.x} cy={tp.y} r={3} fill="#fff" stroke="#D1D5DB" strokeWidth={1.5} />
            <circle cx={ap.x} cy={ap.y} r={3.5}
              fill={isLast ? '#111827' : '#fff'}
              stroke="#111827" strokeWidth={isLast ? 0 : 1.8}
            />
            {isLast && (
              <text x={ap.x + 6} y={ap.y + 4} fontSize={10} fontWeight="700" fill="#111827">
                {d.approved}
              </text>
            )}
            <text x={tp.x} y={LH + 16} textAnchor="middle"
              fill={isLast ? '#111827' : '#9ca3af'}
              fontSize={11} fontWeight={isLast ? '700' : '500'}>
              {d.month}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

const EMPTY_REPORT: ReportData = {
  total: 0, approval_rate: 0, approved_value: '—', avg_tat: '—',
  verdict_counts: { approvable: 0, partial: 0, rejected: 0, unknown: 0 },
  monthly: [], insurer_stats: [], rejection_reasons: [],
}

export default function Reports() {
  const [report,  setReport]  = useState<ReportData>(EMPTY_REPORT)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getReports()
      .then(setReport)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const { total, approval_rate, approved_value, avg_tat,
          verdict_counts, monthly, insurer_stats, rejection_reasons } = report

  return (
    <div className="flex flex-col gap-5 max-w-6xl mx-auto">

      {/* ── Stat strip ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Processed', value: loading ? '—' : String(total),        sub: 'this month' },
          { label: 'Total Approved',  value: loading ? '—' : approved_value,        sub: 'claim value' },
          { label: 'Approval Rate',   value: loading ? '—' : `${approval_rate}%`,  sub: 'cases approved' },
          { label: 'Avg. TAT',        value: loading ? '—' : avg_tat,              sub: 'turnaround time' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl px-6 py-5" style={{ border: '1px solid #EBEBEB' }}>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">{s.label}</p>
            <p className="text-[30px] font-extrabold text-gray-900 leading-none">{s.value}</p>
            <p className="text-[11px] text-gray-400 font-medium mt-1.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Verdict ring + Monthly trend ─────────────────────────────────── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1.8fr' }}>

        {/* Ring chart */}
        <div className="bg-white rounded-2xl p-7" style={{ border: '1px solid #EBEBEB' }}>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6">
            Verdict Breakdown
          </p>
          {loading ? (
            <div className="flex items-center justify-center h-36">
              <p className="text-[12px] text-gray-300">Loading…</p>
            </div>
          ) : (
            <RingChart data={verdict_counts} total={total} approvalRate={approval_rate} />
          )}
        </div>

        {/* Monthly trend */}
        <div className="bg-white rounded-2xl px-8 py-7" style={{ border: '1px solid #EBEBEB' }}>
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                Monthly Trend
              </p>
              <p className="text-[12px] text-gray-400 font-medium">
                Last 6 months — dark line = approved, gray = total
              </p>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-gray-400 font-medium">
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-[2px] bg-gray-900 rounded inline-block" /> Approved
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-[2px] bg-gray-300 rounded inline-block" /> Total
              </span>
            </div>
          </div>
          <MonthlyChart monthly={monthly} />
        </div>
      </div>

      {/* ── Insurer table + Rejection reasons ───────────────────────────── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1.5fr 1fr' }}>

        {/* Insurer performance */}
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #EBEBEB' }}>
          <div className="px-7 py-5" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Insurer Performance
            </p>
          </div>

          <div
            className="grid px-7 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest"
            style={{ gridTemplateColumns: '1.4fr 50px 60px 60px 55px', background: '#FAFAFA', borderBottom: '1px solid #F3F4F6' }}
          >
            {['Insurer', 'Cases', 'Rate', 'Avg Claim', 'TAT'].map(h => (
              <span key={h}>{h}</span>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <p className="text-[12px] text-gray-300">Loading…</p>
            </div>
          ) : insurer_stats.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <p className="text-[12px] text-gray-300">No data yet</p>
            </div>
          ) : (
            insurer_stats.map((row: InsurerStat, i: number) => {
              const rate = row.cases > 0 ? Math.round((row.approved / row.cases) * 100) : 0
              const isLast = i === insurer_stats.length - 1
              return (
                <div
                  key={`${row.insurer}-${i}`}
                  className="grid px-7 py-4 items-center"
                  style={{
                    gridTemplateColumns: '1.4fr 50px 60px 60px 55px',
                    ...(!isLast ? { borderBottom: '1px solid #F9FAFB' } : {}),
                  }}
                >
                  <div>
                    <p className="text-[13px] font-semibold text-gray-900">{row.insurer}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{row.plan}</p>
                  </div>
                  <p className="text-[13px] font-medium text-gray-700">{row.cases}</p>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1 rounded-full bg-gray-100 overflow-hidden max-w-[28px]">
                      <div className="h-full bg-gray-900 rounded-full" style={{ width: `${rate}%` }} />
                    </div>
                    <span className="text-[12px] font-bold text-gray-900">{rate}%</span>
                  </div>
                  <p className="text-[13px] font-medium text-gray-700">{row.avgClaim}</p>
                  <p className="text-[13px] font-medium text-gray-500">{row.tat}</p>
                </div>
              )
            })
          )}
        </div>

        {/* Rejection reasons */}
        <div className="bg-white rounded-2xl p-7" style={{ border: '1px solid #EBEBEB' }}>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6">
            Top Rejection Reasons
          </p>
          {loading ? (
            <div className="flex items-center justify-center h-20">
              <p className="text-[12px] text-gray-300">Loading…</p>
            </div>
          ) : rejection_reasons.length === 0 ? (
            <p className="text-[12px] text-gray-300">No rejections yet</p>
          ) : (
            <div className="flex flex-col gap-5">
              {rejection_reasons.map((r: RejectionReason, i: number) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-medium text-gray-800 leading-snug max-w-[180px]">
                      {r.reason}
                    </p>
                    <span className="text-[12px] font-bold text-gray-900 shrink-0 ml-3">{r.pct}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gray-900 rounded-full transition-all"
                      style={{ width: `${r.pct}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-400">{r.count} cases</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

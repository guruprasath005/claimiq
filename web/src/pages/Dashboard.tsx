import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, ArrowUpRight } from 'lucide-react'
import { getCases, getCaseStats } from '../api/client'
import type { Case, CaseStats, WeekDay, Verdict } from '../api/types'

const VERDICT_META: Record<Verdict, { label: string; symbol: string; textClass: string }> = {
  APPROVABLE: { label: 'Approvable', symbol: '✓', textClass: 'text-gray-900' },
  PARTIAL:    { label: 'Partial',    symbol: '~', textClass: 'text-gray-500' },
  REJECTED:   { label: 'Rejected',   symbol: '✕', textClass: 'text-gray-400' },
  UNKNOWN:    { label: 'Pending',    symbol: '○', textClass: 'text-gray-400' },
}

function VerdictTag({ verdict }: { verdict: Verdict }) {
  const { label, symbol, textClass } = VERDICT_META[verdict]
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold tracking-wide ${textClass}`}>
      <span className="text-[10px]">{symbol}</span>
      {label}
    </span>
  )
}

// ── Line chart ────────────────────────────────────────────────────────────────

const CW = 560; const CH = 110; const PAD_X = 24; const PAD_Y = 18
const IW = CW - PAD_X * 2; const IH = CH - PAD_Y * 2

function LineChart({ weekly }: { weekly: WeekDay[] }) {
  const maxT = Math.max(...weekly.map(d => d.total), 1)
  const step = IW / Math.max(weekly.length - 1, 1)

  function pt(i: number, val: number) {
    return { x: PAD_X + i * step, y: PAD_Y + IH - (val / maxT) * IH }
  }

  const points = weekly.map((d, i) => pt(i, d.total))
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${PAD_Y + IH} L ${points[0].x} ${PAD_Y + IH} Z`

  const peakTotal = Math.max(...weekly.map(d => d.total))

  return (
    <svg viewBox={`0 0 ${CW} ${CH + 28}`} className="w-full" style={{ overflow: 'visible' }}>
      {[0, 0.5, 1].map(t => (
        <line key={t} x1={PAD_X} y1={PAD_Y + IH - t * IH} x2={PAD_X + IW} y2={PAD_Y + IH - t * IH}
          stroke="#F3F4F6" strokeWidth={1} />
      ))}
      <path d={areaPath} fill="#F9FAFB" />
      <path d={linePath} fill="none" stroke="#111827" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      {weekly.map((d, i) => {
        const { x, y } = points[i]
        const isToday = d.day === 'Today'
        const isPeak  = d.total === peakTotal && peakTotal > 0
        return (
          <g key={d.day}>
            <circle cx={x} cy={y} r={isToday ? 5 : 3.5}
              fill={isToday ? '#111827' : '#fff'} stroke="#111827"
              strokeWidth={isToday ? 0 : 1.8} />
            {(isPeak || isToday) && d.total > 0 && (
              <text x={x} y={y - 10} textAnchor="middle" fill="#111827" fontSize={10} fontWeight="700">
                {d.pct}%
              </text>
            )}
            <text x={x} y={CH + 16} textAnchor="middle"
              fill={isToday ? '#111827' : '#9ca3af'} fontSize={11}
              fontWeight={isToday ? '700' : '500'}>
              {d.day}
            </text>
            {!isPeak && !isToday && d.total > 0 && (
              <text x={x} y={y - 8} textAnchor="middle" fill="#d1d5db" fontSize={9} fontWeight="600">
                {d.total}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

const WEEKLY_EMPTY: WeekDay[] = ['Mon','Tue','Wed','Thu','Fri','Sat','Today']
  .map(day => ({ day, total: 0, pct: 0 }))

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate()
  const [cases,   setCases]   = useState<Case[]>([])
  const [stats,   setStats]   = useState<CaseStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getCases({ limit: 10 }), getCaseStats()])
      .then(([c, s]) => { setCases(c); setStats(s) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const weekly = stats?.weekly ?? WEEKLY_EMPTY
  const peakDay = weekly.reduce((a, b) => b.total > a.total ? b : a, weekly[0])

  return (
    <div className="flex flex-col gap-5">

      {/* ── Row 1: Hero + chart ──────────────────────────────────────────────── */}
      <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 1.7fr' }}>

        {/* Hero */}
        <div className="bg-white rounded-2xl p-8 flex flex-col justify-between" style={{ border: '1px solid #EBEBEB' }}>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-5">
              Approved This Month
            </p>
            <p className="text-[58px] font-extrabold text-gray-900 leading-none tracking-tight">
              {loading ? '—' : `${stats?.approvable ?? 0}`}
            </p>
            <div className="flex items-center gap-1.5 mt-4">
              <TrendingUp size={13} strokeWidth={2.5} className="text-gray-400" />
              <span className="text-[12px] font-medium text-gray-500">
                {loading ? 'Loading…' : 'cases approved this month'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-6 mt-6" style={{ borderTop: '1px solid #F3F4F6' }}>
            <div>
              <p className="text-[22px] font-extrabold text-gray-900 leading-none">
                {loading ? '—' : stats?.total ?? 0}
              </p>
              <p className="text-[11px] text-gray-400 font-medium mt-1.5">Cases</p>
            </div>
            <div>
              <p className="text-[22px] font-extrabold text-gray-900 leading-none">—</p>
              <p className="text-[11px] text-gray-400 font-medium mt-1.5">Avg. TAT</p>
            </div>
            <div>
              <p className="text-[22px] font-extrabold text-gray-900 leading-none">
                {loading ? '—' : `${stats?.rejection_pct ?? 0}%`}
              </p>
              <p className="text-[11px] text-gray-400 font-medium mt-1.5">Rejection</p>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white rounded-2xl p-8" style={{ border: '1px solid #EBEBEB' }}>
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-[15px] font-bold text-gray-900">Weekly Volume</p>
              <p className="text-[12px] text-gray-400 font-medium mt-0.5">
                Cases per day · % = approval rate
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-gray-400 font-medium">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-[2px] bg-gray-900 rounded" /> Volume
              </span>
              {peakDay.total > 0 && (
                <span>Peak: {peakDay.day} ({peakDay.total})</span>
              )}
            </div>
          </div>
          <LineChart weekly={weekly} />
        </div>
      </div>

      {/* ── Recent Cases ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #EBEBEB' }}>

        <div className="flex items-baseline justify-between px-8 py-5" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <p className="text-[15px] font-bold text-gray-900">Recent Cases</p>
          <p className="text-[12px] text-gray-400 font-medium">
            {loading ? 'Loading…' : `${cases.length} submissions`}
          </p>
        </div>

        <div className="grid px-8 py-2.5"
          style={{ gridTemplateColumns: '2fr 1.2fr 1fr 100px 80px', borderBottom: '1px solid #F9FAFB', background: '#FAFAFA' }}>
          {['Patient','Diagnosis','Insurer','Verdict','Date'].map(h => (
            <p key={h} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{h}</p>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-[13px] text-gray-300 font-medium">Loading cases…</p>
          </div>
        ) : cases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-[18px] font-extrabold text-gray-200">No cases yet</p>
            <p className="text-[12px] text-gray-400">Cases appear here after evaluation</p>
          </div>
        ) : (
          <ul>
            {cases.map((c, idx) => {
              const initials = (c.patient_name ?? '??').split(' ').map(n => n[0]).join('').slice(0, 2)
              const time = new Date(c.submitted_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
              const date = new Date(c.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
              const isLast = idx === cases.length - 1
              return (
                <li key={c.id}
                  onClick={() => navigate(`/case/${c.id}`)}
                  className="group grid px-8 py-4 cursor-pointer hover:bg-[#FAFBFF] transition-colors items-center"
                  style={{ gridTemplateColumns: '2fr 1.2fr 1fr 100px 80px', ...(!isLast ? { borderBottom: '1px solid #F9FAFB' } : {}) }}>

                  <div className="flex items-center gap-3.5">
                    <div className="w-9 h-9 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
                      <span className="text-white text-[11px] font-bold">{initials}</span>
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-gray-900 leading-none">{c.patient_name ?? '—'}</p>
                      <p className="text-[12px] text-gray-400 mt-1">
                        {c.age ? `${c.age}y` : '—'} · {c.gender === 'M' ? 'Male' : c.gender === 'F' ? 'Female' : '—'}
                      </p>
                    </div>
                  </div>

                  <p className="text-[13px] text-gray-600 truncate pr-4">{c.diagnosis[0] ?? '—'}</p>

                  <div className="pr-4">
                    <p className="text-[13px] font-medium text-gray-700 truncate">{c.insurer ?? '—'}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5 truncate">{c.plan_name ?? ''}</p>
                  </div>

                  <VerdictTag verdict={c.verdict} />

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[12px] font-medium text-gray-700">{date}</p>
                      <p className="text-[11px] text-gray-400">{time}</p>
                    </div>
                    <ArrowUpRight size={14} strokeWidth={2}
                      className="text-gray-200 group-hover:text-gray-500 transition-colors" />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

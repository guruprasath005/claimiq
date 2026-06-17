import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ArrowUpRight, SlidersHorizontal } from 'lucide-react'
import { getCases } from '../api/client'
import type { Case, Verdict } from '../api/types'

const VERDICT_META: Record<Verdict, { label: string; symbol: string }> = {
  APPROVABLE: { label: 'Approvable', symbol: '✓' },
  PARTIAL:    { label: 'Partial',    symbol: '~' },
  REJECTED:   { label: 'Rejected',   symbol: '✕' },
  UNKNOWN:    { label: 'Pending',    symbol: '○' },
}

const VERDICT_FILTERS: { label: string; value: Verdict | 'ALL' }[] = [
  { label: 'All',        value: 'ALL' },
  { label: 'Approvable', value: 'APPROVABLE' },
  { label: 'Partial',    value: 'PARTIAL' },
  { label: 'Rejected',   value: 'REJECTED' },
  { label: 'Pending',    value: 'UNKNOWN' },
]

const SORT_OPTIONS = [
  { label: 'Newest first', value: 'newest' },
  { label: 'Oldest first', value: 'oldest' },
  { label: 'Patient A–Z',  value: 'name' },
]

export default function Cases() {
  const navigate = useNavigate()
  const [cases,   setCases]   = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [verdict, setVerdict] = useState<Verdict | 'ALL'>('ALL')
  const [insurer, setInsurer] = useState('All')
  const [sort,    setSort]    = useState('newest')
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    getCases()
      .then(setCases)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const ALL_INSURERS = useMemo(
    () => ['All', ...Array.from(new Set(cases.map(c => c.insurer).filter(Boolean) as string[]))],
    [cases]
  )

  const filtered = useMemo(() => {
    let list = [...cases]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        (c.patient_name ?? '').toLowerCase().includes(q) ||
        (c.diagnosis[0] ?? '').toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
      )
    }

    if (verdict !== 'ALL') list = list.filter(c => c.verdict === verdict)
    if (insurer !== 'All') list = list.filter(c => c.insurer === insurer)

    list.sort((a, b) => {
      if (sort === 'newest') return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
      if (sort === 'oldest') return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
      return (a.patient_name ?? '').localeCompare(b.patient_name ?? '')
    })

    return list
  }, [cases, search, verdict, insurer, sort])

  return (
    <div className="flex flex-col gap-5 max-w-6xl mx-auto">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">
            {loading ? 'Loading…' : `${filtered.length} of ${cases.length} cases`}
          </p>
        </div>

        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className={`flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-full border transition-all
            ${filtersOpen
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-900'
            }`}
        >
          <SlidersHorizontal size={12} strokeWidth={2.5} />
          Filters
        </button>
      </div>

      {/* ── Search + filters ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #EBEBEB' }}>

        {/* Search */}
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <Search size={15} className="text-gray-300 shrink-0" strokeWidth={2} />
          <input
            type="text"
            placeholder="Search by patient name, diagnosis, or case ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 text-[14px] text-gray-900 placeholder-gray-300 outline-none bg-transparent font-medium"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-[11px] font-semibold text-gray-400 hover:text-gray-700 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Verdict filter tabs */}
        <div className="flex items-center gap-1 px-5 py-3" style={{ borderBottom: filtersOpen ? '1px solid #F3F4F6' : 'none' }}>
          {VERDICT_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setVerdict(f.value)}
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all
                ${verdict === f.value
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Extended filters */}
        {filtersOpen && (
          <div className="flex items-center gap-6 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Insurer</p>
              <select
                value={insurer}
                onChange={e => setInsurer(e.target.value)}
                className="text-[13px] font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 outline-none hover:border-gray-400 transition-colors"
              >
                {ALL_INSURERS.map(i => <option key={i}>{i}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2.5">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Sort</p>
              <select
                value={sort}
                onChange={e => setSort(e.target.value)}
                className="text-[13px] font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 outline-none hover:border-gray-400 transition-colors"
              >
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {(insurer !== 'All' || sort !== 'newest') && (
              <button
                onClick={() => { setInsurer('All'); setSort('newest') }}
                className="text-[11px] font-semibold text-gray-400 hover:text-gray-700 ml-auto transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Cases list ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #EBEBEB' }}>

        {/* Column headers */}
        <div
          className="grid px-8 py-3"
          style={{
            gridTemplateColumns: '2fr 1.4fr 1.2fr 90px 90px 40px',
            background: '#FAFAFA',
            borderBottom: '1px solid #F3F4F6',
          }}
        >
          {['Patient', 'Diagnosis', 'Insurer', 'Verdict', 'Date', ''].map(h => (
            <p key={h} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{h}</p>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-[13px] text-gray-300 font-medium">Loading cases…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <p className="text-[22px] font-extrabold text-gray-200">
              {cases.length === 0 ? 'No cases yet' : 'No cases found'}
            </p>
            <p className="text-[13px] text-gray-400">
              {cases.length === 0 ? 'Cases appear after evaluation' : 'Try adjusting your search or filters'}
            </p>
          </div>
        ) : (
          <ul>
            {filtered.map((c, idx) => {
              const initials = (c.patient_name ?? '??').split(' ').map(n => n[0]).join('').slice(0, 2)
              const time     = new Date(c.submitted_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
              const date     = new Date(c.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
              const isLast   = idx === filtered.length - 1
              const { label, symbol } = VERDICT_META[c.verdict]

              return (
                <li
                  key={c.id}
                  onClick={() => navigate(`/case/${c.id}`)}
                  className="group grid px-8 py-4 cursor-pointer hover:bg-[#FAFBFF] transition-colors items-center"
                  style={{
                    gridTemplateColumns: '2fr 1.4fr 1.2fr 90px 90px 40px',
                    ...(!isLast ? { borderBottom: '1px solid #F9FAFB' } : {}),
                  }}
                >
                  {/* Patient */}
                  <div className="flex items-center gap-3.5">
                    <div className="w-9 h-9 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
                      <span className="text-white text-[11px] font-bold">{initials}</span>
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-gray-900 leading-none">{c.patient_name ?? '—'}</p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {c.age ? `${c.age}y` : '—'} · {c.gender === 'M' ? 'Male' : c.gender === 'F' ? 'Female' : '—'} · {c.id}
                      </p>
                    </div>
                  </div>

                  {/* Diagnosis */}
                  <div className="pr-4">
                    <p className="text-[13px] text-gray-700 truncate">{c.diagnosis[0] ?? '—'}</p>
                    {c.diagnosis.length > 1 && (
                      <p className="text-[11px] text-gray-400 mt-0.5">+{c.diagnosis.length - 1} more</p>
                    )}
                  </div>

                  {/* Insurer */}
                  <div className="pr-4">
                    <p className="text-[13px] font-medium text-gray-700 truncate">{c.insurer ?? '—'}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5 truncate">{c.plan_name ?? ''}</p>
                  </div>

                  {/* Verdict */}
                  <p className="text-[12px] font-semibold text-gray-700">
                    <span className="text-[10px] mr-1">{symbol}</span>{label}
                  </p>

                  {/* Date */}
                  <div>
                    <p className="text-[12px] font-medium text-gray-700">{date}</p>
                    <p className="text-[11px] text-gray-400">{time}</p>
                  </div>

                  {/* Arrow */}
                  <ArrowUpRight
                    size={14}
                    strokeWidth={2}
                    className="text-gray-200 group-hover:text-gray-500 transition-colors"
                  />
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

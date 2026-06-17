import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2, XCircle, AlertTriangle, ArrowRight, Loader2,
  X, Paperclip, ScanLine, FileWarning, Plus, Trash2,
  ClipboardList, FolderDown, FilePlus2,
} from 'lucide-react'
import { uploadCase, evaluateCase, getSchemes } from '../api/client'
import type { OcrResult, ClaimEvaluation, FullExtraction, InsurerOption, Verdict, TokenUsage } from '../api/types'

// ── Fonts & global styles ─────────────────────────────────────────────────────

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;0,9..144,700;1,9..144,300&family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap');

.nc-root { font-family: 'DM Sans', sans-serif; color: #0F1F3D; }
.nc-root * { box-sizing: border-box; }

@keyframes nc-fade-up  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
@keyframes nc-reveal   { from { opacity:0; transform:translateY(5px); }  to { opacity:1; transform:translateY(0); } }
@keyframes nc-bar-fill { from { width:0%; } }
@keyframes nc-scan     { 0%,100% { top:0%; } 50% { top:88%; } }
@keyframes spin        { to { transform:rotate(360deg); } }

.nc-fade-up  { animation: nc-fade-up  0.4s ease both; }
.nc-reveal   { animation: nc-reveal   0.35s ease both; }
.nc-spin     { animation: spin 1s linear infinite; }
.nc-bar-fill { animation: nc-bar-fill 0.8s cubic-bezier(.22,1,.36,1) both; }

.d1{animation-delay:.05s} .d2{animation-delay:.10s} .d3{animation-delay:.15s}
.d4{animation-delay:.20s} .d5{animation-delay:.25s} .d6{animation-delay:.30s}
.d7{animation-delay:.35s} .d8{animation-delay:.40s}

/* Field row dividers */
.nc-field-row + .nc-field-row { border-top: 1px solid #F1F5F9; }

/* Shared input style */
.nc-fi {
  font-family:'DM Sans',sans-serif; font-size:13px; color:#0F1F3D;
  background:#fff; border:1.5px solid #E2E8F0; border-radius:7px;
  padding:7px 10px; width:100%; outline:none; transition:border-color .15s;
  resize:none;
}
.nc-fi:focus { border-color:#2563EB; }
.nc-fi::placeholder { color:#CBD5E1; }
.nc-fi:read-only { background:#F8FAFD; color:#64748B; border-color:transparent; }

/* Tag badge */
.nc-tag {
  display:inline-flex; align-items:center; gap:5px;
  background:#F1F5F9; border:1px solid #E2E8F0; border-radius:6px;
  padding:3px 8px 3px 10px; font-size:12px; color:#334155;
}

/* Buttons */
.nc-btn-primary {
  display:inline-flex; align-items:center; justify-content:center; gap:8px;
  background:#0F1F3D; color:#fff; font-family:'DM Sans',sans-serif;
  font-size:13px; font-weight:600; padding:12px 28px; border-radius:8px;
  border:none; cursor:pointer; transition:background .15s,transform .1s,box-shadow .15s;
  box-shadow:0 1px 3px rgba(15,31,61,.2);
}
.nc-btn-primary:hover:not(:disabled) { background:#1a3260; transform:translateY(-1px); box-shadow:0 4px 14px rgba(15,31,61,.25); }
.nc-btn-primary:disabled { opacity:.38; cursor:not-allowed; }

.nc-btn-ghost {
  display:inline-flex; align-items:center; gap:6px;
  background:transparent; color:#475569; font-family:'DM Sans',sans-serif;
  font-size:13px; font-weight:500; padding:11px 20px; border-radius:8px;
  border:1.5px solid #E2E8F0; cursor:pointer; transition:all .15s;
}
.nc-btn-ghost:hover { border-color:#0F1F3D; color:#0F1F3D; }

.nc-btn-icon {
  display:inline-flex; align-items:center; justify-content:center;
  width:28px; height:28px; border-radius:6px; border:none; cursor:pointer;
  background:#F1F5F9; color:#64748B; transition:all .15s; flex-shrink:0;
}
.nc-btn-icon:hover { background:#E2E8F0; color:#0F1F3D; }
.nc-btn-icon.danger:hover { background:#FEE2E2; color:#DC2626; }

.nc-select {
  appearance:none; background:#F8FAFD; border:1.5px solid #E2E8F0;
  border-radius:8px; padding:10px 36px 10px 14px; font-family:'DM Sans',sans-serif;
  font-size:13px; font-weight:500; color:#0F1F3D; width:100%; outline:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2394A3B8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat:no-repeat; background-position:right 14px center;
  transition:border-color .15s; cursor:pointer;
}
.nc-select:focus { border-color:#2563EB; background-color:#fff; }

.nc-card { background:#fff; border:1.5px solid #E2E8F0; border-radius:14px; overflow:hidden; }
.nc-card-hd { padding:12px 18px; background:#F8FAFD; border-bottom:1px solid #F1F5F9; }
.nc-card-hd-label { font-size:10px; font-weight:700; color:#94A3B8; text-transform:uppercase; letter-spacing:.1em; }

.nc-drop-zone { border:2px dashed #CBD5E1; border-radius:16px; background:#F8FAFD; transition:border-color .2s,background .2s; cursor:pointer; position:relative; overflow:hidden; }
.nc-drop-zone:hover,.nc-drop-zone.dragging { border-color:#2563EB; background:#EFF6FF; }
.nc-drop-zone.has-file { border-style:solid; border-color:#E2E8F0; cursor:default; }
`

// ── Verdict config ────────────────────────────────────────────────────────────

const V: Record<Verdict, { label:string; icon:React.ReactNode; color:string; bg:string; border:string }> = {
  APPROVABLE: { label:'Approvable',     icon:<CheckCircle2 size={30} strokeWidth={1.5}/>, color:'#15803D', bg:'#F0FDF4', border:'#86EFAC' },
  PARTIAL:    { label:'Partial Approval',icon:<AlertTriangle size={30} strokeWidth={1.5}/>, color:'#B45309', bg:'#FFFBEB', border:'#FCD34D' },
  REJECTED:   { label:'Rejected',        icon:<XCircle size={30} strokeWidth={1.5}/>,      color:'#DC2626', bg:'#FFF1F2', border:'#FCA5A5' },
  UNKNOWN:    { label:'Pending Review',  icon:<AlertTriangle size={30} strokeWidth={1.5}/>, color:'#475569', bg:'#F8FAFC', border:'#CBD5E1' },
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function Label({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ minWidth: 160, paddingRight: 16, paddingTop: 1 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{children}</p>
      {sub && <p style={{ fontSize: 10, color: '#CBD5E1', marginTop: 2 }}>{sub}</p>}
    </div>
  )
}

function FRow({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="nc-field-row" style={{ display: 'flex', alignItems: 'flex-start', padding: '10px 18px', gap: 8 }}>
      <Label sub={sub}>{label}</Label>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

function FInput({ value, onChange, placeholder, mono }: {
  value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean
}) {
  return (
    <input
      className="nc-fi"
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder ?? '—'}
      style={mono ? { fontFamily: 'JetBrains Mono, monospace', fontSize: 12 } : {}}
    />
  )
}

function FTextarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <textarea
      className="nc-fi"
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder ?? '—'}
      rows={rows}
    />
  )
}

function TagList({ items, onChange, placeholder }: {
  items: string[]; onChange: (v: string[]) => void; placeholder?: string
}) {
  const [draft, setDraft] = useState('')
  function add() {
    const v = draft.trim()
    if (v && !items.includes(v)) onChange([...items, v])
    setDraft('')
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      {items.map((item, i) => (
        <span key={i} className="nc-tag">
          {item}
          <button className="nc-btn-icon" style={{ width: 16, height: 16, borderRadius: 4 }}
            onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <X size={9} strokeWidth={3} />
          </button>
        </span>
      ))}
      <input
        className="nc-fi"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        placeholder={placeholder ?? 'Type and press Enter…'}
        style={{ width: 200, flex: 'none' }}
      />
    </div>
  )
}

// ── Step bar ─────────────────────────────────────────────────────────────────

function StepBar({ step }: { step: 1 | 2 | 3 }) {
  const STEPS = [
    { n: 1, label: 'Upload',  sub: 'Case sheet image' },
    { n: 2, label: 'Review',  sub: 'Verify & edit extraction' },
    { n: 3, label: 'Result',  sub: 'Evaluation & checklist' },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 36 }}>
      {STEPS.map((s, i) => {
        const done = s.n < step; const active = s.n === step
        return (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: done ? '#0F1F3D' : active ? '#2563EB' : '#F1F5F9',
                border: active ? '2px solid #2563EB' : done ? '2px solid #0F1F3D' : '2px solid #E2E8F0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: active ? '0 0 0 4px rgba(37,99,235,.12)' : 'none',
                transition: 'all .3s',
              }}>
                {done
                  ? <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 6.5L5 9.5L11 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  : <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, fontWeight:700, color: active?'#fff':'#94A3B8' }}>{s.n}</span>
                }
              </div>
              <div>
                <p style={{ fontSize:13, fontWeight:600, color: active?'#0F1F3D':done?'#475569':'#94A3B8', lineHeight:1 }}>{s.label}</p>
                <p style={{ fontSize:10, color:'#94A3B8', marginTop:3 }}>{s.sub}</p>
              </div>
            </div>
            {i < 2 && (
              <div style={{ flex:1, height:2, background:'#F1F5F9', margin:'0 18px', borderRadius:2, overflow:'hidden', position:'relative' }}>
                {done && <div style={{ position:'absolute', inset:0, background:'#0F1F3D', borderRadius:2 }} />}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Step 1: Upload (multi-page) ───────────────────────────────────────────────

interface PageFile { file: File; preview: string; id: string }

function UploadStep({ onDone }: { onDone: (r: OcrResult, previews: string[]) => void }) {
  const [dragging, setDragging] = useState(false)
  const [pages,    setPages]    = useState<PageFile[]>([])
  const [loading,  setLoading]  = useState(false)
  const [phase,    setPhase]    = useState('')   // status text while loading
  const [error,    setError]    = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function addFiles(fileList: FileList | File[]) {
    const incoming = Array.from(fileList).filter(f => f.type.startsWith('image/'))
    if (incoming.length === 0) { setError('Please select image files (JPEG, PNG, WebP, HEIC).'); return }
    setError(null)
    setPages(prev => {
      const existing = new Set(prev.map(p => p.file.name + p.file.size))
      const fresh = incoming
        .filter(f => !existing.has(f.name + f.size))
        .map(f => ({ file: f, preview: URL.createObjectURL(f), id: Math.random().toString(36).slice(2) }))
      return [...prev, ...fresh]
    })
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    addFiles(e.dataTransfer.files)
  }, [])

  function removePage(id: string) {
    setPages(prev => prev.filter(p => p.id !== id))
  }

  async function analyse() {
    if (pages.length === 0) return
    setLoading(true); setError(null)
    try {
      const n = pages.length
      setPhase(n === 1
        ? 'Extracting case data…'
        : `Extracting ${n} pages, then consolidating…`
      )
      const result = await uploadCase(pages.map(p => p.file))
      onDone(result, pages.map(p => p.preview))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setLoading(false); setPhase('')
    }
  }

  const isEmpty = pages.length === 0

  return (
    <div className="nc-fade-up" style={{ maxWidth: 640, margin: '0 auto' }}>

      {/* Drop zone */}
      <div
        className={`nc-drop-zone${dragging ? ' dragging' : ''}${!isEmpty ? ' has-file' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => isEmpty && inputRef.current?.click()}
        style={{ minHeight: isEmpty ? 240 : 'auto', padding: isEmpty ? '44px 28px' : '20px' }}
      >
        {isEmpty ? (
          /* Empty state */
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:18 }}>
            <div style={{ width:64, height:64, borderRadius:16, background:dragging?'#DBEAFE':'#F1F5F9', display:'flex', alignItems:'center', justifyContent:'center', transition:'background .2s' }}>
              <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
                <rect x="4" y="6" width="24" height="20" rx="3" stroke={dragging?'#2563EB':'#94A3B8'} strokeWidth="1.5"/>
                <path d="M4 22l8-7 5 4 4-3 7 7" stroke={dragging?'#2563EB':'#94A3B8'} strokeWidth="1.5" strokeLinejoin="round"/>
                <circle cx="11" cy="13" r="2.5" stroke={dragging?'#2563EB':'#94A3B8'} strokeWidth="1.5"/>
              </svg>
            </div>
            <div style={{ textAlign:'center' }}>
              <p style={{ fontSize:15, fontWeight:600, color:dragging?'#2563EB':'#0F1F3D', marginBottom:6 }}>
                {dragging ? 'Drop pages here' : 'Drop case sheet pages here'}
              </p>
              <p style={{ fontSize:13, color:'#94A3B8' }}>
                or <span style={{ color:'#2563EB', fontWeight:500 }}>browse files</span> · JPEG, PNG, WebP, HEIC
              </p>
              <p style={{ fontSize:12, color:'#CBD5E1', marginTop:8 }}>
                Upload multiple images — each page is processed separately, then consolidated into one record
              </p>
            </div>
          </div>
        ) : (
          /* Thumbnail grid */
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))', gap:12 }}>
              {pages.map((p, i) => (
                <div key={p.id} style={{ position:'relative', borderRadius:10, overflow:'hidden', border:'1.5px solid #E2E8F0', background:'#F8FAFD' }}>
                  {/* Page number badge */}
                  <div style={{ position:'absolute', top:8, left:8, zIndex:2, background:'rgba(15,31,61,.75)', borderRadius:6, padding:'2px 7px', display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, fontWeight:700, color:'#fff' }}>P{i+1}</span>
                  </div>
                  {/* Loading overlay per tile */}
                  {loading && (
                    <div style={{ position:'absolute', inset:0, zIndex:3, background:'rgba(15,31,61,.5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <div style={{ width:28, height:28, borderRadius:'50%', border:'2.5px solid rgba(255,255,255,.25)', borderTopColor:'#fff', animation:'spin 0.8s linear infinite' }} />
                    </div>
                  )}
                  <img src={p.preview} alt={`Page ${i+1}`} style={{ width:'100%', height:140, objectFit:'cover', display:'block' }} />
                  {/* Remove button */}
                  {!loading && (
                    <button
                      onClick={e => { e.stopPropagation(); removePage(p.id) }}
                      style={{ position:'absolute', top:8, right:8, zIndex:2, width:22, height:22, borderRadius:'50%', background:'rgba(15,31,61,.8)', border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}
                    >
                      <X size={10} strokeWidth={3} />
                    </button>
                  )}
                  {/* Filename */}
                  <div style={{ padding:'6px 8px', background:'#fff', borderTop:'1px solid #F1F5F9' }}>
                    <p style={{ fontSize:10, color:'#64748B', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.file.name}</p>
                    <p style={{ fontSize:9, color:'#94A3B8', fontFamily:'JetBrains Mono,monospace', marginTop:1 }}>{(p.file.size/1024).toFixed(0)} KB</p>
                  </div>
                </div>
              ))}

              {/* Add more tile */}
              {!loading && (
                <button
                  onClick={() => inputRef.current?.click()}
                  style={{ minHeight:140, borderRadius:10, border:'2px dashed #E2E8F0', background:'#FAFAFA', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, cursor:'pointer', transition:'all .15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor='#2563EB'; (e.currentTarget as HTMLElement).style.background='#EFF6FF' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor='#E2E8F0'; (e.currentTarget as HTMLElement).style.background='#FAFAFA' }}
                >
                  <Plus size={20} strokeWidth={1.5} color="#94A3B8" />
                  <span style={{ fontSize:11, color:'#94A3B8', fontWeight:500 }}>Add page</span>
                </button>
              )}
            </div>

            {/* Page count summary */}
            {!loading && (
              <div style={{ marginTop:14, display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:12, color:'#64748B' }}>
                  <b style={{ color:'#0F1F3D' }}>{pages.length}</b> page{pages.length!==1?'s':''} selected
                  {pages.length > 1 && <span style={{ color:'#94A3B8' }}> · will be processed individually and consolidated</span>}
                </span>
              </div>
            )}

            {/* Loading phase text */}
            {loading && phase && (
              <div style={{ marginTop:14, display:'flex', alignItems:'center', gap:8 }}>
                <ScanLine size={14} color="#2563EB" strokeWidth={2} />
                <span style={{ fontSize:12, color:'#2563EB', fontWeight:500 }}>{phase}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }} />

      {error && (
        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:10, padding:'9px 14px', background:'#FEF2F2', border:'1.5px solid #FECACA', borderRadius:10 }}>
          <FileWarning size={14} color="#DC2626" strokeWidth={2} />
          <span style={{ fontSize:13, color:'#DC2626', fontWeight:500 }}>{error}</span>
        </div>
      )}

      <div style={{ marginTop:16 }}>
        <button className="nc-btn-primary" onClick={analyse} disabled={isEmpty || loading} style={{ width:'100%', padding:'13px 28px', fontSize:14 }}>
          {loading
            ? <><Loader2 size={15} className="nc-spin" /> {phase || 'Processing…'}</>
            : <><ArrowRight size={15} strokeWidth={2} /> Extract & Review {pages.length > 1 ? `${pages.length} Pages` : 'Case Sheet'}</>
          }
        </button>
        <p style={{ textAlign:'center', fontSize:11, color:'#CBD5E1', marginTop:8 }}>
          Local inference · Gemma 4 12B · No data leaves your network
        </p>
      </div>
    </div>
  )
}

// ── Step 2: Editable full case document ───────────────────────────────────────

function ReviewStep({ ocr, previews, onEvaluate }: {
  ocr: OcrResult; previews: string[]
  onEvaluate: (r: ClaimEvaluation) => void
}) {
  const [ex, setEx]           = useState<FullExtraction>(() => ({ ...ocr.full_extraction }))
  const [insurers, setInsurers] = useState<InsurerOption[]>([])
  const [insurerSlug, setIS]  = useState(ocr.insurer_slug ?? '')
  const [planName, setPN]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => { getSchemes().then(setInsurers).catch(console.error) }, [])

  // Typed patch helpers
  function pPat(k: keyof FullExtraction['patient'], v: string) {
    setEx(e => ({ ...e, patient: { ...e.patient, [k]: v } }))
  }
  function pAdm(k: keyof FullExtraction['admission'], v: string) {
    setEx(e => ({ ...e, admission: { ...e.admission, [k]: v } }))
  }
  function pDoc(k: keyof FullExtraction['doctors'], v: string) {
    setEx(e => ({ ...e, doctors: { ...e.doctors, [k]: v } }))
  }
  function pVit(k: keyof FullExtraction['vitals'], v: string) {
    setEx(e => ({ ...e, vitals: { ...e.vitals, [k]: v } }))
  }
  function pCli(k: keyof FullExtraction['clinical'], v: unknown) {
    setEx(e => ({ ...e, clinical: { ...e.clinical, [k]: v } }))
  }
  function pDx(k: keyof FullExtraction['diagnosis'], v: unknown) {
    setEx(e => ({ ...e, diagnosis: { ...e.diagnosis, [k]: v } }))
  }
  function pSrg(k: keyof FullExtraction['surgery'], v: string) {
    setEx(e => ({ ...e, surgery: { ...e.surgery, [k]: v } }))
  }
  function pIns(k: keyof FullExtraction['insurance'], v: string) {
    setEx(e => ({ ...e, insurance: { ...e.insurance, [k]: v } }))
  }
  function pFac(k: keyof FullExtraction['facility'], v: string) {
    setEx(e => ({ ...e, facility: { ...e.facility, [k]: v } }))
  }

  async function runEval() {
    if (!insurerSlug) { setError('Please select an insurer.'); return }
    setLoading(true); setError(null)
    try {
      onEvaluate(await evaluateCase(ocr.session_id, insurerSlug, planName || undefined, ex as unknown as Record<string, unknown>))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Evaluation failed.')
    } finally { setLoading(false) }
  }

  const conf = Math.round((ex.confidence ?? ocr.confidence) * 100)
  const confColor = conf >= 70 ? '#15803D' : conf >= 40 ? '#B45309' : '#DC2626'

  const meds = ex.medications || []
  const invs = ex.investigations || []
  const procs = ex.procedures || []

  return (
    <div className="nc-fade-up" style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:24, alignItems:'start' }}>

      {/* ── Left: image(s) + confidence ── */}
      <div style={{ position:'sticky', top:24, display:'flex', flexDirection:'column', gap:12 }}>
        <div className="nc-card" style={{ overflow:'hidden' }}>
          {previews.length === 1 ? (
            <img src={previews[0]} alt="Case sheet" style={{ width:'100%', objectFit:'contain', display:'block', background:'#F8FAFD', maxHeight:420 }} />
          ) : (
            <div>
              <img src={previews[0]} alt="Page 1" style={{ width:'100%', objectFit:'contain', display:'block', background:'#F8FAFD', maxHeight:320 }} />
              <div style={{ display:'flex', gap:6, padding:8, overflowX:'auto', background:'#F8FAFD', borderTop:'1px solid #E2E8F0' }}>
                {previews.map((p, i) => (
                  <div key={i} style={{ position:'relative', flexShrink:0 }}>
                    <img src={p} alt={`Page ${i+1}`} style={{ width:56, height:56, objectFit:'cover', borderRadius:6, border: i===0 ? '2px solid #2563EB' : '1.5px solid #E2E8F0' }} />
                    <div style={{ position:'absolute', bottom:3, right:3, background:'rgba(15,31,61,.75)', borderRadius:4, padding:'1px 4px' }}>
                      <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:8, fontWeight:700, color:'#fff' }}>P{i+1}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ padding:'12px 16px', background: conf>=70?'#F0FDF4':conf>=40?'#FFFBEB':'#FEF2F2', border:`1.5px solid ${confColor}33`, borderRadius:12, display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:10, fontWeight:700, color:confColor, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>OCR Confidence</p>
            <div style={{ height:4, background:`${confColor}22`, borderRadius:2, overflow:'hidden' }}>
              <div className="nc-bar-fill" style={{ height:'100%', width:`${conf}%`, background:confColor, borderRadius:2 }} />
            </div>
          </div>
          <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:20, fontWeight:700, color:confColor }}>{conf}%</span>
        </div>
        <p style={{ fontSize:11, color:'#94A3B8', textAlign:'center', lineHeight:1.5 }}>
          All fields are editable. Correct any OCR errors before running evaluation.
        </p>
      </div>

      {/* ── Right: full editable document ── */}
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

        {/* Patient */}
        <div className="nc-card nc-reveal d1">
          <div className="nc-card-hd"><span className="nc-card-hd-label">Patient Information</span></div>
          <FRow label="Full Name">         <FInput value={ex.patient?.name??''} onChange={v=>pPat('name',v)} placeholder="Patient full name" /></FRow>
          <FRow label="Age">               <FInput value={ex.patient?.age??''} onChange={v=>pPat('age',v)} placeholder="e.g. 45 years" /></FRow>
          <FRow label="Date of Birth">     <FInput value={ex.patient?.dob??''} onChange={v=>pPat('dob',v)} placeholder="DD-MM-YYYY" mono /></FRow>
          <FRow label="Gender">            <FInput value={ex.patient?.gender??''} onChange={v=>pPat('gender',v)} placeholder="Male / Female / Other" /></FRow>
          <FRow label="Blood Group">       <FInput value={ex.patient?.blood_group??''} onChange={v=>pPat('blood_group',v)} placeholder="e.g. B+" /></FRow>
          <FRow label="UHID">              <FInput value={ex.patient?.uhid??''} onChange={v=>pPat('uhid',v)} placeholder="Hospital UHID" mono /></FRow>
          <FRow label="IP Number">         <FInput value={ex.patient?.ip_number??''} onChange={v=>pPat('ip_number',v)} placeholder="IP / MRD number" mono /></FRow>
          <FRow label="Contact">           <FInput value={ex.patient?.contact_number??''} onChange={v=>pPat('contact_number',v)} placeholder="Mobile number" mono /></FRow>
          <FRow label="Address">           <FTextarea value={ex.patient?.address??''} onChange={v=>pPat('address',v)} rows={2} /></FRow>
        </div>

        {/* Admission */}
        <div className="nc-card nc-reveal d2">
          <div className="nc-card-hd"><span className="nc-card-hd-label">Admission & Discharge</span></div>
          <FRow label="Admission Date">    <FInput value={ex.admission?.date??''} onChange={v=>pAdm('date',v)} placeholder="DD-MM-YYYY" mono /></FRow>
          <FRow label="Admission Time">    <FInput value={ex.admission?.time??''} onChange={v=>pAdm('time',v)} placeholder="HH:MM" mono /></FRow>
          <FRow label="Admission Type">    <FInput value={ex.admission?.type??''} onChange={v=>pAdm('type',v)} placeholder="Emergency / Elective / Day Care" /></FRow>
          <FRow label="Ward">              <FInput value={ex.admission?.ward??''} onChange={v=>pAdm('ward',v)} placeholder="Ward name" /></FRow>
          <FRow label="Bed Number">        <FInput value={ex.admission?.bed_number??''} onChange={v=>pAdm('bed_number',v)} placeholder="Bed no." mono /></FRow>
          <FRow label="Department">        <FInput value={ex.admission?.department??''} onChange={v=>pAdm('department',v)} placeholder="e.g. Cardiology" /></FRow>
          <FRow label="Discharge Date">    <FInput value={ex.admission?.discharge_date??''} onChange={v=>pAdm('discharge_date',v)} placeholder="DD-MM-YYYY" mono /></FRow>
          <FRow label="Discharge Condition"><FInput value={ex.admission?.discharge_condition??''} onChange={v=>pAdm('discharge_condition',v)} placeholder="Stable / Improved / LAMA…" /></FRow>
          <FRow label="Length of Stay">    <FInput value={ex.admission?.length_of_stay??''} onChange={v=>pAdm('length_of_stay',v)} placeholder="e.g. 5 days" mono /></FRow>
        </div>

        {/* Clinical team */}
        <div className="nc-card nc-reveal d3">
          <div className="nc-card-hd"><span className="nc-card-hd-label">Clinical Team</span></div>
          <FRow label="Treating Doctor">   <FInput value={ex.doctors?.treating_doctor??''} onChange={v=>pDoc('treating_doctor',v)} /></FRow>
          <FRow label="Consultant">        <FInput value={ex.doctors?.consultant??''} onChange={v=>pDoc('consultant',v)} /></FRow>
          <FRow label="Referring Doctor">  <FInput value={ex.doctors?.referring_doctor??''} onChange={v=>pDoc('referring_doctor',v)} /></FRow>
          <FRow label="Surgeon">           <FInput value={ex.doctors?.surgeon??''} onChange={v=>pDoc('surgeon',v)} /></FRow>
          <FRow label="Anaesthetist">      <FInput value={ex.doctors?.anaesthetist??''} onChange={v=>pDoc('anaesthetist',v)} /></FRow>
        </div>

        {/* Vitals */}
        <div className="nc-card nc-reveal d4">
          <div className="nc-card-hd"><span className="nc-card-hd-label">Vitals on Admission</span></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:0 }}>
            {([
              ['Blood Pressure', 'blood_pressure', 'mmHg'],
              ['Pulse Rate',     'pulse_rate',     'bpm'],
              ['Temperature',    'temperature',    '°F / °C'],
              ['Respiratory Rate','respiratory_rate','breaths/min'],
              ['SpO₂',           'spo2',           '%'],
              ['Weight',         'weight',         'kg'],
              ['Height',         'height',         'cm'],
              ['BMI',            'bmi',            'kg/m²'],
            ] as [string, keyof FullExtraction['vitals'], string][]).map(([label, key, unit]) => (
              <div key={key} className="nc-field-row" style={{ display:'flex', alignItems:'center', padding:'9px 18px', gap:8 }}>
                <div style={{ minWidth:130 }}>
                  <p style={{ fontSize:11, fontWeight:600, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'.07em' }}>{label}</p>
                  <p style={{ fontSize:9, color:'#CBD5E1' }}>{unit}</p>
                </div>
                <FInput value={ex.vitals?.[key]??''} onChange={v=>pVit(key,v)} placeholder="—" mono />
              </div>
            ))}
          </div>
        </div>

        {/* Clinical history */}
        <div className="nc-card nc-reveal d5">
          <div className="nc-card-hd"><span className="nc-card-hd-label">Clinical History & Examination</span></div>
          <FRow label="Chief Complaints" sub="Press Enter to add">
            <TagList items={ex.clinical?.chief_complaints??[]} onChange={v=>pCli('chief_complaints',v)} placeholder="Add complaint…" />
          </FRow>
          <FRow label="History of Present Illness">
            <FTextarea value={ex.clinical?.history_of_present_illness??''} onChange={v=>pCli('history_of_present_illness',v)} rows={3} />
          </FRow>
          <FRow label="Past Medical History" sub="Press Enter to add">
            <TagList items={ex.clinical?.past_medical_history??[]} onChange={v=>pCli('past_medical_history',v)} placeholder="Add condition…" />
          </FRow>
          <FRow label="Family History">
            <FInput value={ex.clinical?.family_history??''} onChange={v=>pCli('family_history',v)} />
          </FRow>
          <FRow label="Personal History">
            <FInput value={ex.clinical?.personal_history??''} onChange={v=>pCli('personal_history',v)} placeholder="Smoking, alcohol, diet…" />
          </FRow>
          <FRow label="Examination Findings">
            <FTextarea value={ex.clinical?.examination_findings??''} onChange={v=>pCli('examination_findings',v)} rows={3} />
          </FRow>
          <FRow label="Systemic Examination">
            <FTextarea value={ex.clinical?.systemic_examination??''} onChange={v=>pCli('systemic_examination',v)} rows={2} />
          </FRow>
        </div>

        {/* Diagnosis */}
        <div className="nc-card nc-reveal d6">
          <div className="nc-card-hd"><span className="nc-card-hd-label">Diagnosis</span></div>
          <FRow label="Provisional Diagnosis">
            <FInput value={ex.diagnosis?.provisional_diagnosis??''} onChange={v=>pDx('provisional_diagnosis',v)} />
          </FRow>
          <FRow label="Primary Diagnosis">
            <FInput value={ex.diagnosis?.primary_diagnosis??''} onChange={v=>pDx('primary_diagnosis',v)} />
          </FRow>
          <FRow label="Secondary Diagnoses" sub="Press Enter to add">
            <TagList items={ex.diagnosis?.secondary_diagnoses??[]} onChange={v=>pDx('secondary_diagnoses',v)} placeholder="Add diagnosis…" />
          </FRow>
          <FRow label="Final Diagnosis">
            <FInput value={ex.diagnosis?.final_diagnosis??''} onChange={v=>pDx('final_diagnosis',v)} />
          </FRow>
          <FRow label="Co-morbidities" sub="Press Enter to add">
            <TagList items={ex.diagnosis?.comorbidities??[]} onChange={v=>pDx('comorbidities',v)} placeholder="Add co-morbidity…" />
          </FRow>
        </div>

        {/* Procedures */}
        <div className="nc-card nc-reveal d7">
          <div className="nc-card-hd"><span className="nc-card-hd-label">Procedures Performed</span></div>
          <div style={{ padding:'12px 18px' }}>
            <TagList items={procs} onChange={v=>setEx(e=>({...e,procedures:v}))} placeholder="Add procedure…" />
          </div>
        </div>

        {/* Surgery */}
        <div className="nc-card nc-reveal d7">
          <div className="nc-card-hd"><span className="nc-card-hd-label">Surgical Details</span></div>
          <FRow label="Procedure Name">    <FInput value={ex.surgery?.procedure_name??''} onChange={v=>pSrg('procedure_name',v)} /></FRow>
          <FRow label="Date">              <FInput value={ex.surgery?.date??''} onChange={v=>pSrg('date',v)} placeholder="DD-MM-YYYY" mono /></FRow>
          <FRow label="Type">              <FInput value={ex.surgery?.type??''} onChange={v=>pSrg('type',v)} placeholder="Elective / Emergency / Laparoscopic…" /></FRow>
          <FRow label="Anaesthesia">       <FInput value={ex.surgery?.anaesthesia_type??''} onChange={v=>pSrg('anaesthesia_type',v)} placeholder="GA / Spinal / Local…" /></FRow>
          <FRow label="Duration">          <FInput value={ex.surgery?.duration??''} onChange={v=>pSrg('duration',v)} placeholder="e.g. 2h 30min" mono /></FRow>
          <FRow label="Operative Findings"><FTextarea value={ex.surgery?.operative_findings??''} onChange={v=>pSrg('operative_findings',v)} rows={2} /></FRow>
          <FRow label="Complications">     <FInput value={ex.surgery?.complications??''} onChange={v=>pSrg('complications',v)} placeholder="None / describe…" /></FRow>
          <FRow label="Implants Used">     <FInput value={ex.surgery?.implants_used??''} onChange={v=>pSrg('implants_used',v)} placeholder="None / name + batch…" /></FRow>
        </div>

        {/* Investigations */}
        <div className="nc-card nc-reveal d7">
          <div className="nc-card-hd" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span className="nc-card-hd-label">Investigations & Lab Reports</span>
            <button className="nc-btn-icon" onClick={() => setEx(e => ({ ...e, investigations: [...(e.investigations||[]), { test:'', result:'', unit:'', reference_range:'', date:'' }] }))}>
              <Plus size={13} strokeWidth={2.5} />
            </button>
          </div>
          {invs.length === 0 ? (
            <p style={{ padding:'16px 18px', fontSize:12, color:'#CBD5E1' }}>No investigations extracted. Click + to add.</p>
          ) : (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'2fr 1.5fr 1fr 1.5fr 1fr 28px', gap:8, padding:'8px 18px', background:'#F8FAFD', borderBottom:'1px solid #F1F5F9' }}>
                {['Test','Result','Unit','Ref Range','Date',''].map(h => (
                  <span key={h} style={{ fontSize:9, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'.08em' }}>{h}</span>
                ))}
              </div>
              {invs.map((inv, i) => (
                <div key={i} className="nc-field-row" style={{ display:'grid', gridTemplateColumns:'2fr 1.5fr 1fr 1.5fr 1fr 28px', gap:8, padding:'8px 18px', alignItems:'center' }}>
                  <FInput value={inv.test??''} onChange={v=>{ const a=[...invs]; a[i]={...a[i],test:v}; setEx(e=>({...e,investigations:a})) }} placeholder="Test name" />
                  <FInput value={inv.result??''} onChange={v=>{ const a=[...invs]; a[i]={...a[i],result:v}; setEx(e=>({...e,investigations:a})) }} placeholder="Value" mono />
                  <FInput value={inv.unit??''} onChange={v=>{ const a=[...invs]; a[i]={...a[i],unit:v}; setEx(e=>({...e,investigations:a})) }} placeholder="Unit" mono />
                  <FInput value={inv.reference_range??''} onChange={v=>{ const a=[...invs]; a[i]={...a[i],reference_range:v}; setEx(e=>({...e,investigations:a})) }} placeholder="Normal range" />
                  <FInput value={inv.date??''} onChange={v=>{ const a=[...invs]; a[i]={...a[i],date:v}; setEx(e=>({...e,investigations:a})) }} placeholder="DD-MM" mono />
                  <button className="nc-btn-icon danger" onClick={() => setEx(e=>({...e,investigations:invs.filter((_,j)=>j!==i)}))}>
                    <Trash2 size={11} strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Medications */}
        <div className="nc-card nc-reveal d8">
          <div className="nc-card-hd" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span className="nc-card-hd-label">Medications / Treatment</span>
            <button className="nc-btn-icon" onClick={() => setEx(e => ({ ...e, medications: [...(e.medications||[]), { drug:'', dose:'', route:'', frequency:'', duration:'' }] }))}>
              <Plus size={13} strokeWidth={2.5} />
            </button>
          </div>
          {meds.length === 0 ? (
            <p style={{ padding:'16px 18px', fontSize:12, color:'#CBD5E1' }}>No medications extracted. Click + to add.</p>
          ) : (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1.5fr 1fr 28px', gap:8, padding:'8px 18px', background:'#F8FAFD', borderBottom:'1px solid #F1F5F9' }}>
                {['Drug','Dose','Route','Frequency','Duration',''].map(h => (
                  <span key={h} style={{ fontSize:9, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'.08em' }}>{h}</span>
                ))}
              </div>
              {meds.map((med, i) => (
                <div key={i} className="nc-field-row" style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1.5fr 1fr 28px', gap:8, padding:'8px 18px', alignItems:'center' }}>
                  <FInput value={med.drug??''} onChange={v=>{ const a=[...meds]; a[i]={...a[i],drug:v}; setEx(e=>({...e,medications:a})) }} placeholder="Drug name" />
                  <FInput value={med.dose??''} onChange={v=>{ const a=[...meds]; a[i]={...a[i],dose:v}; setEx(e=>({...e,medications:a})) }} placeholder="Dose" mono />
                  <FInput value={med.route??''} onChange={v=>{ const a=[...meds]; a[i]={...a[i],route:v}; setEx(e=>({...e,medications:a})) }} placeholder="IV/PO…" mono />
                  <FInput value={med.frequency??''} onChange={v=>{ const a=[...meds]; a[i]={...a[i],frequency:v}; setEx(e=>({...e,medications:a})) }} placeholder="OD / BD / TDS…" />
                  <FInput value={med.duration??''} onChange={v=>{ const a=[...meds]; a[i]={...a[i],duration:v}; setEx(e=>({...e,medications:a})) }} placeholder="Days" mono />
                  <button className="nc-btn-icon danger" onClick={() => setEx(e=>({...e,medications:meds.filter((_,j)=>j!==i)}))}>
                    <Trash2 size={11} strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Insurance */}
        <div className="nc-card nc-reveal d8">
          <div className="nc-card-hd"><span className="nc-card-hd-label">Insurance & TPA Details</span></div>
          <FRow label="Insurer Name">      <FInput value={ex.insurance?.insurer_name??''} onChange={v=>pIns('insurer_name',v)} /></FRow>
          <FRow label="TPA Name">          <FInput value={ex.insurance?.tpa_name??''} onChange={v=>pIns('tpa_name',v)} /></FRow>
          <FRow label="Policy Number">     <FInput value={ex.insurance?.policy_number??''} onChange={v=>pIns('policy_number',v)} mono /></FRow>
          <FRow label="Member ID">         <FInput value={ex.insurance?.member_id??''} onChange={v=>pIns('member_id',v)} mono /></FRow>
          <FRow label="Group Policy No.">  <FInput value={ex.insurance?.group_policy_number??''} onChange={v=>pIns('group_policy_number',v)} mono /></FRow>
          <FRow label="Sum Insured">       <FInput value={ex.insurance?.sum_insured??''} onChange={v=>pIns('sum_insured',v)} placeholder="₹" mono /></FRow>
          <FRow label="Pre-Auth Number">   <FInput value={ex.insurance?.pre_auth_number??''} onChange={v=>pIns('pre_auth_number',v)} mono /></FRow>
          <FRow label="Claim Type">        <FInput value={ex.insurance?.claim_type??''} onChange={v=>pIns('claim_type',v)} placeholder="Cashless / Reimbursement" /></FRow>
          <FRow label="Corporate Name">    <FInput value={ex.insurance?.corporate_name??''} onChange={v=>pIns('corporate_name',v)} /></FRow>
          <FRow label="Employee ID">       <FInput value={ex.insurance?.employee_id??''} onChange={v=>pIns('employee_id',v)} mono /></FRow>
        </div>

        {/* Facility */}
        <div className="nc-card nc-reveal d8">
          <div className="nc-card-hd"><span className="nc-card-hd-label">Facility Details</span></div>
          <FRow label="Hospital Name">     <FInput value={ex.facility?.hospital_name??''} onChange={v=>pFac('hospital_name',v)} /></FRow>
          <FRow label="Reg. Number">       <FInput value={ex.facility?.registration_number??''} onChange={v=>pFac('registration_number',v)} mono /></FRow>
          <FRow label="ROHINI ID">         <FInput value={ex.facility?.rohini_id??''} onChange={v=>pFac('rohini_id',v)} mono /></FRow>
          <FRow label="Accreditation">     <FInput value={ex.facility?.accreditation??''} onChange={v=>pFac('accreditation',v)} placeholder="NABH / JCI / None" /></FRow>
        </div>

        {/* Insurer selector */}
        <div className="nc-card nc-reveal d8" style={{ padding:20, display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <p style={{ fontSize:11, fontWeight:700, color:'#0F1F3D', textTransform:'uppercase', letterSpacing:'.1em' }}>Select Indexed Insurer</p>
            {ocr.insurer_slug && <span style={{ fontSize:10, fontWeight:600, color:'#2563EB', background:'#EFF6FF', borderRadius:6, padding:'3px 8px' }}>Auto-detected</span>}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'#475569', display:'block', marginBottom:6 }}>Insurer <span style={{ color:'#EF4444' }}>*</span></label>
              <select className="nc-select" value={insurerSlug} onChange={e=>setIS(e.target.value)}>
                <option value="">— Select insurer —</option>
                {insurers.map(ins => <option key={ins.slug} value={ins.slug}>{ins.insurer}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'#475569', display:'block', marginBottom:6 }}>Plan Name <span style={{ fontSize:11, color:'#CBD5E1', fontWeight:400 }}>(optional)</span></label>
              <input className="nc-fi" value={planName} onChange={e=>setPN(e.target.value)} placeholder="e.g. Optima Restore…" />
            </div>
          </div>
        </div>

        {error && (
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:'#FEF2F2', border:'1.5px solid #FECACA', borderRadius:10 }}>
            <FileWarning size={14} color="#DC2626" strokeWidth={2} />
            <span style={{ fontSize:13, color:'#DC2626', fontWeight:500 }}>{error}</span>
          </div>
        )}

        <button className="nc-btn-primary" onClick={runEval} disabled={loading||!insurerSlug} style={{ width:'100%', padding:'14px', fontSize:14 }}>
          {loading ? <><Loader2 size={15} className="nc-spin" /> Running evaluation against policy tree…</> : <><ArrowRight size={15} strokeWidth={2} /> Run Claim Evaluation</>}
        </button>
      </div>
    </div>
  )
}

// ── Step 3: Result ────────────────────────────────────────────────────────────

function ChecklistSection({ icon, title, items, color, bg, border }: {
  icon: React.ReactNode; title: string; items: string[]
  color: string; bg: string; border: string
}) {
  if (items.length === 0) return null
  return (
    <div className="nc-card" style={{ borderColor: border }}>
      <div className="nc-card-hd" style={{ background: bg, borderBottomColor: `${border}88`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ color }}>{icon}</span>
          <span style={{ fontSize:10, fontWeight:700, color, textTransform:'uppercase', letterSpacing:'.1em' }}>{title}</span>
        </div>
        <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, fontWeight:700, color, background:`${color}15`, borderRadius:6, padding:'2px 8px' }}>{items.length}</span>
      </div>
      <div>
        {items.map((item, i) => (
          <div key={i} className="nc-field-row" style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'11px 18px' }}>
            <span style={{ width:20, height:20, borderRadius:'50%', background:`${color}15`, color, fontSize:9, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>{i+1}</span>
            <p style={{ fontSize:13, color:'#334155', lineHeight:1.55 }}>{item}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Token Usage Panel ─────────────────────────────────────────────────────────

function TokenUsagePanel({ usage }: { usage: TokenUsage }) {
  const stages: { key: keyof Omit<TokenUsage,'grand_total'>; label: string; color: string }[] = [
    { key: 'ocr',          label: 'OCR Extraction',   color: '#0369A1' },
    { key: 'index_search', label: 'Policy Index Search', color: '#7C3AED' },
    { key: 'icd_match',    label: 'ICD-10 Matching',  color: '#0F766E' },
    { key: 'evaluation',   label: 'Claim Evaluation',  color: '#B45309' },
  ]
  const grand = usage.grand_total || 0

  return (
    <div className="nc-card nc-reveal d6" style={{ borderTop:'3px solid #F1F5F9' }}>
      <div className="nc-card-hd" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span className="nc-card-hd-label">Token Usage</span>
          {usage.model_used && (
            <span style={{
              fontFamily:'JetBrains Mono,monospace', fontSize:10, fontWeight:700,
              padding:'2px 8px', borderRadius:6,
              ...(usage.model_used.includes('gpt') || usage.model_used.includes('openai')
                ? { background:'#FEF3C7', color:'#B45309', border:'1px solid #FCD34D' }
                : { background:'#DBEAFE', color:'#1D4ED8', border:'1px solid #BFDBFE' }),
            }}>
              {usage.model_used.includes('gpt') ? '⚡ Fallback · ' : ''}
              {usage.model_used}
            </span>
          )}
          {usage.model_used?.includes('gpt') && (
            <span style={{ fontSize:10, color:'#B45309', fontStyle:'italic' }}>Gemma was unreachable — used GPT-4o-mini</span>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:10, color:'#94A3B8', fontWeight:500 }}>Total consumed this case</span>
          <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:15, fontWeight:700, color:'#0F1F3D', background:'#F1F5F9', borderRadius:8, padding:'3px 12px' }}>
            {grand.toLocaleString()}
          </span>
        </div>
      </div>
      <div style={{ padding:'16px 20px', display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        {stages.map(({ key, label, color }) => {
          const s = usage[key] || { prompt: 0, completion: 0, total: 0 }
          const total = s.total || (s.prompt + s.completion)
          const pct   = grand > 0 ? Math.round(total / grand * 100) : 0
          return (
            <div key={key} style={{ padding:'12px 14px', background:'#FAFAFA', border:'1.5px solid #F1F5F9', borderRadius:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:color, flexShrink:0 }} />
                <span style={{ fontSize:10, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'.06em' }}>{label}</span>
              </div>
              <p style={{ fontFamily:'JetBrains Mono,monospace', fontSize:18, fontWeight:700, color, marginBottom:4 }}>
                {total > 0 ? total.toLocaleString() : '—'}
              </p>
              {/* Bar */}
              <div style={{ height:3, background:'#E2E8F0', borderRadius:2, overflow:'hidden', marginBottom:8 }}>
                <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:2, transition:'width .6s ease' }} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:9, color:'#94A3B8', fontFamily:'JetBrains Mono,monospace' }}>↑{s.prompt.toLocaleString()}</span>
                <span style={{ fontSize:9, color:'#94A3B8', fontFamily:'JetBrains Mono,monospace' }}>↓{s.completion.toLocaleString()}</span>
                <span style={{ fontSize:9, fontWeight:600, color:color, fontFamily:'JetBrains Mono,monospace' }}>{pct}%</span>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ padding:'0 20px 14px', display:'flex', alignItems:'center', gap:6 }}>
        <div style={{ height:1, flex:1, background:'#F1F5F9' }} />
        <span style={{ fontSize:10, color:'#CBD5E1', padding:'0 8px' }}>Local inference · No data sent to external services</span>
        <div style={{ height:1, flex:1, background:'#F1F5F9' }} />
      </div>
    </div>
  )
}

function ResultStep({ result, onNewCase }: { result: ClaimEvaluation; onNewCase: () => void }) {
  const navigate = useNavigate()
  const cfg = V[result.verdict]

  return (
    <div className="nc-fade-up" style={{ display:'flex', flexDirection:'column', gap:20, maxWidth:900, margin:'0 auto' }}>

      {/* Verdict */}
      <div className="nc-reveal" style={{
        background: cfg.bg, border:`2px solid ${cfg.border}`, borderRadius:16,
        display:'grid', gridTemplateColumns:'6px 1fr', overflow:'hidden',
      }}>
        <div style={{ background: cfg.color }} />
        <div style={{ padding:'24px 28px', display:'flex', alignItems:'flex-start', gap:18 }}>
          <span style={{ color:cfg.color, flexShrink:0, marginTop:2 }}>{cfg.icon}</span>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:10, fontWeight:700, color:cfg.color, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:4 }}>Claim Verdict</p>
            <p style={{ fontFamily:'Fraunces,Georgia,serif', fontSize:32, fontWeight:700, color:cfg.color, lineHeight:1.1, marginBottom:8 }}>{cfg.label}</p>
            <p style={{ fontSize:14, color:cfg.color, opacity:.85, lineHeight:1.6, maxWidth:580 }}>{result.verdict_reason}</p>
          </div>
          <div style={{ flexShrink:0, padding:'10px 16px', background:`${cfg.color}12`, border:`1px solid ${cfg.color}30`, borderRadius:10 }}>
            <p style={{ fontSize:9, fontWeight:700, color:cfg.color, textTransform:'uppercase', letterSpacing:'.08em' }}>Insurer</p>
            <p style={{ fontSize:13, fontWeight:600, color:cfg.color, marginTop:3 }}>{result.insurer}</p>
            {result.plan_name && <p style={{ fontSize:11, color:cfg.color, opacity:.7, marginTop:2 }}>{result.plan_name}</p>}
          </div>
        </div>
      </div>

      {/* Billing summary */}
      <div className="nc-card nc-reveal d2">
        <div className="nc-card-hd" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span className="nc-card-hd-label">Billing Summary</span>
          <span style={{ fontSize:10, color:'#94A3B8', fontWeight:500 }}>Copy-paste ready for TPA</span>
        </div>
        <div style={{ padding:'18px 20px' }}>
          <p style={{ fontSize:13.5, color:'#334155', lineHeight:1.8 }}>{result.summary_paragraph}</p>
        </div>
      </div>

      {/* Three checklists side by side */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, alignItems:'start' }}>
        <ChecklistSection
          icon={<ClipboardList size={14} strokeWidth={2} />}
          title="Missing / Incomplete"
          items={result.missing_items}
          color="#B45309" bg="#FFFBEB" border="#FCD34D"
        />
        <ChecklistSection
          icon={<FolderDown size={14} strokeWidth={2} />}
          title="Documents to Collect"
          items={result.items_to_collect}
          color="#1D4ED8" bg="#EFF6FF" border="#BFDBFE"
        />
        <ChecklistSection
          icon={<FilePlus2 size={14} strokeWidth={2} />}
          title="Documents to Generate"
          items={result.items_to_generate}
          color="#7C3AED" bg="#F5F3FF" border="#DDD6FE"
        />
      </div>

      {/* ICD codes */}
      {result.icd_codes.length > 0 && (
        <div className="nc-card nc-reveal d5">
          <div className="nc-card-hd" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span className="nc-card-hd-label">ICD-10 Codes</span>
            <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, fontWeight:600, color:'#475569', background:'#F1F5F9', borderRadius:6, padding:'2px 8px' }}>
              {result.icd_codes.length} code{result.icd_codes.length!==1?'s':''}
            </span>
          </div>
          <div>
            {result.icd_codes.map((icd, i) => (
              <div key={icd.code} className="nc-field-row" style={{ display:'grid', gridTemplateColumns:'90px 1fr 90px', gap:16, padding:'11px 20px', alignItems:'start',
                animationDelay:`${.3+i*.04}s` }}>
                <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:12, fontWeight:700, color:'#0F1F3D', background:'#F1F5F9', borderRadius:6, padding:'3px 8px', display:'inline-block' }}>{icd.code}</span>
                <div>
                  <p style={{ fontSize:13, color:'#334155' }}>{icd.description}</p>
                  {icd.restriction_note && <p style={{ fontSize:11, color:'#B45309', marginTop:3 }}>{icd.restriction_note}</p>}
                </div>
                <span style={{ fontSize:10, fontWeight:700, borderRadius:6, padding:'3px 8px', textAlign:'center', flexShrink:0,
                  ...(icd.scheme_covered ? { background:'#DCFCE7', color:'#15803D' } : { background:'#FEE2E2', color:'#DC2626' }) }}>
                  {icd.scheme_covered ? '✓ Covered' : '✕ Excluded'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Token usage */}
      {result.token_usage && <TokenUsagePanel usage={result.token_usage} />}

      {/* Actions */}
      <div className="nc-reveal d6" style={{ display:'flex', alignItems:'center', gap:12, paddingTop:8 }}>
        <button className="nc-btn-primary" onClick={()=>navigate('/cases')}>View All Cases</button>
        <button className="nc-btn-ghost" onClick={onNewCase}>+ New Case</button>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function NewCase() {
  const [step,     setStep]    = useState<1|2|3>(1)
  const [ocr,      setOcr]     = useState<OcrResult|null>(null)
  const [previews, setPreviews] = useState<string[]>([])
  const [result,   setResult]  = useState<ClaimEvaluation|null>(null)

  function reset() { setStep(1); setOcr(null); setPreviews([]); setResult(null) }

  return (
    <>
      <style>{FONTS}</style>
      <div className="nc-root">
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <StepBar step={step} />
          {step===1 && <UploadStep onDone={(r,ps)=>{ setOcr(r); setPreviews(ps); setStep(2) }} />}
          {step===2 && ocr && <ReviewStep ocr={ocr} previews={previews} onEvaluate={r=>{ setResult(r); setStep(3) }} />}
          {step===3 && result && <ResultStep result={result} onNewCase={reset} />}
        </div>
      </div>
    </>
  )
}

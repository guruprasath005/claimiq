import { useState, useEffect } from 'react'
import { Check, Zap, AlertCircle } from 'lucide-react'
import { getSettings, saveSettings } from '../api/client'
import type { AppSettings } from '../api/types'

function Input({ value, onChange, placeholder, mono, width = 'w-72' }: {
  value: string; onChange: (v: string) => void
  placeholder?: string; mono?: boolean; width?: string
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${width} px-3.5 py-2 text-[13px] bg-white rounded-lg outline-none transition-all
        placeholder-gray-300 ${mono ? 'font-mono' : 'font-medium text-gray-900'}`}
      style={{ border: '1px solid #E5E7EB' }}
      onFocus={e => (e.target.style.borderColor = '#111827')}
      onBlur={e  => (e.target.style.borderColor = '#E5E7EB')}
    />
  )
}

function Row({ label, hint, children, last }: {
  label: string; hint?: string; children: React.ReactNode; last?: boolean
}) {
  return (
    <div
      className="flex items-start justify-between py-5 gap-8"
      style={!last ? { borderBottom: '1px solid #F3F4F6' } : {}}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-gray-900">{label}</p>
        {hint && <p className="text-[12px] text-gray-400 mt-0.5 leading-snug max-w-sm">{hint}</p>}
      </div>
      <div className="shrink-0 flex items-center gap-2.5">{children}</div>
    </div>
  )
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="pb-2" style={{ borderBottom: '1px solid #F3F4F6' }}>
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{title}</p>
      <p className="text-[12px] text-gray-400 mt-1">{description}</p>
    </div>
  )
}

const MODEL_OPTIONS = [
  'gemma-4-12b-it',
  'gemma-3-27b-it',
  'llama-3.3-70b-instruct',
  'gpt-4o-2024-11-20',
  'gpt-4o-mini',
]

export default function Settings() {
  const [baseUrl,     setBaseUrl]     = useState('')
  const [llmModel,    setLlmModel]    = useState('')
  const [maxMb,       setMaxMb]       = useState('20')
  const [corsOrigins, setCorsOrigins] = useState('')
  const [ping,        setPing]        = useState<'idle' | 'ok' | 'fail'>('idle')

  const [loading, setLoading] = useState(true)
  const [saved,   setSaved]   = useState(false)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    getSettings()
      .then((s: AppSettings) => {
        setBaseUrl(s.openai_base_url ?? '')
        setLlmModel(s.llm_model ?? '')
        setMaxMb(String(s.max_upload_mb ?? 20))
        setCorsOrigins(Array.isArray(s.cors_origins) ? s.cors_origins.join('\n') : '')
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function pingEndpoint() {
    setPing('idle')
    try {
      const res = await fetch(`${baseUrl}/models`, { signal: AbortSignal.timeout(4000) })
      setPing(res.ok ? 'ok' : 'fail')
    } catch {
      setPing('fail')
    }
    setTimeout(() => setPing('idle'), 3000)
  }

  async function saveAll() {
    setSaving(true)
    try {
      await saveSettings({
        openai_base_url: baseUrl,
        llm_model:       llmModel,
        max_upload_mb:   Number(maxMb),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-[13px] text-gray-300 font-medium">Loading settings…</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #EBEBEB' }}>

          {/* ── Model / Endpoint ───────────────────────────────────────────── */}
          <div className="px-8 pt-7 pb-2">
            <SectionHeader
              title="Model Endpoint"
              description="vllm-compatible endpoint used for OCR, ICD matching, and claim evaluation."
            />
            <Row label="Base URL" hint="OpenAI-compatible endpoint, e.g. http://10.10.116.160:11632/v1">
              <Input value={baseUrl} onChange={setBaseUrl} placeholder="http://10.x.x.x:11632/v1" mono />
            </Row>
            <Row label="Model" hint="Must be served by the vllm endpoint above.">
              <div className="flex items-center gap-2">
                <select
                  value={llmModel}
                  onChange={e => setLlmModel(e.target.value)}
                  className="w-56 px-3.5 py-2 text-[13px] font-mono font-medium text-gray-900 bg-white rounded-lg outline-none appearance-none"
                  style={{ border: '1px solid #E5E7EB' }}
                >
                  {MODEL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </Row>
            <Row label="Connection" hint="Verify the endpoint is reachable." last>
              <button
                onClick={pingEndpoint}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-bold border border-gray-200 text-gray-600 hover:border-gray-900 hover:text-gray-900 transition-all"
              >
                <Zap size={11} strokeWidth={2.5} /> Test connection
              </button>
              {ping === 'ok' && (
                <span className="flex items-center gap-1 text-[12px] font-semibold text-gray-700">
                  <Check size={12} strokeWidth={2.5} /> Reachable
                </span>
              )}
              {ping === 'fail' && (
                <span className="flex items-center gap-1 text-[12px] font-semibold text-gray-400">
                  <AlertCircle size={12} strokeWidth={2} /> Unreachable
                </span>
              )}
            </Row>
          </div>

          <div className="mx-8" style={{ borderTop: '2px solid #F3F4F6' }} />

          {/* ── Upload & Security ─────────────────────────────────────────── */}
          <div className="px-8 pt-6 pb-2 grid gap-x-12" style={{ gridTemplateColumns: '1fr 1fr' }}>

            <div>
              <SectionHeader title="Upload" description="File upload constraints for case sheet images." />
              <Row label="Max file size" hint="Images larger than this are rejected before OCR." last>
                <div className="flex items-center gap-2">
                  <Input value={maxMb} onChange={setMaxMb} placeholder="20" width="w-20" />
                  <span className="text-[12px] text-gray-400 font-medium">MB</span>
                </div>
              </Row>
              <div className="pb-4">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Accepted formats</p>
                <div className="flex flex-wrap gap-1.5">
                  {['image/jpeg', 'image/png', 'image/webp', 'image/heic'].map(fmt => (
                    <span
                      key={fmt}
                      className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold text-gray-500 bg-gray-50"
                      style={{ border: '1px solid #E5E7EB' }}
                    >
                      {fmt}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ borderLeft: '2px solid #F3F4F6', paddingLeft: '3rem' }}>
              <SectionHeader title="Security" description="CORS origins allowed to call the FastAPI backend." />
              <div className="py-4">
                <p className="text-[12px] font-semibold text-gray-900 mb-1.5">Allowed origins</p>
                <p className="text-[12px] text-gray-400 mb-3">One origin per line.</p>
                <textarea
                  value={corsOrigins}
                  onChange={e => setCorsOrigins(e.target.value)}
                  rows={4}
                  className="w-full px-3.5 py-2.5 text-[12px] font-mono text-gray-900 bg-white rounded-lg outline-none resize-none leading-relaxed"
                  style={{ border: '1px solid #E5E7EB' }}
                  onFocus={e => (e.target.style.borderColor = '#111827')}
                  onBlur={e  => (e.target.style.borderColor = '#E5E7EB')}
                />
              </div>
            </div>
          </div>

          {/* ── Footer ────────────────────────────────────────────────────── */}
          <div
            className="flex items-center justify-between px-8 py-4"
            style={{ borderTop: '1px solid #F3F4F6', background: '#FAFAFA' }}
          >
            <p className="text-[12px] text-gray-400">Changes are applied on next server restart.</p>
            <button
              onClick={saveAll}
              disabled={saving}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-full text-[12px] font-bold transition-all disabled:opacity-50
                ${saved
                  ? 'bg-gray-100 text-gray-500 cursor-default'
                  : 'bg-gray-900 text-white hover:bg-gray-700'
                }`}
            >
              {saved ? <><Check size={12} /> Saved</> : saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

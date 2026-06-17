import type {
  Case, CaseStats, ReportData, AppSettings,
  OcrResult, ClaimEvaluation, InsurerOption,
} from './types'

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000'

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`${res.status}: ${text}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

function qs(params: Record<string, unknown> = {}): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) p.set(k, String(v))
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const getCases = (params?: { limit?: number; sort?: string }) =>
  api<Case[]>(`/cases${qs(params)}`)

export const getCase = (id: string) => api<Case>(`/cases/${id}`)

export const getCaseStats = () => api<CaseStats>('/cases/stats')

export const updateVerdict = (id: string, verdict: string, reason?: string) =>
  api<Case>(`/cases/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ verdict, verdict_reason: reason }),
  })

export const getReports = () => api<ReportData>('/reports/summary')

export const getSettings = () => api<AppSettings>('/settings')

export const saveSettings = (s: Partial<AppSettings>) =>
  api<void>('/settings', { method: 'PATCH', body: JSON.stringify(s) })

export const getSchemes = async (): Promise<InsurerOption[]> => {
  const data = await api<{ insurers: InsurerOption[] }>('/schemes')
  return data.insurers
}

export async function uploadCase(files: File[]): Promise<OcrResult> {
  const form = new FormData()
  files.forEach(f => form.append('files', f))
  const res = await fetch(`${BASE}/upload`, { method: 'POST', body: form })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`${res.status}: ${text}`)
  }
  return res.json() as Promise<OcrResult>
}

export async function evaluateCase(
  sessionId: string,
  insurerSlug: string,
  planName?: string,
  editedExtraction?: Record<string, unknown>,
): Promise<ClaimEvaluation> {
  return api<ClaimEvaluation>('/evaluate', {
    method: 'POST',
    body: JSON.stringify({
      session_id:         sessionId,
      insurer_slug:       insurerSlug,
      plan_name:          planName ?? null,
      edited_extraction:  editedExtraction ?? null,
    }),
  })
}

export type Verdict = 'APPROVABLE' | 'PARTIAL' | 'REJECTED' | 'UNKNOWN'

export interface IcdCode {
  code: string
  description: string | null
  scheme_covered: boolean
  restriction_note: string | null
}

export interface Case {
  id: string
  patient_name: string | null
  age: number | null
  gender: 'M' | 'F' | null
  insurer: string | null
  insurer_slug: string | null
  plan_name: string | null
  policy_number: string | null
  tpa_name: string | null
  sum_insured: string | null
  diagnosis: string[]
  procedures: string[]
  admission_date: string | null
  discharge_date: string | null
  treating_doctor: string | null
  department: string | null
  verdict: Verdict
  verdict_reason: string | null
  summary_paragraph: string | null
  icd_codes: IcdCode[]
  missing_items: string[]
  retrieved_sections: string[]
  submitted_at: string
}

export interface WeekDay { day: string; total: number; pct: number }
export interface MonthData { month: string; cases: number; approved: number }

export interface CaseStats {
  total: number
  approvable: number
  partial: number
  rejected: number
  unknown: number
  approved_value_lakh: number
  avg_tat_hours: number
  rejection_pct: number
  weekly: WeekDay[]
  monthly: MonthData[]
}

export interface InsurerStat { insurer: string; plan: string; cases: number; approved: number; avgClaim: string; tat: string }
export interface RejectionReason { reason: string; count: number; pct: number }

export interface ReportData {
  total: number
  approval_rate: number
  approved_value: string
  avg_tat: string
  verdict_counts: { approvable: number; partial: number; rejected: number; unknown: number }
  monthly: MonthData[]
  insurer_stats: InsurerStat[]
  rejection_reasons: RejectionReason[]
}

export interface AppSettings {
  openai_base_url: string
  llm_model: string
  max_upload_mb: number
  cors_origins: string[]
}

// ── Full case sheet extraction structure ──────────────────────────────────────

export interface FullExtraction {
  patient: {
    name: string | null; age: string | null; dob: string | null
    gender: string | null; blood_group: string | null; address: string | null
    contact_number: string | null; uhid: string | null; ip_number: string | null
    emergency_contact: string | null
  }
  admission: {
    date: string | null; time: string | null; type: string | null
    ward: string | null; bed_number: string | null; department: string | null
    discharge_date: string | null; discharge_time: string | null
    discharge_condition: string | null; length_of_stay: string | null
  }
  doctors: {
    treating_doctor: string | null; consultant: string | null
    referring_doctor: string | null; surgeon: string | null; anaesthetist: string | null
  }
  vitals: {
    blood_pressure: string | null; pulse_rate: string | null; temperature: string | null
    respiratory_rate: string | null; spo2: string | null; weight: string | null
    height: string | null; bmi: string | null
  }
  clinical: {
    chief_complaints: string[]; history_of_present_illness: string | null
    past_medical_history: string[]; family_history: string | null
    personal_history: string | null; examination_findings: string | null
    systemic_examination: string | null
  }
  investigations: { test: string; result: string; unit?: string; reference_range?: string; date?: string }[]
  diagnosis: {
    provisional_diagnosis: string | null; primary_diagnosis: string | null
    secondary_diagnoses: string[]; final_diagnosis: string | null; comorbidities: string[]
  }
  procedures: string[]
  surgery: {
    procedure_name: string | null; date: string | null; type: string | null
    anaesthesia_type: string | null; duration: string | null
    operative_findings: string | null; complications: string | null; implants_used: string | null
  }
  medications: { drug: string; dose: string; route?: string; frequency?: string; duration?: string }[]
  insurance: {
    insurer_name: string | null; tpa_name: string | null; policy_number: string | null
    member_id: string | null; group_policy_number: string | null; sum_insured: string | null
    pre_auth_number: string | null; claim_type: string | null
    employee_id: string | null; corporate_name: string | null
  }
  facility: {
    hospital_name: string | null; registration_number: string | null
    rohini_id: string | null; address: string | null; accreditation: string | null
  }
  confidence: number
  _flat?: Record<string, unknown>
}

export interface OcrResult {
  session_id: string
  patient_name: string | null
  dob: string | null
  gender: string | null
  diagnosis: string[]
  procedures: string[]
  medications: string[]
  admission_date: string | null
  discharge_date: string | null
  insurer_detected: string | null
  insurer_slug: string | null
  policy_number: string | null
  confidence: number
  full_extraction: FullExtraction
  page_count: number
}

export interface TokenStage {
  prompt: number
  completion: number
  total: number
}

export interface TokenUsage {
  model_used:   string
  ocr:          TokenStage
  index_search: TokenStage
  icd_match:    TokenStage
  evaluation:   TokenStage
  grand_total:  number
}

export interface ClaimEvaluation {
  session_id: string
  insurer: string
  plan_name: string | null
  verdict: Verdict
  verdict_reason: string
  summary_paragraph: string
  icd_codes: IcdCode[]
  missing_items: string[]
  items_to_collect: string[]
  items_to_generate: string[]
  retrieved_sections: string[]
  token_usage: TokenUsage
}

export interface InsurerOption {
  slug: string
  insurer: string
  trees: string[]
}

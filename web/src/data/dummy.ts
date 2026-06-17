export type Verdict = 'APPROVABLE' | 'PARTIAL' | 'REJECTED' | 'UNKNOWN'

export interface IcdCode {
  code: string
  description: string
  scheme_covered: boolean
  restriction_note: string | null
}

export interface Case {
  id: string
  patient_name: string
  age: number
  gender: 'M' | 'F'
  insurer: string
  insurer_slug: string
  plan_name: string
  policy_number: string
  tpa_name: string
  sum_insured: string
  diagnosis: string[]
  procedures: string[]
  admission_date: string
  discharge_date: string | null
  treating_doctor: string
  department: string
  verdict: Verdict
  verdict_reason: string
  summary_paragraph: string
  icd_codes: IcdCode[]
  missing_items: string[]
  retrieved_sections: string[]
  submitted_at: string
}

export const CASES: Case[] = [
  {
    id: 'CS-2024-001',
    patient_name: 'Rajesh Kumar',
    age: 52,
    gender: 'M',
    insurer: 'HDFC ERGO',
    insurer_slug: 'hdfc-ergo',
    plan_name: 'Optima Restore',
    policy_number: 'HDX-2023-99821',
    tpa_name: 'Medi Assist',
    sum_insured: '₹5,00,000',
    diagnosis: ['Type 2 Diabetes Mellitus', 'Diabetic Ketoacidosis'],
    procedures: ['IV fluid resuscitation', 'Insulin infusion protocol'],
    admission_date: '10-06-2024',
    discharge_date: '15-06-2024',
    treating_doctor: 'Dr. Priya Nair',
    department: 'Endocrinology',
    verdict: 'APPROVABLE',
    verdict_reason: 'Primary diagnosis and procedure are covered under the Optima Restore plan with no waiting period restrictions.',
    summary_paragraph: 'Mr. Rajesh Kumar, 52M, was admitted on 10-06-2024 and discharged on 15-06-2024 under Dr. Priya Nair (Endocrinology) at City Hospital, Chennai. Primary diagnosis: Diabetic Ketoacidosis (E11.1) secondary to Type 2 Diabetes Mellitus (E11.9). Procedures performed include IV fluid resuscitation and insulin infusion protocol per standard DKA management guidelines. Policy: HDFC ERGO Optima Restore, Policy No. HDX-2023-99821, TPA: Medi Assist, Sum Insured: ₹5,00,000. Claim type: Cashless. Pre-auth obtained (PA-2024-8821). No co-morbidities noted on case sheet.',
    icd_codes: [
      { code: 'E11.1', description: 'Type 2 diabetes mellitus with ketoacidosis', scheme_covered: true, restriction_note: null },
      { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', scheme_covered: true, restriction_note: null },
    ],
    missing_items: [],
    retrieved_sections: ['Section 2.1 – Coverage for Metabolic Disorders', 'Section 4.3 – DKA Treatment Protocol', 'Cashless Claim Process'],
    submitted_at: '2024-06-15T10:22:00',
  },
  {
    id: 'CS-2024-002',
    patient_name: 'Sunita Rao',
    age: 38,
    gender: 'F',
    insurer: 'Star Health',
    insurer_slug: 'star-health',
    plan_name: 'Medi Classic',
    policy_number: 'SH-2022-44731',
    tpa_name: 'Star TPA',
    sum_insured: '₹3,00,000',
    diagnosis: ['Appendicitis', 'Peritonitis'],
    procedures: ['Laparoscopic Appendectomy'],
    admission_date: '12-06-2024',
    discharge_date: '14-06-2024',
    treating_doctor: 'Dr. Arun Mehta',
    department: 'General Surgery',
    verdict: 'PARTIAL',
    verdict_reason: 'Appendectomy is covered but laparoscopic surcharge exceeds sub-limit for day-care procedures under this plan.',
    summary_paragraph: 'Ms. Sunita Rao, 38F, admitted 12-06-2024 and discharged 14-06-2024 under Dr. Arun Mehta (General Surgery). Primary: Acute Appendicitis with Peritonitis (K37, K65.0). Procedure: Laparoscopic Appendectomy. Policy: Star Health Medi Classic, No. SH-2022-44731, TPA: Star TPA, Sum Insured: ₹3,00,000. Cashless claim. Pre-auth number not found on case sheet. Laparoscopic surcharge of ₹12,000 may exceed sub-limit per policy Schedule II.',
    icd_codes: [
      { code: 'K37', description: 'Unspecified appendicitis', scheme_covered: true, restriction_note: 'Sub-limit ₹40,000 applies' },
      { code: 'K65.0', description: 'Generalised peritonitis', scheme_covered: true, restriction_note: null },
    ],
    missing_items: ['Pre-authorisation number not present on case sheet', 'Surgeon fee break-up not attached'],
    retrieved_sections: ['Section 3.2 – Surgical Sub-limits', 'Laparoscopic Procedures Schedule', 'Pre-auth Requirements'],
    submitted_at: '2024-06-14T14:05:00',
  },
  {
    id: 'CS-2024-003',
    patient_name: 'Mohammed Farooq',
    age: 61,
    gender: 'M',
    insurer: 'Bajaj Allianz',
    insurer_slug: 'bajaj-allianz-life-insurance',
    plan_name: 'Health Guard',
    policy_number: 'BA-2021-18820',
    tpa_name: 'Paramount Health',
    sum_insured: '₹4,00,000',
    diagnosis: ['Chronic Kidney Disease Stage 4', 'Hypertension'],
    procedures: ['Haemodialysis (×3 sessions)'],
    admission_date: '08-06-2024',
    discharge_date: '11-06-2024',
    treating_doctor: 'Dr. Kavitha Subramanian',
    department: 'Nephrology',
    verdict: 'REJECTED',
    verdict_reason: 'CKD-related dialysis has a 24-month waiting period under Health Guard plan; policy is 36 months old but claim falls within exclusion clause 7.2(b) for pre-existing renal disease.',
    summary_paragraph: 'Mr. Mohammed Farooq, 61M, admitted 08-06-2024 and discharged 11-06-2024 under Dr. Kavitha Subramanian (Nephrology). Diagnosis: Chronic Kidney Disease Stage 4 (N18.4), co-morbidity Hypertension (I10). Procedures: 3 sessions of Haemodialysis. Policy: Bajaj Allianz Health Guard, No. BA-2021-18820, TPA: Paramount Health, Sum Insured: ₹4,00,000. Reimbursement claim. Pre-auth not applicable (emergency). Claim rejected per exclusion clause 7.2(b) — pre-existing renal disease declared at inception.',
    icd_codes: [
      { code: 'N18.4', description: 'Chronic kidney disease, stage 4', scheme_covered: false, restriction_note: 'Pre-existing exclusion clause 7.2(b) applies' },
      { code: 'I10', description: 'Essential (primary) hypertension', scheme_covered: true, restriction_note: null },
      { code: 'Z99.2', description: 'Dependence on renal dialysis', scheme_covered: false, restriction_note: 'Linked to excluded condition N18.4' },
    ],
    missing_items: ['Pre-existing disease declaration form (at policy inception) not attached', 'Previous hospitalisation records for renal disease required'],
    retrieved_sections: ['Exclusion Clause 7.2(b) – Pre-existing Renal Disease', 'Dialysis Sub-limit Schedule', 'Waiting Period Table'],
    submitted_at: '2024-06-11T09:48:00',
  },
  {
    id: 'CS-2024-004',
    patient_name: 'Ananya Krishnan',
    age: 29,
    gender: 'F',
    insurer: 'ICICI Prudential',
    insurer_slug: 'icici-prudential-life-insurance',
    plan_name: 'iProtect Smart',
    policy_number: 'ICICI-2023-55210',
    tpa_name: 'Health India TPA',
    sum_insured: '₹10,00,000',
    diagnosis: ['Acute Viral Hepatitis A'],
    procedures: ['Supportive IV therapy', 'Liver function monitoring'],
    admission_date: '13-06-2024',
    discharge_date: null,
    treating_doctor: 'Dr. Ramesh Iyer',
    department: 'Gastroenterology',
    verdict: 'UNKNOWN',
    verdict_reason: 'Discharge date not available; claim evaluation pending final discharge summary.',
    summary_paragraph: 'Ms. Ananya Krishnan, 29F, admitted 13-06-2024 (ongoing) under Dr. Ramesh Iyer (Gastroenterology). Primary: Acute Viral Hepatitis A (B15.9). Procedures: IV supportive therapy, LFT monitoring. Policy: ICICI Prudential iProtect Smart, No. ICICI-2023-55210, TPA: Health India TPA, Sum Insured: ₹10,00,000. Cashless claim. Pre-auth pending. Discharge date not yet available — final evaluation to be completed post-discharge.',
    icd_codes: [
      { code: 'B15.9', description: 'Hepatitis A without hepatic coma', scheme_covered: true, restriction_note: null },
    ],
    missing_items: ['Discharge summary not yet available', 'Final LFT report pending'],
    retrieved_sections: ['Section 1.4 – Infectious Disease Coverage', 'Cashless Pre-auth Process'],
    submitted_at: '2024-06-13T16:30:00',
  },
  {
    id: 'CS-2024-005',
    patient_name: 'Vijay Shankar',
    age: 45,
    gender: 'M',
    insurer: 'LIC',
    insurer_slug: 'lic',
    plan_name: 'Jeevan Arogya',
    policy_number: 'LIC-2020-33012',
    tpa_name: 'LIC TPA',
    sum_insured: '₹2,00,000',
    diagnosis: ['Inguinal Hernia (Right)'],
    procedures: ['Open Herniorrhaphy'],
    admission_date: '09-06-2024',
    discharge_date: '10-06-2024',
    treating_doctor: 'Dr. Suresh Babu',
    department: 'General Surgery',
    verdict: 'APPROVABLE',
    verdict_reason: 'Hernia repair is a listed procedure under Jeevan Arogya with no applicable waiting period for this policy vintage.',
    summary_paragraph: 'Mr. Vijay Shankar, 45M, admitted 09-06-2024 and discharged 10-06-2024 under Dr. Suresh Babu (General Surgery). Diagnosis: Right Inguinal Hernia (K40.9). Procedure: Open Herniorrhaphy. Policy: LIC Jeevan Arogya, No. LIC-2020-33012, TPA: LIC TPA, Sum Insured: ₹2,00,000. Cashless claim. Pre-auth obtained (PA-2024-7741). No co-morbidities.',
    icd_codes: [
      { code: 'K40.9', description: 'Unilateral inguinal hernia, without obstruction or gangrene', scheme_covered: true, restriction_note: null },
    ],
    missing_items: [],
    retrieved_sections: ['Listed Surgical Procedures – Schedule A', 'Day-care Procedure Approval List'],
    submitted_at: '2024-06-10T11:15:00',
  },
]

export const STATS = {
  total: CASES.length,
  approvable: CASES.filter(c => c.verdict === 'APPROVABLE').length,
  partial:    CASES.filter(c => c.verdict === 'PARTIAL').length,
  rejected:   CASES.filter(c => c.verdict === 'REJECTED').length,
  unknown:    CASES.filter(c => c.verdict === 'UNKNOWN').length,
}

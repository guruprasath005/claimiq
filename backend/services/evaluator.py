"""
Claim evaluator — reads the full case extraction + policy tree sections
and produces a comprehensive gap analysis + verdict.
"""

import json
from backend.services.llm import chat, used_fallback
from backend.config import settings
from backend.models.responses import ClaimEvaluation, ClaimVerdict, IcdMatch

EVAL_SYSTEM = """You are a senior RCM (Revenue Cycle Management) specialist for Indian hospitals with deep expertise in insurance claim processing, ICD-10 coding, and TPA requirements.

You will receive:
1. A comprehensive case sheet extraction (structured JSON with patient, clinical, insurance details)
2. Relevant sections from the insurer's policy tree
3. ICD-10 codes already matched

Your job is to cross-reference the case against the scheme and produce a thorough evaluation.

Return a JSON object:
{
  "verdict": "APPROVABLE" | "PARTIAL" | "REJECTED" | "UNKNOWN",
  "verdict_reason": "One clear sentence explaining the primary basis for this verdict",

  "summary_paragraph": "A complete, copy-paste ready paragraph for the TPA reviewer. Include: patient name, age/gender, admission/discharge dates, primary + secondary diagnoses with ICD codes, procedures, treating doctor, facility, policy number, TPA, sum insured, claim type, pre-auth status, co-morbidities, medications. Write as a senior coder addressing the TPA.",

  "missing_items": [
    "List of fields that are PRESENT in the case sheet but incomplete, unclear, or missing critical values"
  ],

  "items_to_collect": [
    "Documents and records that must be OBTAINED from the patient or treating team before claim submission. Examples: original discharge summary signed by doctor, investigation reports with lab header, operation notes, anaesthesia notes, consent forms, ambulance records, previous treatment records, pharmacy bills, etc."
  ],

  "items_to_generate": [
    "Forms, certificates, and documents that the hospital billing team must GENERATE or FILL. Examples: pre-auth form, claim form (Part A and B), indoor case paper certification, sticker with UHI/ROHINI ID, detailed bill with break-up, LAMA form if applicable, death certificate if applicable, implant invoice if applicable, etc."
  ]
}

Be specific and actionable. Name exact documents, not vague categories. If a pre-auth number is present, note it. If claim type is cashless vs reimbursement, tailor the checklist accordingly."""


async def evaluate_claim(
    case_extraction: dict,
    insurer: str,
    plan_name: str | None,
    scheme_sections: list[dict],
    icd_codes: list[IcdMatch],
    session_id: str,
) -> ClaimEvaluation:

    scheme_context = "\n\n".join(
        f"[{s.get('title', '')}]\n{s.get('content', '')}"
        for s in scheme_sections
    )
    icd_summary = json.dumps([c.model_dump() for c in icd_codes], ensure_ascii=False)

    response = await chat(
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": EVAL_SYSTEM},
            {"role": "user", "content": (
                f"Insurer: {insurer} | Plan: {plan_name or 'unknown'}\n\n"
                f"=== CASE SHEET EXTRACTION ===\n{json.dumps(case_extraction, ensure_ascii=False, indent=2)}\n\n"
                f"=== ICD-10 CODES ===\n{icd_summary}\n\n"
                f"=== SCHEME POLICY SECTIONS ===\n{scheme_context}"
            )},
        ],
    )

    usage = response.usage
    eval_tokens = {
        "prompt":     getattr(usage, "prompt_tokens",     0) or 0,
        "completion": getattr(usage, "completion_tokens", 0) or 0,
        "total":      getattr(usage, "total_tokens",      0) or 0,
    } if usage else {}

    model_name = settings.fallback_model if used_fallback(response) else settings.llm_model

    raw = json.loads(response.choices[0].message.content)
    return ClaimEvaluation(
        session_id=session_id,
        insurer=insurer,
        plan_name=plan_name,
        verdict=ClaimVerdict(raw["verdict"]),
        verdict_reason=raw["verdict_reason"],
        summary_paragraph=raw["summary_paragraph"],
        icd_codes=icd_codes,
        missing_items=raw.get("missing_items", []),
        items_to_collect=raw.get("items_to_collect", []),
        items_to_generate=raw.get("items_to_generate", []),
        retrieved_sections=[s.get("title", "") for s in scheme_sections],
        token_usage={"evaluation": eval_tokens, "model_used": model_name},
    )

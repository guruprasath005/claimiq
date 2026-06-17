"""
POST /evaluate  — full pipeline: PageIndex search → ICD match → evaluation.
"""

from datetime import datetime
from fastapi import APIRouter
import psycopg2.extras

from backend.models.requests import EvaluateRequest
from backend.models.responses import ClaimEvaluation
from backend.services.pageindex import search_insurer
from backend.services.icd_matcher import match_icd
from backend.services.evaluator import evaluate_claim
from backend.routers.upload import get_session
from backend.config import settings

router = APIRouter(prefix="/evaluate", tags=["evaluate"])


def _save_case(evaluation: ClaimEvaluation, flat: dict, insurer_slug: str) -> str:
    from backend.db import get_conn

    year = datetime.now().year
    with get_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cur.execute("SELECT COUNT(*) FROM cases WHERE id LIKE %s", (f"CS-{year}-%",))
        n = cur.fetchone()["count"] + 1
        case_id = f"CS-{year}-{n:03d}"

        patient_age = None
        dob = flat.get("dob")
        if dob:
            try:
                from dateutil.parser import parse as parse_date
                patient_age = (datetime.now() - parse_date(dob)).days // 365
            except Exception:
                pass

        cur.execute("""
            INSERT INTO cases (
                id, session_id,
                patient_name, patient_age, patient_gender,
                insurer_name, insurer_slug,
                plan_name, policy_number,
                admission_date, discharge_date,
                diagnosis, procedures,
                verdict, verdict_reason, summary_paragraph
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
        """, (
            case_id, evaluation.session_id,
            flat.get("patient_name"), patient_age, flat.get("gender"),
            flat.get("insurer_name") or evaluation.insurer, insurer_slug,
            evaluation.plan_name, flat.get("policy_number"),
            flat.get("admission_date"), flat.get("discharge_date"),
            flat.get("diagnosis", []), flat.get("procedures", []),
            evaluation.verdict.value, evaluation.verdict_reason,
            evaluation.summary_paragraph,
        ))

        for i, icd in enumerate(evaluation.icd_codes):
            cur.execute("""
                INSERT INTO case_icd_codes
                    (case_id, code, description, scheme_covered, restriction_note, sort_order)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (case_id, icd.code, icd.description, icd.scheme_covered, icd.restriction_note, i))

        for i, item in enumerate(evaluation.missing_items):
            cur.execute("""
                INSERT INTO case_missing_items (case_id, description, sort_order)
                VALUES (%s, %s, %s)
            """, (case_id, item, i))

        for i, section in enumerate(evaluation.retrieved_sections):
            cur.execute("""
                INSERT INTO case_retrieved_sections (case_id, section_title, sort_order)
                VALUES (%s, %s, %s)
            """, (case_id, section, i))

    return case_id


@router.post("", response_model=ClaimEvaluation)
async def run_evaluation(req: EvaluateRequest):
    session      = get_session(req.session_id)
    flat         = session["ocr"]
    insurer_slug = req.insurer_slug or session.get("insurer_slug")
    plan_name    = req.plan_name or session.get("plan_name")

    # Use doctor-edited extraction if provided, else the original
    case_extraction = req.edited_extraction or session.get("extraction", flat)

    # Derive diagnoses/procedures for ICD matching from the extraction
    dx_block   = (case_extraction.get("diagnosis") or {}) if isinstance(case_extraction.get("diagnosis"), dict) else {}
    diagnoses  = [d for d in [
        dx_block.get("primary_diagnosis"),
        *( dx_block.get("secondary_diagnoses") or []),
    ] if d] or flat.get("diagnosis", [])
    procedures = case_extraction.get("procedures", flat.get("procedures", []))

    clinical_query = (
        f"Diagnoses: {', '.join(diagnoses)}. "
        f"Procedures: {', '.join(procedures)}. "
        f"Claim type: {((case_extraction.get('insurance') or {}).get('claim_type') or 'cashless hospitalisation')}. "
        f"Plan: {plan_name or 'unknown'}."
    )

    relevant_nodes, index_tokens = await search_insurer(insurer_slug, clinical_query)
    icd_codes, icd_tokens       = await match_icd(diagnoses, procedures, relevant_nodes)
    evaluation                  = await evaluate_claim(
        case_extraction=case_extraction,
        insurer=insurer_slug,
        plan_name=plan_name,
        scheme_sections=relevant_nodes,
        icd_codes=icd_codes,
        session_id=req.session_id,
    )

    # Aggregate token usage across all stages
    ocr_tokens = session.get("ocr_tokens", {})

    def _total(d: dict) -> int:
        return d.get("total", d.get("prompt", 0) + d.get("completion", 0))

    grand_total = _total(ocr_tokens) + _total(index_tokens) + _total(icd_tokens) + _total(evaluation.token_usage.get("evaluation", {}))
    evaluation.token_usage = {
        "model_used":   evaluation.token_usage.get("model_used", settings.llm_model),
        "ocr":          ocr_tokens,
        "index_search": index_tokens,
        "icd_match":    icd_tokens,
        "evaluation":   evaluation.token_usage.get("evaluation", {}),
        "grand_total":  grand_total,
    }

    try:
        _save_case(evaluation, flat, insurer_slug)
    except Exception as e:
        print(f"[WARN] DB save failed: {e}")

    return evaluation

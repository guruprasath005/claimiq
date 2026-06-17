"""
GET  /cases         — list all cases (no child joins)
GET  /cases/stats   — verdict counts + weekly + monthly charts
GET  /cases/{id}    — full case with icd_codes, missing_items, retrieved_sections
POST /cases         — create case (called internally by evaluate)
PATCH /cases/{id}   — override verdict
"""

from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import psycopg2.extras

from backend.db import get_conn

router = APIRouter(prefix="/cases", tags=["cases"])


class VerdictPatch(BaseModel):
    verdict: str
    verdict_reason: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _row_to_case(row: dict, full: bool = False) -> dict:
    submitted = row.get("created_at")
    return {
        "id":                 row["id"],
        "patient_name":       row.get("patient_name"),
        "age":                row.get("patient_age"),
        "gender":             row.get("patient_gender"),
        "insurer":            row.get("insurer_name"),
        "insurer_slug":       row.get("insurer_slug"),
        "plan_name":          row.get("plan_name"),
        "policy_number":      row.get("policy_number"),
        "tpa_name":           row.get("tpa_name"),
        "sum_insured":        row.get("sum_insured"),
        "diagnosis":          row.get("diagnosis") or [],
        "procedures":         row.get("procedures") or [],
        "admission_date":     str(row["admission_date"]) if row.get("admission_date") else None,
        "discharge_date":     str(row["discharge_date"]) if row.get("discharge_date") else None,
        "treating_doctor":    row.get("treating_doctor"),
        "department":         row.get("department"),
        "verdict":            row.get("verdict", "UNKNOWN"),
        "verdict_reason":     row.get("verdict_reason"),
        "summary_paragraph":  row.get("summary_paragraph"),
        "icd_codes":          row.get("icd_codes", []) if full else [],
        "missing_items":      row.get("missing_items", []) if full else [],
        "retrieved_sections": row.get("retrieved_sections", []) if full else [],
        "submitted_at":       submitted.isoformat() if submitted else datetime.now().isoformat(),
    }


def next_case_id(cur) -> str:
    year = datetime.now().year
    cur.execute("SELECT COUNT(*) FROM cases WHERE id LIKE %s", (f"CS-{year}-%",))
    n = cur.fetchone()[0] + 1
    return f"CS-{year}-{n:03d}"


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats():
    with get_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cur.execute("""
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN verdict = 'APPROVABLE' THEN 1 ELSE 0 END) AS approvable,
                SUM(CASE WHEN verdict = 'PARTIAL'    THEN 1 ELSE 0 END) AS partial,
                SUM(CASE WHEN verdict = 'REJECTED'   THEN 1 ELSE 0 END) AS rejected,
                SUM(CASE WHEN verdict = 'UNKNOWN'    THEN 1 ELSE 0 END) AS unknown
            FROM cases
        """)
        counts = dict(cur.fetchone() or {})

        cur.execute("""
            SELECT
                to_char(created_at, 'Dy') AS day,
                COUNT(*) AS total,
                ROUND(100.0 * SUM(CASE WHEN verdict='APPROVABLE' THEN 1 ELSE 0 END)
                      / NULLIF(COUNT(*), 0)) AS pct
            FROM cases
            WHERE created_at >= NOW() - INTERVAL '7 days'
            GROUP BY date_trunc('day', created_at), to_char(created_at, 'Dy')
            ORDER BY date_trunc('day', created_at)
        """)
        weekly_rows = list(cur.fetchall())

        cur.execute("""
            SELECT
                to_char(date_trunc('month', created_at), 'Mon') AS month,
                COUNT(*) AS cases,
                SUM(CASE WHEN verdict='APPROVABLE' THEN 1 ELSE 0 END) AS approved
            FROM cases
            WHERE created_at >= NOW() - INTERVAL '6 months'
            GROUP BY date_trunc('month', created_at)
            ORDER BY date_trunc('month', created_at)
        """)
        monthly_rows = list(cur.fetchall())

    total      = int(counts.get("total") or 0)
    approvable = int(counts.get("approvable") or 0)
    rejected   = int(counts.get("rejected") or 0)

    weekly = [{"day": r["day"], "total": int(r["total"]), "pct": int(r["pct"] or 0)}
              for r in weekly_rows]
    if weekly:
        weekly[-1]["day"] = "Today"
    else:
        weekly = [{"day": d, "total": 0, "pct": 0}
                  for d in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"]]

    monthly = [{"month": r["month"], "cases": int(r["cases"]), "approved": int(r["approved"])}
               for r in monthly_rows]

    return {
        "total":               total,
        "approvable":          approvable,
        "partial":             int(counts.get("partial") or 0),
        "rejected":            rejected,
        "unknown":             int(counts.get("unknown") or 0),
        "approved_value_lakh": 0.0,
        "avg_tat_hours":       0.0,
        "rejection_pct":       round(100 * rejected / total, 1) if total else 0.0,
        "weekly":              weekly,
        "monthly":             monthly,
    }


@router.get("")
def list_cases():
    with get_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM cases ORDER BY created_at DESC")
        rows = cur.fetchall()
    return [_row_to_case(dict(r)) for r in rows]


@router.get("/{case_id}")
def get_case(case_id: str):
    with get_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cur.execute("SELECT * FROM cases WHERE id = %s", (case_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, f"Case {case_id} not found")
        case = dict(row)

        cur.execute("""
            SELECT code, description, scheme_covered, restriction_note
            FROM case_icd_codes WHERE case_id = %s ORDER BY sort_order
        """, (case_id,))
        case["icd_codes"] = [dict(r) for r in cur.fetchall()]

        cur.execute("""
            SELECT description FROM case_missing_items
            WHERE case_id = %s ORDER BY sort_order
        """, (case_id,))
        case["missing_items"] = [r["description"] for r in cur.fetchall()]

        cur.execute("""
            SELECT section_title FROM case_retrieved_sections
            WHERE case_id = %s ORDER BY sort_order
        """, (case_id,))
        case["retrieved_sections"] = [r["section_title"] for r in cur.fetchall()]

    return _row_to_case(case, full=True)


@router.patch("/{case_id}")
def update_verdict(case_id: str, body: VerdictPatch):
    if body.verdict not in ("APPROVABLE", "PARTIAL", "REJECTED", "UNKNOWN"):
        raise HTTPException(400, "Invalid verdict")
    with get_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            UPDATE cases SET verdict = %s, verdict_reason = %s
            WHERE id = %s RETURNING *
        """, (body.verdict, body.verdict_reason, case_id))
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, f"Case {case_id} not found")
    return _row_to_case(dict(row))

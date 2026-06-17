"""GET /reports/summary — analytics for the Reports page."""

from fastapi import APIRouter
import psycopg2.extras
from backend.db import get_conn

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/summary")
def get_report_summary():
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
                to_char(date_trunc('month', created_at), 'Mon') AS month,
                COUNT(*) AS cases,
                SUM(CASE WHEN verdict='APPROVABLE' THEN 1 ELSE 0 END) AS approved
            FROM cases
            WHERE created_at >= NOW() - INTERVAL '6 months'
            GROUP BY date_trunc('month', created_at)
            ORDER BY date_trunc('month', created_at)
        """)
        monthly = [{"month": r["month"], "cases": int(r["cases"]), "approved": int(r["approved"])}
                   for r in cur.fetchall()]

        cur.execute("""
            SELECT
                insurer_name AS insurer,
                plan_name    AS plan,
                COUNT(*) AS cases,
                SUM(CASE WHEN verdict='APPROVABLE' THEN 1 ELSE 0 END) AS approved
            FROM cases
            WHERE insurer_name IS NOT NULL
            GROUP BY insurer_name, plan_name
            ORDER BY cases DESC
            LIMIT 10
        """)
        insurer_stats = [
            {
                "insurer":  r["insurer"],
                "plan":     r["plan"] or "",
                "cases":    int(r["cases"]),
                "approved": int(r["approved"]),
                "avgClaim": "—",
                "tat":      "—",
            }
            for r in cur.fetchall()
        ]

        cur.execute("""
            SELECT mi.description AS reason, COUNT(*) AS count
            FROM case_missing_items mi
            JOIN cases c ON mi.case_id = c.id
            WHERE c.verdict = 'REJECTED'
            GROUP BY mi.description
            ORDER BY count DESC
            LIMIT 5
        """)
        rejection_rows = list(cur.fetchall())

    total      = int(counts.get("total") or 0)
    approvable = int(counts.get("approvable") or 0)

    total_rej_items = sum(int(r["count"]) for r in rejection_rows)
    rejection_reasons = [
        {
            "reason": r["reason"],
            "count":  int(r["count"]),
            "pct":    round(100 * int(r["count"]) / total_rej_items) if total_rej_items else 0,
        }
        for r in rejection_rows
    ]

    return {
        "total":             total,
        "approval_rate":     round(100 * approvable / total) if total else 0,
        "approved_value":    "—",
        "avg_tat":           "—",
        "verdict_counts": {
            "approvable": approvable,
            "partial":    int(counts.get("partial") or 0),
            "rejected":   int(counts.get("rejected") or 0),
            "unknown":    int(counts.get("unknown") or 0),
        },
        "monthly":           monthly,
        "insurer_stats":     insurer_stats,
        "rejection_reasons": rejection_reasons,
    }

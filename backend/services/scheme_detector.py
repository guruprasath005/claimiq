"""
Detects which insurer the patient belongs to from OCR output.

Reads the master index.json to know which insurers are indexed.
Falls back to None so the UI can ask the doctor to confirm/select.
"""

import json
from backend.config import settings


def get_available_insurers() -> list[dict]:
    """Returns list of {slug, insurer, trees} from master index."""
    index_path = settings.tree_index_dir / "index.json"
    if not index_path.exists():
        # Fallback: scan subdirectories
        return [
            {"slug": d.name, "insurer": d.name.replace("-", " ").title(), "trees": []}
            for d in sorted(settings.tree_index_dir.iterdir())
            if d.is_dir()
        ]
    data = json.loads(index_path.read_text())
    return data.get("insurers", [])


def detect_scheme(insurer_name_raw: str | None) -> str | None:
    """
    Match raw OCR insurer name (e.g. "Star Health & Allied Insurance")
    to an indexed slug (e.g. "star-health"). Returns None if no confident match.
    """
    if not insurer_name_raw:
        return None

    query     = insurer_name_raw.lower()
    available = get_available_insurers()

    # Try substring match against known insurer names
    for item in available:
        name_lower = item["insurer"].lower()
        # "hdfc ergo" in "hdfc ergo general insurance" or vice versa
        if name_lower in query or query in name_lower:
            return item["slug"]

    # Word-overlap scoring — pick insurer with most shared meaningful words
    best_slug, best_score = None, 0
    for item in available:
        words = [w for w in item["insurer"].lower().split() if len(w) > 3]
        score = sum(1 for w in words if w in query)
        if score > best_score:
            best_score, best_slug = score, item["slug"]

    return best_slug if best_score >= 2 else None

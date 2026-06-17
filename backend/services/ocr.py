"""
OCR service — extracts comprehensive structured data from case sheet images.
Supports single and multi-page (consolidated) extraction.
"""

import io
import json
import base64
from PIL import Image
from backend.services.llm import chat

_MAX_PX   = 1536   # max dimension sent to LLM
_JPEG_Q   = 85     # JPEG quality for re-encoded images


def _compress(image_bytes: bytes) -> tuple[bytes, str]:
    """Resize to max _MAX_PX on longest side and re-encode as JPEG."""
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        w, h = img.size
        if max(w, h) > _MAX_PX:
            scale = _MAX_PX / max(w, h)
            img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=_JPEG_Q, optimize=True)
        return buf.getvalue(), "image/jpeg"
    except Exception:
        return image_bytes, "image/jpeg"

EXTRACTION_PROMPT = """You are a medical document parser for Indian hospitals. Extract EVERY piece of information visible in this case sheet image.

Return this exact JSON structure. Use null for missing fields, [] for missing lists. Do NOT skip any field — if it's partially visible, extract what you can.

{
  "patient": {
    "name": null, "age": null, "dob": null, "gender": null, "blood_group": null,
    "address": null, "contact_number": null, "uhid": null, "ip_number": null, "emergency_contact": null
  },
  "admission": {
    "date": null, "time": null, "type": null, "ward": null, "bed_number": null,
    "department": null, "discharge_date": null, "discharge_time": null,
    "discharge_condition": null, "length_of_stay": null
  },
  "doctors": {
    "treating_doctor": null, "consultant": null, "referring_doctor": null,
    "surgeon": null, "anaesthetist": null
  },
  "vitals": {
    "blood_pressure": null, "pulse_rate": null, "temperature": null,
    "respiratory_rate": null, "spo2": null, "weight": null, "height": null, "bmi": null
  },
  "clinical": {
    "chief_complaints": [], "history_of_present_illness": null,
    "past_medical_history": [], "family_history": null,
    "personal_history": null, "examination_findings": null, "systemic_examination": null
  },
  "investigations": [],
  "diagnosis": {
    "provisional_diagnosis": null, "primary_diagnosis": null,
    "secondary_diagnoses": [], "final_diagnosis": null, "comorbidities": []
  },
  "procedures": [],
  "surgery": {
    "procedure_name": null, "date": null, "type": null, "anaesthesia_type": null,
    "duration": null, "operative_findings": null, "complications": null, "implants_used": null
  },
  "medications": [],
  "insurance": {
    "insurer_name": null, "tpa_name": null, "policy_number": null, "member_id": null,
    "group_policy_number": null, "sum_insured": null, "pre_auth_number": null,
    "claim_type": null, "employee_id": null, "corporate_name": null
  },
  "facility": {
    "hospital_name": null, "registration_number": null,
    "rohini_id": null, "address": null, "accreditation": null
  },
  "confidence": 0.0
}

For investigations: {"test": "...", "result": "...", "unit": "...", "reference_range": "...", "date": "..."}
For medications: {"drug": "...", "dose": "...", "route": "...", "frequency": "...", "duration": "..."}
For procedures: list of strings.

Return ONLY valid JSON. No explanation, no markdown."""

CONSOLIDATION_PROMPT = """You are merging multiple case sheet page extractions from the SAME patient into one unified record.

Rules:
- Prefer non-null values over null
- For conflicts, choose the more specific/complete value
- Merge all list fields (investigations, medications, procedures, chief_complaints, etc.) — deduplicate by meaning, not exact string
- Average the confidence scores
- Keep the same JSON structure

Return a single merged JSON object with the same structure. Return ONLY valid JSON."""


def _build_flat(data: dict) -> dict:
    """Build backward-compat flat fields from the full extraction."""
    ins = data.get("insurance", {}) or {}
    dx  = data.get("diagnosis",  {}) or {}
    adm = data.get("admission",  {}) or {}
    pat = data.get("patient",    {}) or {}
    doc = data.get("doctors",    {}) or {}
    return {
        "patient_name":    pat.get("name"),
        "dob":             pat.get("dob"),
        "gender":          pat.get("gender"),
        "diagnosis":       [d for d in [dx.get("primary_diagnosis")] + (dx.get("secondary_diagnoses") or []) if d],
        "procedures":      data.get("procedures", []),
        "medications":     [f"{m.get('drug','')} {m.get('dose','')}".strip() for m in (data.get("medications") or [])],
        "admission_date":  adm.get("date"),
        "discharge_date":  adm.get("discharge_date"),
        "insurer_name":    ins.get("insurer_name"),
        "policy_number":   ins.get("policy_number"),
        "tpa_name":        ins.get("tpa_name"),
        "sum_insured":     ins.get("sum_insured"),
        "treating_doctor": doc.get("treating_doctor"),
        "department":      adm.get("department"),
        "confidence":      float(data.get("confidence", 0.5)),
    }


def _add_usage(acc: dict, usage) -> None:
    """Add an OpenAI usage object into an accumulator dict."""
    if usage is None:
        return
    acc["prompt"]     = acc.get("prompt",     0) + (getattr(usage, "prompt_tokens",     0) or 0)
    acc["completion"] = acc.get("completion", 0) + (getattr(usage, "completion_tokens", 0) or 0)
    acc["total"]      = acc.get("total",      0) + (getattr(usage, "total_tokens",      0) or 0)


async def _extract_single(image_bytes: bytes, mime_type: str) -> tuple[dict, dict]:
    """Extract from one image page. Returns (data, usage)."""
    image_bytes, mime_type = _compress(image_bytes)
    b64 = base64.b64encode(image_bytes).decode()
    response = await chat(
        response_format={"type": "json_object"},
        messages=[{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64}"}},
                {"type": "text",      "text": EXTRACTION_PROMPT},
            ],
        }],
        timeout=120,
    )
    usage: dict = {}
    _add_usage(usage, response.usage)
    return json.loads(response.choices[0].message.content or "{}"), usage


async def _consolidate(pages: list[dict]) -> tuple[dict, dict]:
    """Merge multiple page extractions into one unified record. Returns (merged, usage)."""
    if len(pages) == 1:
        return pages[0], {}

    pages_text = "\n\n".join(
        f"--- PAGE {i+1} ---\n{json.dumps(p, ensure_ascii=False)}"
        for i, p in enumerate(pages)
    )
    response = await chat(
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": CONSOLIDATION_PROMPT},
            {"role": "user",   "content": pages_text},
        ],
        timeout=120,
    )
    usage: dict = {}
    _add_usage(usage, response.usage)
    return json.loads(response.choices[0].message.content or "{}"), usage


async def run_ocr(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    """Extract from a single image."""
    data, usage = await _extract_single(image_bytes, mime_type)
    data["_flat"]       = _build_flat(data)
    data["_ocr_tokens"] = usage
    return data


async def run_ocr_multi(pages: list[tuple[bytes, str]]) -> dict:
    """
    Extract from multiple images and consolidate into one record.
    pages: list of (image_bytes, mime_type)
    """
    import asyncio

    results = await asyncio.gather(*[
        _extract_single(img, mime) for img, mime in pages
    ])
    extractions = [r[0] for r in results]
    page_usages = [r[1] for r in results]

    merged, consolidate_usage = await _consolidate(extractions)

    # Aggregate all OCR token counts
    ocr_tokens: dict = {}
    for u in page_usages:
        _add_usage(ocr_tokens, type("U", (), u)() if u else None)
    # Simpler: accumulate manually
    ocr_tokens = {}
    for u in page_usages:
        for k, v in u.items():
            ocr_tokens[k] = ocr_tokens.get(k, 0) + v
    for k, v in consolidate_usage.items():
        ocr_tokens[k] = ocr_tokens.get(k, 0) + v

    merged["_flat"]       = _build_flat(merged)
    merged["_page_count"] = len(pages)
    merged["_page_confidences"] = [float(e.get("confidence", 0.5)) for e in extractions]
    merged["_ocr_tokens"] = ocr_tokens
    return merged

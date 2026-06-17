"""
POST /upload  — accepts one or more case sheet images, runs OCR on each page,
               consolidates into a single extraction, returns session + full result.
"""

import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List
from backend.services.ocr import run_ocr, run_ocr_multi
from backend.services.scheme_detector import detect_scheme
from backend.models.responses import OcrResult
from backend.config import settings

router = APIRouter(prefix="/upload", tags=["upload"])

_sessions: dict[str, dict] = {}


@router.post("", response_model=OcrResult)
async def upload_case_sheet(files: List[UploadFile] = File(...)):
    if not files:
        raise HTTPException(400, "No files provided.")

    for f in files:
        mb = (f.size or 0) / 1_048_576
        if mb > settings.max_upload_mb:
            raise HTTPException(413, f"File '{f.filename}' too large ({mb:.1f} MB). Max {settings.max_upload_mb} MB.")

    if len(files) == 1:
        image_bytes = await files[0].read()
        extraction  = await run_ocr(image_bytes, mime_type=files[0].content_type or "image/jpeg")
    else:
        pages = [(await f.read(), f.content_type or "image/jpeg") for f in files]
        extraction = await run_ocr_multi(pages)

    flat = extraction.get("_flat", {})
    ins  = extraction.get("insurance", {}) or {}

    insurer_raw  = flat.get("insurer_name") or ins.get("insurer_name")
    insurer_slug = detect_scheme(insurer_raw)

    session_id = str(uuid.uuid4())
    _sessions[session_id] = {
        "ocr":          flat,
        "extraction":   extraction,
        "insurer_slug": insurer_slug,
        "page_count":   extraction.get("_page_count", 1),
        "ocr_tokens":   extraction.get("_ocr_tokens", {}),
    }

    return OcrResult(
        session_id=session_id,
        patient_name=flat.get("patient_name"),
        dob=flat.get("dob"),
        gender=flat.get("gender"),
        diagnosis=flat.get("diagnosis", []),
        procedures=flat.get("procedures", []),
        medications=flat.get("medications", []),
        admission_date=flat.get("admission_date"),
        discharge_date=flat.get("discharge_date"),
        insurer_detected=insurer_raw,
        insurer_slug=insurer_slug,
        policy_number=flat.get("policy_number"),
        confidence=flat.get("confidence", 0.5),
        full_extraction=extraction,
        page_count=extraction.get("_page_count", 1),
    )


def get_session(session_id: str) -> dict:
    if session_id not in _sessions:
        raise HTTPException(404, "Session not found or expired.")
    return _sessions[session_id]

from pydantic import BaseModel
from typing import Optional
from enum import Enum


class ClaimVerdict(str, Enum):
    approvable = "APPROVABLE"
    partial    = "PARTIAL"
    rejected   = "REJECTED"
    unknown    = "UNKNOWN"


class OcrResult(BaseModel):
    session_id: str
    # Flat fields (backward compat, derived from full_extraction)
    patient_name: Optional[str]
    dob: Optional[str]
    gender: Optional[str]
    diagnosis: list[str]
    procedures: list[str]
    medications: list[str]
    admission_date: Optional[str]
    discharge_date: Optional[str]
    insurer_detected: Optional[str]
    insurer_slug: Optional[str]
    policy_number: Optional[str]
    confidence: float
    # Full structured extraction — everything the model found
    full_extraction: dict = {}
    page_count: int = 1


class IcdMatch(BaseModel):
    code: str
    description: str
    scheme_covered: bool
    restriction_note: Optional[str]


class ClaimEvaluation(BaseModel):
    session_id: str
    insurer: str
    plan_name: Optional[str]
    verdict: ClaimVerdict
    verdict_reason: str
    summary_paragraph: str
    icd_codes: list[IcdMatch]
    missing_items: list[str]
    items_to_collect: list[str]
    items_to_generate: list[str]
    retrieved_sections: list[str]
    token_usage: dict = {}           # per-stage token counts; includes "model_used" key

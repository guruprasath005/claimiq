from pydantic import BaseModel
from typing import Optional


class SchemeConfirmRequest(BaseModel):
    session_id: str
    insurer_slug: str
    plan_name: Optional[str] = None


class EvaluateRequest(BaseModel):
    session_id: str
    insurer_slug: str
    plan_name: Optional[str] = None
    edited_extraction: Optional[dict] = None  # doctor-corrected extraction from frontend

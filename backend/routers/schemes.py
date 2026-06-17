"""
GET  /schemes          — list all indexed insurers (for scheme selection UI)
POST /schemes/confirm  — doctor confirms / overrides the detected scheme
"""

from fastapi import APIRouter
from backend.services.scheme_detector import get_available_insurers
from backend.models.requests import SchemeConfirmRequest
from backend.routers.upload import get_session, _sessions

router = APIRouter(prefix="/schemes", tags=["schemes"])


@router.get("")
async def list_schemes():
    """Returns all insurers that have a built PageIndex tree."""
    return {"insurers": get_available_insurers()}


@router.post("/confirm")
async def confirm_scheme(req: SchemeConfirmRequest):
    """
    Called when the doctor manually selects or overrides the scheme.
    Updates the session with the confirmed insurer slug.
    """
    session = get_session(req.session_id)
    session["insurer_slug"] = req.insurer_slug
    session["plan_name"]    = req.plan_name
    _sessions[req.session_id] = session
    return {"status": "confirmed", "insurer_slug": req.insurer_slug}

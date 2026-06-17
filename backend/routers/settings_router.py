"""GET /settings + PATCH /settings — read/write config via .env."""

from pathlib import Path
from fastapi import APIRouter
from dotenv import set_key
from backend.config import settings

router = APIRouter(prefix="/settings", tags=["settings"])

ENV_FILE = str(Path(__file__).parent.parent.parent / ".env")

_ENV_MAP = {
    "openai_base_url": "OPENAI_BASE_URL",
    "llm_model":       "LLM_MODEL",
    "max_upload_mb":   "MAX_UPLOAD_MB",
}


@router.get("")
def get_settings():
    return {
        "openai_base_url": settings.openai_base_url,
        "llm_model":       settings.llm_model,
        "max_upload_mb":   settings.max_upload_mb,
        "cors_origins":    settings.cors_origins,
    }


@router.patch("")
def save_settings(body: dict):
    for field, env_key in _ENV_MAP.items():
        if field in body:
            set_key(ENV_FILE, env_key, str(body[field]))
    return {"status": "saved"}

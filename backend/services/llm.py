"""
Central LLM call wrapper with Gemma → GPT-4o-mini fallback.

All services call `chat()` instead of constructing their own clients.
If the primary vllm endpoint is unreachable or times out, the call is
transparently retried against the OpenAI fallback (if FALLBACK_API_KEY is set).

gpt-4o-mini supports vision, so images are passed through unchanged on fallback.
"""

import logging
from typing import Any

import httpx
from openai import AsyncOpenAI, APIConnectionError, APITimeoutError, APIStatusError

from backend.config import settings

log = logging.getLogger(__name__)

# Primary: local vllm serving Gemma
_primary = AsyncOpenAI(
    api_key=settings.llm_api_key,
    base_url=settings.openai_base_url,
)

# Fallback: OpenAI GPT-4o-mini (None if key not configured)
_fallback: AsyncOpenAI | None = (
    AsyncOpenAI(api_key=settings.fallback_api_key)
    if settings.fallback_enabled
    else None
)

# Errors that indicate the primary endpoint is unreachable (not a bad request)
_NETWORK_ERRORS = (
    APIConnectionError,
    APITimeoutError,
    httpx.ConnectError,
    httpx.ReadTimeout,
    httpx.ConnectTimeout,
    httpx.RemoteProtocolError,
)


async def chat(
    messages: list[dict],
    response_format: dict | None = None,
    timeout: float = 120,
    **kwargs: Any,
) -> Any:
    """
    Send a chat completion request. Tries primary (Gemma) first.
    On network/timeout failure, retries with fallback if configured.

    gpt-4o-mini supports vision — images are passed through as-is.
    Returns the raw ChatCompletion response object.
    """
    req = dict(
        model=settings.llm_model,
        messages=messages,
        timeout=timeout,
        **kwargs,
    )
    if response_format:
        req["response_format"] = response_format

    try:
        response = await _primary.chat.completions.create(**req)
        return response

    except _NETWORK_ERRORS as exc:
        if _fallback is None:
            raise RuntimeError(
                f"Gemma endpoint unreachable ({exc}) and no fallback API key configured. "
                "Set FALLBACK_API_KEY in .env to enable GPT-4o-mini fallback."
            ) from exc

        log.warning("Gemma unreachable (%s) — falling back to %s", exc, settings.fallback_model)
        # gpt-4o-mini supports vision — pass messages unchanged, just swap the model
        fallback_req = {**req, "model": settings.fallback_model}
        response = await _fallback.chat.completions.create(**fallback_req)
        response._used_fallback = True  # type: ignore[attr-defined]
        return response

    except APIStatusError as exc:
        # 5xx from vllm → also try fallback
        if exc.status_code >= 500 and _fallback is not None:
            log.warning("Gemma returned %s — falling back to %s", exc.status_code, settings.fallback_model)
            fallback_req = {**req, "model": settings.fallback_model}
            response = await _fallback.chat.completions.create(**fallback_req)
            response._used_fallback = True  # type: ignore[attr-defined]
            return response
        raise


def used_fallback(response: Any) -> bool:
    return bool(getattr(response, "_used_fallback", False))

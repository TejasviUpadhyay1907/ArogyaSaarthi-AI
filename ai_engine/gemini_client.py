"""Gemini client — uses google-genai SDK (v1+) with timeout + safe fallback."""

import os
import logging
import json

logger = logging.getLogger(__name__)

_client = None
_model_name = None
_enabled = False


def _init():
    global _client, _model_name, _enabled
    api_key = os.getenv("LLM_API_KEY", "").strip()
    use_llm = os.getenv("USE_LLM", "true").lower() == "true"
    provider = os.getenv("LLM_PROVIDER", "gemini").lower()
    _model_name = os.getenv("MODEL_NAME", "gemini-1.5-flash")

    if not use_llm:
        logger.info("[Gemini] USE_LLM=false — Gemini disabled, using local fallback.")
        _enabled = False
        return

    if provider != "gemini":
        logger.info(f"[Gemini] Provider is '{provider}', not gemini — skipping Gemini init.")
        _enabled = False
        return

    if not api_key:
        logger.warning("[Gemini] USE_LLM=true but LLM_API_KEY is empty — falling back to local extraction.")
        _enabled = False
        return

    try:
        from google import genai
        _client = genai.Client(api_key=api_key)
        _enabled = True
        logger.info(f"[Gemini] Initialized with model={_model_name}")
    except ImportError:
        logger.warning("[Gemini] google-genai not installed — falling back to local extraction.")
        _enabled = False
    except Exception as e:
        logger.warning(f"[Gemini] Init failed: {type(e).__name__} — falling back to local extraction.")
        _enabled = False


_init()


def is_enabled() -> bool:
    return _enabled and _client is not None


def call_gemini(prompt: str, timeout: int = 20) -> str | None:
    """
    Call Gemini with the given prompt. Returns text response or None on any failure.
    Never logs the API key.
    """
    if not is_enabled():
        return None

    try:
        import concurrent.futures
        from google import genai as _genai

        def _call():
            response = _client.models.generate_content(
                model=_model_name,
                contents=prompt,
            )
            return response.text

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_call)
            text = future.result(timeout=timeout)
        return text.strip() if text else None
    except Exception as e:
        logger.warning(f"[Gemini] call_gemini failed: {type(e).__name__}: {str(e)[:120]}")
        return None


def call_gemini_json(prompt: str, timeout: int = 20) -> dict | None:
    """
    Call Gemini expecting a JSON response. Strips markdown fences and parses.
    Returns parsed dict or None on failure.
    """
    raw = call_gemini(prompt, timeout=timeout)
    if raw is None:
        return None
    try:
        text = raw.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            text = "\n".join(lines).strip()
        return json.loads(text)
    except (json.JSONDecodeError, ValueError) as e:
        logger.warning(f"[Gemini] JSON parse failed: {e} — raw: {raw[:200]}")
        return None

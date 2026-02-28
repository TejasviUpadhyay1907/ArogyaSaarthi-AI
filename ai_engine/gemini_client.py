"""
Gemini client — google-genai SDK with:
- System prompt injection
- Structured JSON output enforcement
- Retry-with-repair on invalid JSON
- In-memory cache (10 min TTL) keyed by (message_hash, language)
- 429 / quota error detection
- Never logs API key
"""

import os
import json
import hashlib
import logging
import time
import threading

logger = logging.getLogger(__name__)

_client = None
_model_name = None
_enabled = False

# ── In-memory cache ────────────────────────────────────────────────────────
_cache: dict = {}          # key -> {"value": dict, "expires": float}
_cache_lock = threading.Lock()
CACHE_TTL = 600            # 10 minutes


def _cache_key(message: str, language: str) -> str:
    raw = f"{message.strip().lower()}|{language}"
    return hashlib.sha256(raw.encode()).hexdigest()


def cache_get(message: str, language: str) -> dict | None:
    key = _cache_key(message, language)
    with _cache_lock:
        entry = _cache.get(key)
        if entry and entry["expires"] > time.time():
            return entry["value"]
        if entry:
            del _cache[key]
    return None


def cache_set(message: str, language: str, value: dict) -> None:
    key = _cache_key(message, language)
    with _cache_lock:
        _cache[key] = {"value": value, "expires": time.time() + CACHE_TTL}


# ── ArogyaSaarthi system prompt ────────────────────────────────────────────
SYSTEM_PROMPT = """You are ArogyaSaarthi AI, a responsible AI health triage assistant designed for India.
Your purpose is to guide users safely to the appropriate level of care based on symptoms.

ABSOLUTE RULES — never violate these:
- Do NOT diagnose any disease
- Do NOT prescribe or name any medication or dosage
- Do NOT replace a doctor
- Do NOT invent symptoms or conditions not mentioned by the user
- Do NOT output specific facility names, addresses, or phone numbers
- If uncertain, be conservative (prefer moderate over low urgency)
- Always include a disclaimer

EMERGENCY DETECTION — if message contains any of these, urgency MUST be "emergency":
chest pain, severe breathlessness, unconscious, not responding, seizure, convulsion,
heavy bleeding, stroke, blue lips, suicidal, self-harm, infant high fever lethargic,
severe allergic reaction, snake bite, poisoning

OUTPUT: Return ONLY valid JSON. No markdown. No explanation. No extra text.
"""

# ── JSON schema description for Gemini ────────────────────────────────────
TRIAGE_SCHEMA_DESC = """{
  "symptom_summary": "brief plain-language summary of user symptoms",
  "urgency_level": "low | moderate | urgent | emergency",
  "urgency_reason": "1-2 sentence explanation of urgency choice",
  "recommended_next_steps": ["step1", "step2", "step3"],
  "warning_signs": ["sign1", "sign2", "sign3"],
  "clarifying_question": "one question string if info insufficient, else null",
  "disclaimer": "This is not a medical diagnosis. If symptoms worsen or you feel unsafe, seek professional care."
}"""

ALLOWED_URGENCY = {"low", "moderate", "urgent", "emergency"}
MEDICINE_KEYWORDS = [
    "paracetamol", "ibuprofen", "aspirin", "antibiotic", "metformin",
    "insulin", "steroid", "tablet", "capsule", "dosage", "mg ", "ml ",
    "prescription", "prescribe", "medicine", "drug", "medication",
]


def _init():
    global _client, _model_name, _enabled
    api_key = os.getenv("LLM_API_KEY", "").strip()
    use_llm = os.getenv("USE_LLM", "true").lower() == "true"
    provider = os.getenv("LLM_PROVIDER", "gemini").lower()
    _model_name = os.getenv("MODEL_NAME", "gemini-1.5-flash")

    if not use_llm:
        logger.info("[Gemini] USE_LLM=false — disabled.")
        _enabled = False
        return
    if provider != "gemini":
        logger.info(f"[Gemini] Provider '{provider}' — skipping Gemini init.")
        _enabled = False
        return
    if not api_key:
        logger.warning("[Gemini] LLM_API_KEY empty — falling back to local.")
        _enabled = False
        return
    try:
        from google import genai
        _client = genai.Client(api_key=api_key)
        _enabled = True
        logger.info(f"[Gemini] Initialized model={_model_name}")
    except ImportError:
        logger.warning("[Gemini] google-genai not installed.")
        _enabled = False
    except Exception as e:
        logger.warning(f"[Gemini] Init failed: {type(e).__name__}")
        _enabled = False


_init()


def is_enabled() -> bool:
    return _enabled and _client is not None


def _is_quota_error(e: Exception) -> bool:
    msg = str(e).lower()
    return "429" in msg or "quota" in msg or "resource_exhausted" in msg


def call_gemini(prompt: str, timeout: int = 20) -> str | None:
    """Call Gemini with a plain prompt. Returns text or None."""
    if not is_enabled():
        return None
    try:
        import concurrent.futures
        full_prompt = f"{SYSTEM_PROMPT}\n\n{prompt}"

        def _call():
            response = _client.models.generate_content(
                model=_model_name,
                contents=full_prompt,
            )
            return response.text

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
            text = ex.submit(_call).result(timeout=timeout)
        return text.strip() if text else None
    except Exception as e:
        if _is_quota_error(e):
            logger.warning("[Gemini] 429 quota exceeded")
        else:
            logger.warning(f"[Gemini] call_gemini failed: {type(e).__name__}: {str(e)[:120]}")
        return None


def call_gemini_json(prompt: str, timeout: int = 20) -> dict | None:
    """Call Gemini expecting JSON. Strips markdown fences. Returns dict or None."""
    raw = call_gemini(prompt, timeout=timeout)
    if raw is None:
        return None
    return _parse_json(raw)


def _parse_json(raw: str) -> dict | None:
    try:
        text = raw.strip()
        if text.startswith("```"):
            lines = [l for l in text.split("\n") if not l.strip().startswith("```")]
            text = "\n".join(lines).strip()
        # Find first { to last }
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            text = text[start:end]
        return json.loads(text)
    except (json.JSONDecodeError, ValueError) as e:
        logger.warning(f"[Gemini] JSON parse failed: {e} — raw[:200]: {raw[:200]}")
        return None


# ── Triage-specific Gemini call with validation + retry ───────────────────

TRIAGE_PROMPT_TEMPLATE = """Patient message (language: {language}):
\"{text}\"

Return ONLY valid JSON matching this exact schema — no markdown, no extra text:
{schema}

Rules:
- urgency_level must be exactly one of: low, moderate, urgent, emergency
- recommended_next_steps: 2-5 items, NO medicine names
- warning_signs: 3-5 items
- clarifying_question: one question string if symptoms are vague, else null
- disclaimer: always include "This is not a medical diagnosis. If symptoms worsen or you feel unsafe, seek professional care."
"""

REPAIR_PROMPT_TEMPLATE = """Your previous response was not valid JSON or had schema errors.
Return ONLY valid JSON strictly following this schema — no markdown, no explanation:
{schema}

Original patient message: \"{text}\"
"""


def call_triage(text: str, language: str = "en", request_id: str = "") -> tuple[dict | None, bool, str | None]:
    """
    Call Gemini for triage. Returns (result_dict, from_cache, error_code).
    Validates schema. Retries once with repair prompt if invalid.
    Returns (None, False, error_code) on total failure.
    """
    # Cache check
    cached = cache_get(text, language)
    if cached:
        logger.info(f"[Gemini][{request_id}] Cache hit")
        return cached, True, None

    if not is_enabled():
        return None, False, "gemini_disabled"

    prompt = TRIAGE_PROMPT_TEMPLATE.format(
        text=text,
        language=language,
        schema=TRIAGE_SCHEMA_DESC,
    )

    # Attempt 1
    raw = call_gemini(prompt, timeout=25)
    if raw is None:
        return None, False, "gemini_failed"

    data = _parse_json(raw)
    valid, issues = _validate_triage_schema(data)

    if valid:
        cache_set(text, language, data)
        return data, False, None

    logger.warning(f"[Gemini][{request_id}] Validation failed: {issues} — retrying with repair prompt")

    # Attempt 2 — repair
    repair_prompt = REPAIR_PROMPT_TEMPLATE.format(
        schema=TRIAGE_SCHEMA_DESC,
        text=text,
    )
    raw2 = call_gemini(repair_prompt, timeout=25)
    if raw2 is None:
        return None, False, "gemini_repair_failed"

    data2 = _parse_json(raw2)
    valid2, issues2 = _validate_triage_schema(data2)

    if valid2:
        cache_set(text, language, data2)
        return data2, False, None

    logger.warning(f"[Gemini][{request_id}] Repair also invalid: {issues2}")
    return None, False, "validation_failed"


def _validate_triage_schema(data: dict | None) -> tuple[bool, list[str]]:
    """Validate triage response schema. Returns (is_valid, list_of_issues)."""
    if not isinstance(data, dict):
        return False, ["not a dict"]

    issues = []
    required = ["symptom_summary", "urgency_level", "urgency_reason",
                "recommended_next_steps", "warning_signs", "disclaimer"]
    for key in required:
        if key not in data:
            issues.append(f"missing key: {key}")

    if issues:
        return False, issues

    ul = str(data.get("urgency_level", "")).lower().strip()
    if ul not in ALLOWED_URGENCY:
        issues.append(f"invalid urgency_level: {ul}")

    steps = data.get("recommended_next_steps", [])
    if not isinstance(steps, list) or not (2 <= len(steps) <= 6):
        issues.append(f"recommended_next_steps must be list of 2-6 items, got {len(steps) if isinstance(steps, list) else type(steps)}")

    warns = data.get("warning_signs", [])
    if not isinstance(warns, list) or not (2 <= len(warns) <= 6):
        issues.append(f"warning_signs must be list of 2-6 items")

    # Medicine keyword filter
    all_text = " ".join([
        str(data.get("symptom_summary", "")),
        str(data.get("urgency_reason", "")),
        " ".join(steps if isinstance(steps, list) else []),
    ]).lower()
    for kw in MEDICINE_KEYWORDS:
        if kw in all_text:
            issues.append(f"medicine keyword detected: {kw}")
            break

    return len(issues) == 0, issues

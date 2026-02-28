"""ArogyaSaarthi AI Engine — FastAPI service."""

import os
import time
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
logger = logging.getLogger(__name__)

from nlp_extractor import extract_symptoms
from triage_rules import classify
from explainer import generate_explanation, get_clarifying_question
from safety import check_safety
from intent_gate import (
    classify_intent, classify_intent_with_gemini,
    get_small_talk_reply, get_clarification_reply,
)
from triage_engine import run_triage

app = FastAPI(title="ArogyaSaarthi AI Engine", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

USE_LLM = os.getenv("USE_LLM", "true").lower() == "true"
from gemini_client import is_enabled as gemini_enabled


class ExtractRequest(BaseModel):
    text: str
    language: str = "en"
    source: str = "text"

class ClassifyRequest(BaseModel):
    structured: dict
    language: str = "en"

class ExplainRequest(BaseModel):
    urgency: str
    careLevel: str
    structured: dict
    reasonCodes: list = []
    language: str = "en"

class ClarifyRequest(BaseModel):
    questionType: str
    language: str = "en"

class IntentRequest(BaseModel):
    text: str
    language: str = "en"


class TriageRequest(BaseModel):
    text: str
    language: str = "en"


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "ai_engine",
        "llm_enabled": USE_LLM,
        "gemini_ready": gemini_enabled(),
        "model": os.getenv("MODEL_NAME", "gemini-2.5-flash"),
    }


@app.post("/triage")
def triage_endpoint(req: TriageRequest):
    """
    Unified triage endpoint.
    Returns structured JSON: symptom_summary, urgency_level, urgency_reason,
    recommended_next_steps, warning_signs, clarifying_question, disclaimer.
    Always returns a safe response — never crashes, never hallucinates facilities.
    """
    result = run_triage(req.text.strip(), req.language)
    # Strip internal meta from response, expose only request_id
    meta = result.pop("_meta", {})
    result["request_id"] = meta.get("request_id", "")
    result["fallback_used"] = meta.get("fallback_used", False)
    result["from_cache"] = meta.get("from_cache", False)
    return result


@app.post("/intent")
def intent_endpoint(req: IntentRequest):
    """
    Gemini-primary intent gate.
    For SYMPTOMS: returns full extracted data so Node can skip /extract.
    For SMALL_TALK/CLARIFICATION_REQUIRED: returns Gemini-generated reply.
    """
    start = time.time()
    llm_used = False
    fallback_used = False

    # ── Primary: Gemini combined intent + extraction ───────────────────
    gemini_result = classify_intent_with_gemini(req.text, req.language)

    if gemini_result is not None:
        llm_used = gemini_result.get("llmUsed", True)
        intent = gemini_result["intent"]
        reply = gemini_result.get("reply")

        if intent == "SMALL_TALK":
            return {
                "intent": "SMALL_TALK",
                "reply": reply or get_small_talk_reply(req.language),
                "extracted": None,
                "llmUsed": llm_used,
                "fallbackUsed": False,
                "latencyMs": round((time.time() - start) * 1000),
            }

        if intent == "CLARIFICATION_REQUIRED":
            return {
                "intent": "CLARIFICATION_REQUIRED",
                "reply": reply or get_clarification_reply(req.language),
                "extracted": None,
                "llmUsed": llm_used,
                "fallbackUsed": False,
                "latencyMs": round((time.time() - start) * 1000),
            }

        # SYMPTOMS — return extracted data so Node skips /extract
        extracted = {
            "primaryComplaint": gemini_result.get("primaryComplaint", "unknown"),
            "duration": gemini_result.get("duration", {"value": None, "unit": "unknown"}),
            "severity": gemini_result.get("severity", "unknown"),
            "associatedSymptoms": gemini_result.get("associatedSymptoms", []),
            "redFlagsDetected": gemini_result.get("redFlagsDetected", []),
            "extractionConfidence": gemini_result.get("confidence", 0.8),
            "clarifyingQuestion": "duration" if gemini_result.get("followUpQuestion") else None,
            "allDetectedSymptoms": (
                [gemini_result.get("primaryComplaint")] +
                gemini_result.get("associatedSymptoms", [])
            ) if gemini_result.get("primaryComplaint", "unknown") != "unknown" else gemini_result.get("associatedSymptoms", []),
        }

        # Safety gate: if extraction found nothing real, downgrade to CLARIFICATION
        primary = extracted["primaryComplaint"]
        red_flags = extracted["redFlagsDetected"]
        if primary == "unknown" and len(red_flags) == 0 and extracted["duration"]["value"] is None:
            return {
                "intent": "CLARIFICATION_REQUIRED",
                "reply": get_clarification_reply(req.language),
                "extracted": None,
                "llmUsed": llm_used,
                "fallbackUsed": True,
                "latencyMs": round((time.time() - start) * 1000),
            }

        return {
            "intent": "SYMPTOMS",
            "reply": None,
            "extracted": extracted,
            "llmUsed": llm_used,
            "fallbackUsed": False,
            "latencyMs": round((time.time() - start) * 1000),
        }

    # ── Fallback: local regex intent ───────────────────────────────────
    fallback_used = True
    intent = classify_intent(req.text, req.language)

    if intent == "SMALL_TALK":
        return {
            "intent": "SMALL_TALK",
            "reply": get_small_talk_reply(req.language),
            "extracted": None,
            "llmUsed": False,
            "fallbackUsed": True,
            "latencyMs": round((time.time() - start) * 1000),
        }

    if intent == "CLARIFICATION_REQUIRED":
        return {
            "intent": "CLARIFICATION_REQUIRED",
            "reply": get_clarification_reply(req.language),
            "extracted": None,
            "llmUsed": False,
            "fallbackUsed": True,
            "latencyMs": round((time.time() - start) * 1000),
        }

    # SYMPTOMS via regex — run local extraction
    extracted = extract_symptoms(req.text, req.language)
    extracted.pop("llmUsed", None)
    extracted.pop("fallbackUsed", None)

    primary = extracted.get("primaryComplaint", "unknown")
    red_flags = extracted.get("redFlagsDetected", [])
    if primary == "unknown" and len(red_flags) == 0 and extracted.get("duration", {}).get("value") is None:
        return {
            "intent": "CLARIFICATION_REQUIRED",
            "reply": get_clarification_reply(req.language),
            "extracted": None,
            "llmUsed": False,
            "fallbackUsed": True,
            "latencyMs": round((time.time() - start) * 1000),
        }

    return {
        "intent": "SYMPTOMS",
        "reply": None,
        "extracted": extracted,
        "llmUsed": False,
        "fallbackUsed": True,
        "latencyMs": round((time.time() - start) * 1000),
    }


@app.post("/extract")
def extract(req: ExtractRequest):
    start = time.time()
    result = extract_symptoms(req.text, req.language)
    latency = round((time.time() - start) * 1000)
    llm_used = result.pop("llmUsed", False)
    fallback_used = result.pop("fallbackUsed", True)
    return {
        **result,
        "meta": {"llmUsed": llm_used, "fallbackUsed": fallback_used, "latencyMs": latency},
    }


@app.post("/classify")
def classify_endpoint(req: ClassifyRequest):
    start = time.time()
    result = classify(req.structured)
    latency = round((time.time() - start) * 1000)
    return {**result, "meta": {"llmUsed": False, "latencyMs": latency}}


@app.post("/explain")
def explain(req: ExplainRequest):
    start = time.time()
    result = generate_explanation(
        urgency=req.urgency,
        care_level=req.careLevel,
        structured=req.structured,
        reason_codes=req.reasonCodes,
        language=req.language,
    )
    latency = round((time.time() - start) * 1000)
    llm_used = result.pop("llmUsed", False)
    fallback_used = result.pop("fallbackUsed", True)
    return {**result, "meta": {"llmUsed": llm_used, "fallbackUsed": fallback_used, "latencyMs": latency}}


@app.post("/clarify")
def clarify(req: ClarifyRequest):
    question = get_clarifying_question(req.questionType, req.language)
    return {"question": question}


@app.post("/safety-check")
def safety_check(req: ExtractRequest):
    return check_safety(req.text, req.language)


class ScopeRequest(BaseModel):
    text: str
    language: str = "en"


GENERAL_ANSWER_PROMPT = """You are ArogyaSaarthi, a friendly health navigation assistant for rural India.
The user is asking a general (non-medical) question. Answer briefly and helpfully in {language_name}.
STRICT RULES:
- Do NOT provide any medical advice, diagnosis, or medication suggestions.
- If the question touches on health/medicine, decline and say you can only help with symptoms.
- Keep the answer to 2-3 sentences max.
- Be warm and friendly.
- Do NOT mention drug names, dosages, or treatments.

User message: {text}
Answer in {language_name}:"""

LANGUAGE_NAMES = {
    "en": "English", "hi": "Hindi", "mr": "Marathi", "ta": "Tamil", "te": "Telugu"
}


@app.post("/general-answer")
def general_answer(req: ScopeRequest):
    """Safe Gemini answer for NON_MEDICAL_SAFE scope. Never provides medical advice."""
    start = time.time()
    try:
        from gemini_client import is_enabled as gemini_enabled, call_gemini
        if not gemini_enabled():
            return {"reply": None, "llmUsed": False}

        prompt = GENERAL_ANSWER_PROMPT.format(
            text=req.text,
            language_name=LANGUAGE_NAMES.get(req.language, "English"),
        )
        reply = call_gemini(prompt, timeout=15)
        if reply:
            # Safety check on reply
            safety = check_safety(reply, req.language)
            if not safety.get("safe", True):
                return {"reply": None, "llmUsed": True, "safetyBlocked": True}
            return {
                "reply": reply.strip(),
                "llmUsed": True,
                "latencyMs": round((time.time() - start) * 1000),
            }
    except Exception as e:
        logger.warning(f"[GeneralAnswer] Gemini failed: {e}")
    return {"reply": None, "llmUsed": False, "latencyMs": round((time.time() - start) * 1000)}
SCOPE_PROMPT = """You are a scope classifier for ArogyaSaarthi, a medical navigation assistant for rural India.
Classify the user message into exactly one scope. Return ONLY valid JSON — no markdown, no explanation.

Scopes:
- MEDICAL: symptoms, triage, red flags, clinic/hospital/PHC/CHC, booking, home care, emergency, health conditions
- NON_MEDICAL_SAFE: greetings, general small talk, basic factual non-medical questions (geography, math, weather, jokes)
- OUT_OF_SCOPE: requests for drug names, prescriptions, diagnosis, medication advice, or topics completely unrelated to health navigation (finance, politics, creative writing)

HARD RULES:
- Any mention of "which medicine", "what drug", "prescribe", "diagnose me", "tablet", "dosage" → OUT_OF_SCOPE
- Any symptom, body part complaint, clinic, hospital, PHC, booking → MEDICAL
- Greetings, thanks, general knowledge → NON_MEDICAL_SAFE

JSON schema:
{{"scope": "MEDICAL|NON_MEDICAL_SAFE|OUT_OF_SCOPE", "confidence": 0.0-1.0}}

Message: {text}
JSON only:"""


@app.post("/scope")
def scope_endpoint(req: ScopeRequest):
    """Classify message scope: MEDICAL | NON_MEDICAL_SAFE | OUT_OF_SCOPE."""
    start = time.time()

    # ── Gemini primary ─────────────────────────────────────────────────
    try:
        from gemini_client import is_enabled as gemini_enabled, call_gemini_json
        if gemini_enabled():
            prompt = SCOPE_PROMPT.format(text=req.text)
            data = call_gemini_json(prompt, timeout=15)
            if data and data.get("scope") in ("MEDICAL", "NON_MEDICAL_SAFE", "OUT_OF_SCOPE"):
                return {
                    "scope": data["scope"],
                    "confidence": float(data.get("confidence", 0.9)),
                    "llmUsed": True,
                    "latencyMs": round((time.time() - start) * 1000),
                }
    except Exception as e:
        logger.warning(f"[Scope] Gemini failed: {e}")

    # ── Local fallback ─────────────────────────────────────────────────
    scope = _local_classify_scope(req.text)
    return {
        "scope": scope,
        "confidence": 0.8,
        "llmUsed": False,
        "latencyMs": round((time.time() - start) * 1000),
    }


import re as _re

_MEDICAL_KW = _re.compile(
    r"\b(fever|cough|cold|headache|stomach|vomit|diarrhea|loose\s*motion|chest\s*pain|breath|"
    r"dizzy|faint|bleed|seizure|unconscious|body\s*ache|swelling|rash|snake\s*bite|"
    r"clinic|hospital|phc|chc|appointment|booking|emergency|home\s*care|triage|"
    r"bukhar|khansi|sardi|pet\s*dard|saans|behosh|daura|"
    r"बुखार|ताप|खांसी|सर्दी|सिरदर्द|पेट|उल्टी|दस्त|छाती|सांस|चक्कर|बेहोश|खून|दौरा|"
    r"ताप|खोकला|डोकेदुखी|पोटदुखी|उलटी|जुलाब|छातीत|श्वास|रक्त|झटके|बेशुद्ध|"
    r"காய்ச்சல்|இருமல்|தலைவலி|வயிற்று|வாந்தி|நெஞ்சு|மூச்சு|ரத்தம்|வலிப்பு|மயக்கம்|"
    r"జ్వరం|దగ్గు|తలనొప్పి|కడుపు|వాంతి|విరేచనాలు|ఛాతీ|ఊపిరి|రక్తం|మూర్ఛ|స్పృహ)\b",
    _re.IGNORECASE | _re.UNICODE,
)

_OUT_OF_SCOPE_KW = _re.compile(
    r"\b(medicine|drug|tablet|capsule|dosage|prescription|prescribe|diagnose|diagnosis|"
    r"paracetamol|ibuprofen|antibiotic|steroid|insulin|metformin|aspirin|"
    r"stock|share|price|invest|politics|poem|song|write|essay|recipe|cook)\b",
    _re.IGNORECASE,
)


def _local_classify_scope(text: str) -> str:
    if _OUT_OF_SCOPE_KW.search(text):
        return "OUT_OF_SCOPE"
    if _MEDICAL_KW.search(text):
        return "MEDICAL"
    return "NON_MEDICAL_SAFE"


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)

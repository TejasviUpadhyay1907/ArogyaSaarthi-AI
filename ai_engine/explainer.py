"""Explanation generator — Hybrid: Gemini primary, template fallback. No diagnosis/medicine."""

import json
import os
import logging
from safety import check_safety
from gemini_client import is_enabled as gemini_enabled, call_gemini

logger = logging.getLogger(__name__)

_i18n_dir = os.path.join(os.path.dirname(__file__), "i18n")
_labels_cache = {}


def _load_labels(lang: str) -> dict:
    if lang in _labels_cache:
        return _labels_cache[lang]
    path = os.path.join(_i18n_dir, f"labels_{lang}.json")
    if not os.path.exists(path):
        path = os.path.join(_i18n_dir, "labels_en.json")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    _labels_cache[lang] = data
    return data


SYMPTOM_DISPLAY = {
    "fever": {"en": "fever", "hi": "बुखार", "mr": "ताप", "ta": "காய்ச்சல்", "te": "జ్వరం"},
    "cough": {"en": "cough", "hi": "खांसी", "mr": "खोकला", "ta": "இருமல்", "te": "దగ్గు"},
    "cold": {"en": "cold", "hi": "सर्दी", "mr": "सर्दी", "ta": "சளி", "te": "జలుబు"},
    "headache": {"en": "headache", "hi": "सिरदर्द", "mr": "डोकेदुखी", "ta": "தலைவலி", "te": "తలనొప్పి"},
    "stomach_pain": {"en": "stomach pain", "hi": "पेट दर्द", "mr": "पोटदुखी", "ta": "வயிற்று வலி", "te": "కడుపు నొప్పి"},
    "chest_pain": {"en": "chest pain", "hi": "छाती में दर्द", "mr": "छातीत दुखणे", "ta": "நெஞ்சு வலி", "te": "ఛాతీ నొప్పి"},
    "breathlessness": {"en": "difficulty breathing", "hi": "सांस लेने में तकलीफ", "mr": "श्वास घेण्यास त्रास", "ta": "மூச்சு திணறல்", "te": "ఊపిరి ఆడటం కష్టం"},
    "vomiting": {"en": "vomiting", "hi": "उल्टी", "mr": "उलटी", "ta": "வாந்தி", "te": "వాంతి"},
    "diarrhea": {"en": "diarrhea", "hi": "दस्त", "mr": "जुलाब", "ta": "வயிற்றுப்போக்கு", "te": "విరేచనాలు"},
    "bleeding": {"en": "bleeding", "hi": "खून बहना", "mr": "रक्तस्राव", "ta": "ரத்தப்போக்கு", "te": "రక్తస్రావం"},
    "body_ache": {"en": "body ache", "hi": "शरीर दर्द", "mr": "अंगदुखी", "ta": "உடல் வலி", "te": "ఒళ్ళు నొప్పి"},
    "unconscious": {"en": "unconsciousness", "hi": "बेहोशी", "mr": "बेशुद्ध", "ta": "மயக்கம்", "te": "స్పృహ లేకపోవడం"},
    "seizure": {"en": "seizures", "hi": "दौरे", "mr": "झटके", "ta": "வலிப்பு", "te": "మూర్ఛ"},
    "unknown": {"en": "your symptoms", "hi": "आपके लक्षण", "mr": "तुमची लक्षणे", "ta": "உங்கள் அறிகுறிகள்", "te": "మీ లక్షణాలు"},
}


EXPLANATION_PROMPT = """You are a compassionate health assistant for a rural health triage system in India.
Write a short, friendly explanation for a patient based on the triage result below.

STRICT RULES:
- Do NOT diagnose any disease
- Do NOT suggest any medicines or treatments
- Do NOT contradict the urgency level given
- Keep it under 85 words
- Write in {language_name} language
- Be warm, simple, and reassuring

Triage result:
- Urgency: {urgency}
- Recommended care: {care_level}
- Act within: {time_to_act}
- Main reasons: {top_reasons}
- Watch for: {watch_for}

Write only the explanation text, nothing else."""

LANGUAGE_NAMES = {
    "en": "English", "hi": "Hindi", "mr": "Marathi", "ta": "Tamil", "te": "Telugu"
}

TIME_TO_ACT = {
    "HIGH": "NOW — immediately",
    "MEDIUM": "within 24 hours",
    "LOW": "monitor at home",
}


def generate_explanation(
    urgency: str,
    care_level: str,
    structured: dict,
    reason_codes: list,
    language: str = "en",
) -> dict:
    """Hybrid explanation: Gemini primary → template fallback."""
    labels = _load_labels(language)
    time_to_act = TIME_TO_ACT.get(urgency, "within 24 hours")

    # Build structured context for Gemini
    primary = structured.get("primaryComplaint", "unknown")
    symptom_name = SYMPTOM_DISPLAY.get(primary, {}).get(language, SYMPTOM_DISPLAY.get(primary, {}).get("en", primary))
    associated = structured.get("associatedSymptoms", [])
    top_reasons = [symptom_name] + [
        SYMPTOM_DISPLAY.get(s, {}).get(language, s) for s in associated[:1]
    ]
    watch_for_map = {
        "HIGH": ["difficulty breathing", "chest pain", "loss of consciousness"],
        "MEDIUM": ["breathing difficulty", "chest pain", "fainting"],
        "LOW": ["worsening symptoms", "fever above 3 days", "difficulty breathing"],
    }
    watch_for = watch_for_map.get(urgency, watch_for_map["MEDIUM"])

    llm_used = False
    fallback_used = False
    explanation = None

    # ── Primary: Gemini ────────────────────────────────────────────────
    if gemini_enabled():
        prompt = EXPLANATION_PROMPT.format(
            language_name=LANGUAGE_NAMES.get(language, "English"),
            urgency=urgency,
            care_level=care_level,
            time_to_act=time_to_act,
            top_reasons=", ".join(top_reasons[:2]),
            watch_for=", ".join(watch_for[:3]),
        )
        raw = call_gemini(prompt, timeout=20)
        if raw:
            safety_result = check_safety(raw, language)
            if safety_result["safe"]:
                explanation = raw.strip()
                llm_used = True
            else:
                logger.warning("[Explainer] Gemini output failed safety filter — using template.")
                fallback_used = True
        else:
            logger.warning("[Explainer] Gemini returned None — using template.")
            fallback_used = True
    else:
        fallback_used = True

    # ── Fallback: template ─────────────────────────────────────────────
    if explanation is None:
        template_key = f"{urgency}_{care_level}"
        if template_key not in labels.get("templates", {}):
            template_key = {"HIGH": "HIGH_EMERGENCY", "LOW": "LOW_HOME"}.get(urgency, "MEDIUM_PHC")
        explanation = labels["templates"].get(template_key, labels["templates"].get("DEFAULT", ""))

    actions = _build_actions(urgency, care_level, labels)
    badge = {
        "label": labels.get("urgency_labels", {}).get(urgency, urgency),
        "color": labels.get("badge_colors", {}).get(urgency, "YELLOW"),
    }
    care_label = labels.get("care_labels", {}).get(care_level, care_level)
    disclaimer = labels.get("disclaimer", "This is not a medical diagnosis. For emergencies, call 108.")

    return {
        "explanation": explanation,
        "disclaimer": disclaimer,
        "urgencyBadge": badge,
        "careLabel": care_label,
        "timeToAct": time_to_act,
        "topReasons": top_reasons[:2],
        "watchFor": watch_for[:3],
        "actions": actions,
        "llmUsed": llm_used,
        "fallbackUsed": fallback_used,
    }


def _build_actions(urgency: str, care_level: str, labels: dict) -> list:
    """Build action buttons based on urgency and care level."""
    action_labels = labels.get("actions", {})
    actions = []

    if urgency == "HIGH":
        actions.append({"type": "PRIMARY", "label": action_labels.get("CALL_108", "Call 108"), "action": "CALL_108"})
        actions.append({"type": "SECONDARY", "label": action_labels.get("VISIT_EMERGENCY", "Go to Emergency"), "action": "VISIT_EMERGENCY"})
    elif care_level == "DISTRICT_HOSPITAL":
        actions.append({"type": "PRIMARY", "label": action_labels.get("VISIT_HOSPITAL", "Visit Hospital"), "action": "VISIT_HOSPITAL"})
        actions.append({"type": "SECONDARY", "label": action_labels.get("BOOK_APPOINTMENT", "Book Appointment"), "action": "BOOK_APPOINTMENT"})
    elif care_level == "CHC":
        actions.append({"type": "PRIMARY", "label": action_labels.get("VISIT_CHC", "Visit CHC"), "action": "VISIT_CHC"})
        actions.append({"type": "SECONDARY", "label": action_labels.get("BOOK_APPOINTMENT", "Book Appointment"), "action": "BOOK_APPOINTMENT"})
    elif care_level == "PHC":
        actions.append({"type": "PRIMARY", "label": action_labels.get("VISIT_PHC", "Visit PHC"), "action": "VISIT_PHC"})
        actions.append({"type": "SECONDARY", "label": action_labels.get("BOOK_APPOINTMENT", "Book Appointment"), "action": "BOOK_APPOINTMENT"})
    else:
        actions.append({"type": "PRIMARY", "label": action_labels.get("HOME_CARE", "Home care"), "action": "HOME_CARE"})
        actions.append({"type": "SECONDARY", "label": action_labels.get("BOOK_APPOINTMENT", "Book Appointment"), "action": "BOOK_APPOINTMENT"})

    return actions


def get_clarifying_question(question_type: str, language: str = "en") -> str:
    """Get a clarifying question in the requested language."""
    labels = _load_labels(language)
    questions = labels.get("clarifying_questions", {})
    return questions.get(question_type, questions.get("associated", "Can you describe more about your symptoms?"))

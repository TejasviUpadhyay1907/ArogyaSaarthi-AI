"""Intent Gate — Gemini primary, local regex fallback.
Returns: SMALL_TALK | CLARIFICATION_REQUIRED | SYMPTOMS
For SYMPTOMS: also returns structured extraction data (combined intent+extract in one call).
"""

import re
import logging

logger = logging.getLogger(__name__)

GREETINGS = {
    "en": [
        r"^(hi|hello|hey|hii|helo|helo+|hai)[\s!.]*$",
        r"^(thanks|thank you|thank u|thx|ty)[\s!.]*$",
        r"^(ok|okay|k|fine|sure|alright|got it|noted)[\s!.]*$",
        r"^(good morning|good evening|good afternoon|good night)[\s!.]*$",
        r"^(bye|goodbye|see you|take care)[\s!.]*$",
        r"^(yes|no|nope|yep|yeah|nah)[\s!.]*$",
        r"^(how are you|how r u|what's up|wassup)[\s!.]*$",
        r"^(test|testing|1234|ping|check)[\s!.]*$",
    ],
    "hi": [r"नमस्ते", r"हेलो", r"हाय", r"धन्यवाद", r"ठीक है", r"ओके", r"हाँ", r"नहीं"],
    "mr": [r"नमस्कार", r"हॅलो", r"हाय", r"धन्यवाद", r"ठीक आहे", r"ओके", r"हो", r"नाही"],
    "ta": [r"வணக்கம்", r"ஹலோ", r"நன்றி", r"சரி", r"ஆமாம்", r"இல்லை"],
    "te": [r"నమస్తే", r"హలో", r"ధన్యవాదాలు", r"సరే", r"అవును", r"కాదు"],
}

VAGUE_HEALTH = [
    r"\bnot\s*(well|good|feeling\s*well)\b",
    r"\bfeel\s*(bad|sick|unwell|ill|terrible)\b",
    r"\bi\s*(am|m)\s*(sick|unwell|ill|not\s*ok)\b",
    r"\bhelp\b", r"\bproblem\b", r"\bissue\b",
    r"\bpain\b", r"\bhurt\b", r"\bunwell\b", r"\bsick\b", r"\bill\b",
    r"तबियत\s*(ठीक\s*नहीं|खराब)", r"बीमार\s*हूँ",
    r"बरं\s*नाही", r"आजारी\s*आहे",
    r"உடம்பு\s*சரியில்லை", r"நலமில்லை",
    r"బాగా\s*లేను", r"అనారోగ్యంగా",
]

SYMPTOM_SIGNALS = [
    r"\bfever\b", r"\btemperature\b", r"\bcough\b", r"\bcoughing\b",
    r"\bcold\b", r"\brunny\s*nose\b", r"\bheadache\b", r"\bhead\s*pain\b",
    r"\bstomach\s*pain\b", r"\babdominal\s*pain\b",
    r"\bvomit\b", r"\bnausea\b", r"\bthrow\s*up\b",
    r"\bdiarrhea\b", r"\bdiarrhoea\b", r"\bloose\s*motion\b",
    r"\bchest\s*pain\b", r"\bchest\s*tight\b",
    r"\bbreath\b", r"\bbreathing\b", r"\bbreathl",
    r"\bdizziness\b", r"\bdizzy\b", r"\bfaint\b",
    r"\bbleeding\b", r"\bblood\b",
    r"\bseizure\b", r"\bconvulsion\b",
    r"\bunconscious\b", r"\bpassed\s*out\b",
    r"\bbody\s*ache\b", r"\bswelling\b", r"\brash\b",
    r"\bsnake\s*bite\b", r"\bpoison\b", r"\bweakness\b",
    r"\bbukhar\b", r"\bkhansi\b", r"\bsardi\b",
    r"\bsir\s*dard\b", r"\bpet\s*dard\b",
    r"\bulti\b", r"\bdast\b", r"\bsaans\b", r"\bchakkar\b", r"\bbehosh\b",
    r"\bkhoon\b", r"\bdaura\b", r"\bbadan\s*dard\b",
    r"बुखार", r"ताप", r"खांसी", r"सर्दी", r"सिरदर्द", r"पेट\s*दर्द",
    r"उल्टी", r"दस्त", r"छाती\s*दर्द", r"सीने\s*दर्द",
    r"सांस", r"चक्कर", r"बेहोश", r"खून", r"दौरा", r"शरीर\s*दर्द",
    r"ज्वर", r"खोकला", r"डोकेदुखी", r"पोटदुखी", r"उलटी", r"जुलाब",
    r"छातीत\s*दुखणे", r"श्वास\s*त्रास", r"रक्तस्राव", r"झटके", r"बेशुद्ध",
    r"காய்ச்சல்", r"இருமல்", r"சளி", r"தலைவலி", r"வயிற்று\s*வலி",
    r"வாந்தி", r"வயிற்றுப்போக்கு", r"நெஞ்சு\s*வலி", r"மூச்சு",
    r"ரத்தப்போக்கு", r"வலிப்பு", r"மயக்கம்", r"உடல்\s*வலி",
    r"జ్వరం", r"దగ్గు", r"జలుబు", r"తలనొప్పి", r"కడుపు\s*నొప్పి",
    r"వాంతి", r"విరేచనాలు", r"ఛాతీ\s*నొప్పి", r"గుండె\s*నొప్పి",
    r"ఊపిరి", r"రక్తస్రావం", r"మూర్ఛ", r"స్పృహ", r"ఒళ్ళు\s*నొప్పి",
]

SMALL_TALK_REPLIES = {
    "en": "Hi 👋 Tell me your symptoms (e.g., fever for 2 days, cough, stomach pain).",
    "hi": "नमस्ते 👋 अपने लक्षण बताएं (जैसे: 2 दिन से बुखार, खांसी, पेट दर्द)।",
    "mr": "नमस्कार �� तुमची लक्षणे सांगा (उदा: 2 दिवसांपासून ताप, खोकला, पोटदुखी)।",
    "ta": "வணக்கம் 👋 உங்கள் அறிகுறிகளை சொல்லுங்கள் (எ.கா: 2 நாட்களாக காய்ச்சல், இருமல், வயிற்று வலி).",
    "te": "నమస్తే 👋 మీ లక్షణాలు చెప్పండి (ఉదా: 2 రోజులుగా జ్వరం, దగ్గు, కడుపు నొప్పి).",
}

CLARIFICATION_REPLIES = {
    "en": "What symptom is bothering you most — fever, cough, pain, loose motion, or breathing difficulty? Since when?",
    "hi": "आपको सबसे ज़्यादा कौन सा लक्षण है — बुखार, खांसी, दर्द, दस्त, या सांस की तकलीफ? कब से?",
    "mr": "तुम्हाला सर्वात जास्त कोणते लक्षण आहे — ताप, खोकला, दुखणे, जुलाब, किंवा श्वास त्रास? कधीपासून?",
    "ta": "உங்களுக்கு மிகவும் தொந்தரவு தரும் அறிகுறி என்ன — காய்ச்சல், இருமல், வலி, வயிற்றுப்போக்கு, அல்லது மூச்சு திணறல்? எப்போதிலிருந்து?",
    "te": "మీకు అత్యంత ఇబ్బంది కలిగిస్తున్న లక్షణం ఏమిటి — జ్వరం, దగ్గు, నొప్పి, విరేచనాలు, లేదా ఊపిరి ఇబ్బంది? ఎప్పటి నుండి?",
}

LANGUAGE_NAMES = {
    "en": "English", "hi": "Hindi", "mr": "Marathi", "ta": "Tamil", "te": "Telugu"
}

INTENT_PROMPT = """You are a health assistant for a rural triage system in India.
Analyze the patient message and return ONLY valid JSON — no markdown, no explanation.

STRICT RULES:
- Do NOT diagnose any disease
- Do NOT suggest medicines or treatments
- Do NOT assign urgency or care level
- Only classify intent and extract what the patient explicitly mentions

JSON schema:
{{
  "intent": "SMALL_TALK or SYMPTOMS or CLARIFICATION_REQUIRED",
  "reply": "friendly reply in {language_name} for SMALL_TALK or CLARIFICATION_REQUIRED, null for SYMPTOMS",
  "primaryComplaint": "main symptom or unknown",
  "duration": {{"value": number or null, "unit": "days or hours or weeks or unknown"}},
  "severity": "mild or moderate or severe or unknown",
  "associatedSymptoms": [],
  "redFlagsDetected": [],
  "confidence": 0.0 to 1.0,
  "followUpQuestion": "one clarifying question or null"
}}

Intent rules:
- SMALL_TALK: greetings, thanks, ok, bye, test, or NO health content
- CLARIFICATION_REQUIRED: vague health complaint with no specific symptom
- SYMPTOMS: contains at least one specific symptom (fever, cough, chest pain, etc.)

For SMALL_TALK reply: warm, ask to describe symptoms. Language: {language_name}
For CLARIFICATION_REQUIRED reply: ask ONE specific follow-up. Language: {language_name}
For SYMPTOMS: reply must be null

Patient language: {language}
Patient message: {text}

JSON only:"""


def _is_greeting(text: str, language: str) -> bool:
    t = text.strip().lower()
    for pattern in GREETINGS["en"]:
        if re.search(pattern, t, re.IGNORECASE):
            return True
    for lang, patterns in GREETINGS.items():
        if lang == "en":
            continue
        for pattern in patterns:
            try:
                if re.search(pattern, text, re.IGNORECASE | re.UNICODE):
                    return True
            except re.error:
                pass
    return False


def _has_symptom_signal(text: str) -> bool:
    for pattern in SYMPTOM_SIGNALS:
        try:
            if re.search(pattern, text, re.IGNORECASE | re.UNICODE):
                return True
        except re.error:
            pass
    return False


def _is_vague_health(text: str) -> bool:
    for pattern in VAGUE_HEALTH:
        try:
            if re.search(pattern, text, re.IGNORECASE | re.UNICODE):
                return True
        except re.error:
            pass
    return False


def classify_intent(text: str, language: str = "en") -> str:
    """Local regex intent classifier — fallback when Gemini is unavailable."""
    if not text or not text.strip():
        return "SMALL_TALK"
    if _is_greeting(text, language):
        return "SMALL_TALK"
    if _has_symptom_signal(text):
        return "SYMPTOMS"
    if _is_vague_health(text):
        return "CLARIFICATION_REQUIRED"
    words = text.strip().split()
    if len(words) <= 3:
        return "SMALL_TALK"
    return "CLARIFICATION_REQUIRED"


def classify_intent_with_gemini(text: str, language: str = "en") -> dict | None:
    """
    Gemini-powered combined intent detection + symptom extraction.
    Returns structured dict or None on failure.
    """
    try:
        from gemini_client import is_enabled as gemini_enabled, call_gemini_json
        if not gemini_enabled():
            return None

        prompt = INTENT_PROMPT.format(
            text=text,
            language=language,
            language_name=LANGUAGE_NAMES.get(language, "English"),
        )
        data = call_gemini_json(prompt, timeout=20)
        if data is None:
            return None

        if "intent" not in data:
            logger.warning("[IntentGate] Gemini response missing 'intent' key")
            return None

        intent = data.get("intent", "CLARIFICATION_REQUIRED")
        if intent not in ("SMALL_TALK", "SYMPTOMS", "CLARIFICATION_REQUIRED"):
            intent = "CLARIFICATION_REQUIRED"

        # Normalize duration
        dur = data.get("duration", {})
        if not isinstance(dur, dict):
            dur = {"value": None, "unit": "unknown"}
        if dur.get("unit") == "weeks" and dur.get("value"):
            dur = {"value": dur["value"] * 7, "unit": "days"}
        elif dur.get("unit") == "hours" and dur.get("value"):
            dur = {"value": max(1, dur["value"] // 24), "unit": "days"}

        # Safety check on Gemini reply for non-SYMPTOMS
        reply = data.get("reply")
        if reply and intent != "SYMPTOMS":
            from safety import check_safety
            safety_result = check_safety(reply, language)
            if not safety_result["safe"]:
                logger.warning("[IntentGate] Gemini reply failed safety — using template")
                reply = (SMALL_TALK_REPLIES if intent == "SMALL_TALK" else CLARIFICATION_REPLIES).get(
                    language,
                    (SMALL_TALK_REPLIES if intent == "SMALL_TALK" else CLARIFICATION_REPLIES)["en"]
                )

        if intent == "SYMPTOMS":
            reply = None

        return {
            "intent": intent,
            "reply": reply,
            "primaryComplaint": data.get("primaryComplaint", "unknown") or "unknown",
            "duration": dur,
            "severity": data.get("severity", "unknown") or "unknown",
            "associatedSymptoms": data.get("associatedSymptoms", []) or [],
            "redFlagsDetected": data.get("redFlagsDetected", []) or [],
            "confidence": float(data.get("confidence", 0.8)),
            "followUpQuestion": data.get("followUpQuestion"),
            "llmUsed": True,
        }

    except Exception as e:
        logger.warning(f"[IntentGate] classify_intent_with_gemini failed: {type(e).__name__}: {str(e)[:120]}")
        return None


def get_small_talk_reply(language: str = "en") -> str:
    return SMALL_TALK_REPLIES.get(language, SMALL_TALK_REPLIES["en"])


def get_clarification_reply(language: str = "en") -> str:
    return CLARIFICATION_REPLIES.get(language, CLARIFICATION_REPLIES["en"])

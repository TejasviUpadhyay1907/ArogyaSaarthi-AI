"""NLP Symptom Extractor — Hybrid: Gemini primary, regex/dictionary fallback.
Gemini extracts structured JSON. If unavailable, local regex runs instead."""

import re
import os
import logging

logger = logging.getLogger(__name__)

from gemini_client import is_enabled as gemini_enabled, call_gemini_json

EXTRACTION_PROMPT = """You are a medical symptom extraction assistant for a rural health triage system in India.
Extract structured symptom information from the patient's message below.

STRICT RULES:
- Do NOT diagnose any disease
- Do NOT suggest any medicines or treatments
- Do NOT classify urgency or severity beyond what the patient states
- Only extract what the patient explicitly mentions
- Output ONLY valid JSON, no explanation, no markdown

Required JSON schema:
{{
  "primaryComplaint": "string or unknown",
  "duration": {{"value": number or null, "unit": "days or hours or weeks or unknown"}},
  "severity": "mild or moderate or severe or unknown",
  "associatedSymptoms": ["list of symptoms mentioned"],
  "redFlagsDetected": ["list of red-flag symptoms like chest pain, breathlessness, unconscious, seizure, severe bleeding"],
  "languageDetected": "en or hi or mr or ta or te",
  "confidence": 0.0 to 1.0,
  "needsFollowUp": true or false,
  "followUpQuestion": "string or null"
}}

Patient language hint: {language}
Patient message: {text}

Respond with JSON only."""

# ── Symptom dictionaries per language ──────────────────────────────────────

SYMPTOM_KEYWORDS = {
    "fever": {
        "en": [r"\bfever\b", r"\btemperature\b", r"\bhot body\b"],
        "hi": [r"\bबुखार\b", r"\bबुख़ार\b", r"\bतापमान\b", r"\bतेज़?\s*बुखार\b", r"\bbukhar\b"],
        "mr": [r"\bताप\b", r"\bज्वर\b", r"\btaap\b"],
        "ta": [r"\bகாய்ச்சல்\b", r"\bஜுரம்\b"],
        "te": [r"\bజ్వరం\b", r"\bజొరం\b"],
    },
    "cough": {
        "en": [r"\bcough\b", r"\bcoughing\b"],
        "hi": [r"\bखांसी\b", r"\bखाँसी\b", r"\bkhansi\b"],
        "mr": [r"\bखोकला\b", r"\bkhokla\b"],
        "ta": [r"\bஇருமல்\b"],
        "te": [r"\bదగ్గు\b"],
    },
    "cold": {
        "en": [r"\bcold\b", r"\brunny nose\b", r"\bsneezing\b"],
        "hi": [r"\bसर्दी\b", r"\bजुकाम\b", r"\bनाक बह\b", r"\bsardi\b"],
        "mr": [r"\bसर्दी\b", r"\bनाक वाहणे\b"],
        "ta": [r"\bசளி\b", r"\bஜலதோஷம்\b"],
        "te": [r"\bజలుబు\b", r"\bచలి\b"],
    },
    "headache": {
        "en": [r"\bheadache\b", r"\bhead\s*pain\b", r"\bhead\s*ache\b"],
        "hi": [r"\bसिरदर्द\b", r"\bसिर\s*दर्द\b", r"\bसर\s*दर्द\b", r"\bsir\s*dard\b"],
        "mr": [r"\bडोकेदुखी\b", r"\bडोके\s*दुखी\b"],
        "ta": [r"\bதலைவலி\b"],
        "te": [r"\bతలనొప్పి\b"],
    },
    "stomach_pain": {
        "en": [r"\bstomach\s*pain\b", r"\babdominal\s*pain\b", r"\bbelly\s*pain\b", r"\btummy\b"],
        "hi": [r"\bपेट\s*दर्द\b", r"\bपेट\s*में\s*दर्द\b", r"\bpet\s*dard\b"],
        "mr": [r"\bपोटदुखी\b", r"\bपोट\s*दुखी\b"],
        "ta": [r"\bவயிற்று\s*வலி\b", r"\bவயிறு\s*வலி\b"],
        "te": [r"\bకడుపు\s*నొప్పి\b"],
    },
    "chest_pain": {
        "en": [r"\bchest\s*pain\b", r"\bchest\s*tight\b", r"\bheart\s*pain\b"],
        "hi": [r"\bछाती\s*(?:में\s*)?दर्द\b", r"\bसीने\s*(?:में\s*)?दर्द\b", r"\bchati\s*dard\b", r"\bseene\s*(?:mein\s*)?dard\b"],
        "mr": [r"\bछातीत\s*दुखणे\b", r"\bछाती\s*दुखते\b"],
        "ta": [r"\bநெஞ்சு\s*வலி\b"],
        "te": [r"\bఛాతీ\s*నొప్పి\b", r"\bగుండె\s*నొప్పి\b"],
    },
    "breathlessness": {
        "en": [r"\bbreathl?essness\b", r"\bdifficulty\s*breathing\b", r"\bshortness\s*of\s*breath\b",
               r"\bbreathing\s*(?:difficulty|problem|trouble)\b", r"\bcan'?t\s*breathe\b"],
        "hi": [r"\bसांस\s*(?:लेने\s*में\s*)?(?:तकलीफ|दिक्कत|परेशानी)\b", r"\bसांस\s*फूल\b",
               r"\bsaans\b.*\b(?:taklif|takleef|dikkat)\b"],
        "mr": [r"\bश्वास\s*(?:घेण्यास\s*)?त्रास\b", r"\bदम\s*लागणे\b"],
        "ta": [r"\bமூச்சு\s*(?:திணறல்|விடுவதில்\s*சிரமம்)\b"],
        "te": [r"\bఊపిరి\s*(?:ఆడటం\s*)?కష్టం\b", r"\bశ్వాస\s*ఇబ్బంది\b"],
    },
    "vomiting": {
        "en": [r"\bvomit(?:ing|s)?\b", r"\bthrow(?:ing)?\s*up\b", r"\bnausea\b"],
        "hi": [r"\bउल्टी\b", r"\bजी\s*मिचला\b", r"\bulti\b"],
        "mr": [r"\bउलटी\b", r"\bमळमळ\b"],
        "ta": [r"\bவாந்தி\b"],
        "te": [r"\bవాంతి\b"],
    },
    "diarrhea": {
        "en": [r"\bdiarrh[eo]a\b", r"\bloose\s*(?:motion|stool)s?\b", r"\bwatery\s*stool\b"],
        "hi": [r"\bदस्त\b", r"\bपतले\s*दस्त\b", r"\bloose\s*motion\b"],
        "mr": [r"\bजुलाब\b", r"\bपातळ\s*शौच\b"],
        "ta": [r"\bவயிற்றுப்போக்கு\b"],
        "te": [r"\bవిరేచనాలు\b", r"\bలూజ్\s*మోషన్స్\b"],
    },
    "bleeding": {
        "en": [r"\bbleeding\b", r"\bblood\b"],
        "hi": [r"\bखून\b", r"\bरक्तस्राव\b", r"\bkhoon\b"],
        "mr": [r"\bरक्तस्राव\b", r"\bरक्त\b"],
        "ta": [r"\bரத்தப்போக்கு\b", r"\bரத்தம்\b"],
        "te": [r"\bరక్తస్రావం\b", r"\bరక్తం\b"],
    },
    "severe_bleeding": {
        "en": [r"\bsevere\s*bleeding\b", r"\bheavy\s*bleeding\b", r"\blot\s*of\s*blood\b"],
        "hi": [r"\bबहुत\s*(?:ज़्यादा\s*)?खून\b", r"\bतेज़?\s*खून\b"],
        "mr": [r"\bजास्त\s*रक्तस्राव\b"],
        "ta": [r"\bஅதிக\s*ரத்தப்போக்கு\b"],
        "te": [r"\bతీవ్ర\s*రక్తస్రావం\b"],
    },
    "unconscious": {
        "en": [r"\bunconscious\b", r"\bfainted\b", r"\bpassed\s*out\b", r"\bnot\s*responding\b"],
        "hi": [r"\bबेहोश\b", r"\bहोश\s*नहीं\b", r"\bbehosh\b"],
        "mr": [r"\bबेशुद्ध\b", r"\bशुद्ध\s*नाही\b"],
        "ta": [r"\bமயக்கம்\b", r"\bநினைவிழந்த\b"],
        "te": [r"\bస్పృహ\s*లేదు\b", r"\bమూర్ఛ\b"],
    },
    "seizure": {
        "en": [r"\bseizure\b", r"\bconvulsion\b", r"\bfit\b", r"\bepilepsy\b"],
        "hi": [r"\bदौरा\b", r"\bमिर्गी\b", r"\bdaura\b"],
        "mr": [r"\bझटके\b", r"\bमिरगी\b"],
        "ta": [r"\bவலிப்பு\b"],
        "te": [r"\bమూర్ఛ\s*రోగం\b", r"\bఫిట్స్\b"],
    },
    "body_ache": {
        "en": [r"\bbody\s*(?:ache|pain)\b", r"\bmuscle\s*pain\b"],
        "hi": [r"\bशरीर\s*(?:में\s*)?दर्द\b", r"\bबदन\s*दर्द\b"],
        "mr": [r"\bअंगदुखी\b", r"\bशरीर\s*दुखणे\b"],
        "ta": [r"\bஉடல்\s*வலி\b"],
        "te": [r"\bఒళ్ళు\s*నొప్పి\b"],
    },
    "stiff_neck": {
        "en": [r"\bstiff\s*neck\b", r"\bneck\s*stiff\b"],
        "hi": [r"\bगर्दन\s*(?:में\s*)?अकड़\b"],
        "mr": [r"\bमान\s*ताठ\b"],
        "ta": [r"\bகழுத்து\s*விறைப்பு\b"],
        "te": [r"\bమెడ\s*బిగుసుకుపోవడం\b"],
    },
    "snake_bite": {
        "en": [r"\bsnake\s*bite\b"],
        "hi": [r"\bसांप\s*(?:ने\s*)?काट\b", r"\bsaanp\b"],
        "mr": [r"\bसाप\s*चावला\b"],
        "ta": [r"\bபாம்பு\s*கடி\b"],
        "te": [r"\bపాము\s*కాటు\b"],
    },
    "poisoning": {
        "en": [r"\bpoison\b", r"\bpoisoning\b"],
        "hi": [r"\bज़हर\b", r"\bविषाक्त\b"],
        "mr": [r"\bविष\b", r"\bविषबाधा\b"],
        "ta": [r"\bவிஷம்\b"],
        "te": [r"\bవిషం\b"],
    },
    "pregnancy_danger": {
        "en": [r"\bpregnancy\b.*\b(?:bleeding|pain|danger)\b", r"\bpregnant\b.*\b(?:bleeding|pain)\b"],
        "hi": [r"\bगर्भ\b.*\b(?:खून|दर्द)\b", r"\bप्रेग्नेंट\b.*\b(?:खून|दर्द)\b"],
        "mr": [r"\bगर्भ\b.*\b(?:रक्त|दुखणे)\b"],
        "ta": [r"\bகர்ப்பம்\b.*\b(?:ரத்தம்|வலி)\b"],
        "te": [r"\bగర్భం\b.*\b(?:రక్తం|నొప్పి)\b"],
    },
    "severe_abdominal_pain": {
        "en": [r"\bsevere\s*(?:stomach|abdominal|belly)\s*pain\b"],
        "hi": [r"\bतेज़?\s*पेट\s*(?:में\s*)?दर्द\b", r"\bबहुत\s*पेट\s*दर्द\b"],
        "mr": [r"\bतीव्र\s*पोटदुखी\b"],
        "ta": [r"\bகடுமையான\s*வயிற்று\s*வலி\b"],
        "te": [r"\bతీవ్ర\s*కడుపు\s*నొప్పి\b"],
    },
}

# ── Duration patterns per language ─────────────────────────────────────────

DURATION_PATTERNS = {
    "en": [
        (r"(\d+)\s*(?:day|days)", "days"),
        (r"(\d+)\s*(?:week|weeks)", "weeks"),
        (r"(\d+)\s*(?:hour|hours|hrs?)", "hours"),
        (r"since\s*(?:this\s*)?morning", None),  # special: 0.5 days
        (r"since\s*(?:last\s*)?(?:night|evening|yesterday)", None),  # 1 day
        (r"today", None),  # 0.5 days
    ],
    "hi": [
        (r"(\d+)\s*(?:दिन|दिनों|din|dino)\s*(?:से)?", "days"),
        (r"(\d+)\s*(?:हफ्ते|हफ्ता|hafte)", "weeks"),
        (r"(\d+)\s*(?:घंटे|ghante)", "hours"),
        (r"सुबह\s*से|subah\s*se", None),
        (r"कल\s*से|kal\s*se", None),
        (r"आज\s*(?:से)?|aaj", None),
    ],
    "mr": [
        (r"(\d+)\s*(?:दिवस|दिवसांपासून)", "days"),
        (r"(\d+)\s*(?:आठवडा|आठवडे)", "weeks"),
        (r"(\d+)\s*(?:तास)", "hours"),
        (r"सकाळपासून", None),
        (r"कालपासून", None),
        (r"आजपासून|आज", None),
    ],
    "ta": [
        (r"(\d+)\s*(?:நாள்|நாட்கள்|நாளாக|நாட்களாக|நாட்கள்\s*ஆக)", "days"),
        (r"(\d+)\s*(?:வாரம்|வாரங்கள்)", "weeks"),
        (r"(\d+)\s*(?:மணி\s*நேரம்)", "hours"),
        (r"காலையிலிருந்து", None),
        (r"நேற்றிலிருந்து", None),
        (r"இன்று", None),
    ],
    "te": [
        (r"(\d+)\s*(?:రోజు|రోజులు|రోజుల|రోజులుగా|రోజుల\s*నుండి)", "days"),
        (r"(\d+)\s*(?:వారం|వారాలు)", "weeks"),
        (r"(\d+)\s*(?:గంటలు|గంట)", "hours"),
        (r"ఉదయం\s*నుండి", None),
        (r"నిన్న\s*నుండి", None),
        (r"ఈరోజు", None),
    ],
}

# ── Severity keywords per language ─────────────────────────────────────────

SEVERITY_KEYWORDS = {
    "mild": {
        "en": [r"\bmild\b", r"\bslight\b", r"\blittle\b", r"\bminor\b"],
        "hi": [r"\bहल्का\b", r"\bथोड़ा\b", r"\bhalka\b", r"\bthoda\b"],
        "mr": [r"\bसौम्य\b", r"\bथोडा\b", r"\bहलका\b"],
        "ta": [r"\bலேசான\b", r"\bசிறிய\b"],
        "te": [r"\bతేలిక\b", r"\bకొంచెం\b"],
    },
    "moderate": {
        "en": [r"\bmoderate\b", r"\bmedium\b", r"\bquite\b"],
        "hi": [r"\bमध्यम\b", r"\bठीक-ठाक\b"],
        "mr": [r"\bमध्यम\b"],
        "ta": [r"\bநடுத்தர\b", r"\bமிதமான\b"],
        "te": [r"\bమధ్యస్థం\b"],
    },
    "severe": {
        "en": [r"\bsevere\b", r"\bvery\s*(?:bad|painful|high)\b", r"\bextreme\b",
               r"\bintense\b", r"\bterrible\b", r"\bworst\b", r"\bcan'?t\s*bear\b"],
        "hi": [r"\bतेज़?\b", r"\bबहुत\b", r"\bगंभीर\b", r"\bज़्यादा\b",
               r"\btez\b", r"\bbahut\b", r"\bzyada\b"],
        "mr": [r"\bतीव्र\b", r"\bखूप\b", r"\bगंभीर\b"],
        "ta": [r"\bகடுமையான\b", r"\bமிகவும்\b", r"\bதீவிர\b"],
        "te": [r"\bతీవ్ర\b", r"\bచాలా\b", r"\bఎక్కువ\b"],
    },
}

# ── Red flag keywords (language-agnostic, checked across all) ──────────────

RED_FLAG_SYMPTOMS = {
    "chest_pain", "breathlessness", "unconscious", "seizure",
    "severe_bleeding", "snake_bite", "poisoning", "pregnancy_danger",
    "severe_abdominal_pain", "stroke_signs", "stiff_neck",
}


def _match(pattern: str, text: str) -> bool:
    """Match pattern against text. For Indic scripts, \b doesn't work — use Unicode word boundary."""
    try:
        # Replace \b with Unicode-aware boundary for non-ASCII patterns
        if re.search(r'[^\x00-\x7F]', pattern):
            # Strip \b for Indic/Unicode patterns and do plain substring search
            clean = pattern.replace(r'\b', '').replace(r'\B', '')
            return bool(re.search(clean, text, re.IGNORECASE | re.UNICODE))
        return bool(re.search(pattern, text, re.IGNORECASE | re.UNICODE))
    except re.error:
        return False


def extract_symptoms(text: str, language: str = "en") -> dict:
    """
    Hybrid extraction: Gemini primary → regex fallback.
    Always returns llmUsed and fallbackUsed flags.
    """
    # ── Primary: Gemini ────────────────────────────────────────────────
    if gemini_enabled():
        result = _extract_with_gemini(text, language)
        if result is not None:
            return result
        logger.warning("[Extractor] Gemini failed — falling back to regex extraction.")

    # ── Fallback: local regex ──────────────────────────────────────────
    result = _extract_with_regex(text, language)
    result["llmUsed"] = False
    result["fallbackUsed"] = True
    return result


def _extract_with_gemini(text: str, language: str) -> dict | None:
    """Call Gemini for extraction. Returns normalized dict or None on failure."""
    prompt = EXTRACTION_PROMPT.format(text=text, language=language)
    data = call_gemini_json(prompt, timeout=20)
    if data is None:
        return None

    # Validate required keys
    required = ["primaryComplaint", "duration", "severity", "associatedSymptoms", "redFlagsDetected"]
    if not all(k in data for k in required):
        logger.warning(f"[Extractor] Gemini JSON missing required keys: {list(data.keys())}")
        return None

    # Normalize duration
    dur = data.get("duration", {})
    if not isinstance(dur, dict):
        dur = {"value": None, "unit": "unknown"}
    if dur.get("unit") == "weeks" and dur.get("value"):
        dur = {"value": dur["value"] * 7, "unit": "days"}
    elif dur.get("unit") == "hours" and dur.get("value"):
        dur = {"value": max(1, dur["value"] // 24), "unit": "days"}

    primary = data.get("primaryComplaint", "unknown") or "unknown"
    associated = data.get("associatedSymptoms", []) or []
    red_flags = data.get("redFlagsDetected", []) or []
    severity = data.get("severity", "unknown") or "unknown"
    confidence = float(data.get("confidence", 0.8))
    needs_followup = data.get("needsFollowUp", False)
    followup_q = data.get("followUpQuestion", None)

    # Map followUpQuestion to clarifyingQuestion type
    clarifying_question = None
    if needs_followup and followup_q:
        clarifying_question = "duration" if dur.get("value") is None else "severity"

    all_symptoms = [primary] + [s for s in associated if s != primary] if primary != "unknown" else associated

    return {
        "primaryComplaint": primary,
        "duration": dur,
        "severity": severity,
        "associatedSymptoms": associated,
        "redFlagsDetected": red_flags,
        "extractionConfidence": round(confidence, 2),
        "allDetectedSymptoms": all_symptoms,
        "clarifyingQuestion": clarifying_question,
        "llmUsed": True,
        "fallbackUsed": False,
    }


def _extract_with_regex(text: str, language: str = "en") -> dict:
    """Original regex/dictionary extraction — unchanged logic."""
    text_lower = text.lower().strip()
    langs_to_check = [language, "en"] if language != "en" else ["en"]

    detected_symptoms = []
    red_flags = []
    confidence_score = 0.0
    matches_count = 0

    for symptom_key, lang_patterns in SYMPTOM_KEYWORDS.items():
        for lang in langs_to_check:
            patterns = lang_patterns.get(lang, [])
            for pattern in patterns:
                if _match(pattern, text_lower):
                    if symptom_key not in detected_symptoms:
                        detected_symptoms.append(symptom_key)
                        matches_count += 1
                    if symptom_key in RED_FLAG_SYMPTOMS:
                        if symptom_key not in red_flags:
                            red_flags.append(symptom_key)
                    break

    duration = {"value": None, "unit": None}
    for lang in langs_to_check:
        patterns = DURATION_PATTERNS.get(lang, [])
        for pattern, unit in patterns:
            try:
                m = re.search(pattern, text_lower, re.IGNORECASE | re.UNICODE)
                if m:
                    if unit and m.groups():
                        val = int(m.group(1))
                        if unit == "weeks":
                            duration = {"value": val * 7, "unit": "days"}
                        elif unit == "hours":
                            duration = {"value": max(1, val // 24), "unit": "days"}
                        else:
                            duration = {"value": val, "unit": "days"}
                    else:
                        if any(kw in pattern for kw in ["morning", "सुबह", "subah", "सकाळ", "காலை", "ఉదయం", "today", "आज", "aaj", "இன்று", "ఈరోజు"]):
                            duration = {"value": 0, "unit": "days"}
                        else:
                            duration = {"value": 1, "unit": "days"}
                    matches_count += 1
                    break
            except re.error:
                continue
        if duration["value"] is not None:
            break

    severity = "unknown"
    for sev_level in ["severe", "moderate", "mild"]:
        found = False
        for lang in langs_to_check:
            patterns = SEVERITY_KEYWORDS.get(sev_level, {}).get(lang, [])
            for pattern in patterns:
                if _match(pattern, text_lower):
                    severity = sev_level
                    matches_count += 1
                    found = True
                    break
            if found:
                break
        if found:
            break

    if matches_count == 0:
        confidence_score = 0.2
    elif matches_count == 1:
        confidence_score = 0.5
    elif matches_count == 2:
        confidence_score = 0.7
    else:
        confidence_score = min(0.95, 0.6 + matches_count * 0.1)

    primary = detected_symptoms[0] if detected_symptoms else "unknown"
    associated = detected_symptoms[1:] if len(detected_symptoms) > 1 else []

    clarifying_question = None
    if detected_symptoms and duration["value"] is None:
        clarifying_question = "duration"
    elif detected_symptoms and severity == "unknown":
        clarifying_question = "severity"
    elif not detected_symptoms:
        clarifying_question = "associated"

    return {
        "primaryComplaint": primary,
        "duration": duration,
        "severity": severity,
        "associatedSymptoms": associated,
        "redFlagsDetected": red_flags,
        "extractionConfidence": round(confidence_score, 2),
        "allDetectedSymptoms": detected_symptoms,
        "clarifyingQuestion": clarifying_question,
    }

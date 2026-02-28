"""
ArogyaSaarthi Triage Engine
- Emergency keyword detection (rule-based, no LLM)
- Gemini structured triage with validation + retry
- Safe fallback JSON (no hardcoded facilities, no fake data)
- Structured observability logs
"""

import re
import uuid
import logging
import time

logger = logging.getLogger(__name__)

# ── Emergency keywords (rule-based, language-aware) ───────────────────────
_EMERGENCY_PATTERNS = re.compile(
    r"("
    r"chest\s*pain|severe\s*breath|can.?t\s*breath|difficulty\s*breath|"
    r"unconscious|not\s*responding|passed\s*out|fainted|"
    r"seizure|convulsion|"
    r"heavy\s*bleeding|severe\s*bleeding|lot\s*of\s*blood|"
    r"stroke|slurred\s*speech|face\s*droop|"
    r"blue\s*lips|lips\s*blue|"
    r"suicidal|self.harm|want\s*to\s*die|"
    r"snake\s*bite|snakebite|"
    r"poisoning|swallowed\s*poison|"
    r"not\s*breathing|stopped\s*breathing|"
    r"छाती\s*दर्द|सांस\s*नहीं|बेहोश|दौरा|बहुत\s*खून|"
    r"छातीत\s*दुखणे|श्वास\s*नाही|बेशुद्ध|झटके|"
    r"நெஞ்சு\s*வலி|மூச்சு\s*இல்லை|மயக்கம்|வலிப்பு|"
    r"ఛాతీ\s*నొప్పి|ఊపిరి\s*ఆడటం\s*లేదు|స్పృహ\s*లేదు|మూర్ఛ"
    r")",
    re.IGNORECASE | re.UNICODE,
)


def is_emergency_by_keywords(text: str) -> bool:
    """Fast rule-based emergency detection. No LLM needed."""
    return bool(_EMERGENCY_PATTERNS.search(text))


# ── Fallback responses ─────────────────────────────────────────────────────

def _emergency_fallback(language: str = "en") -> dict:
    msgs = {
        "en": {
            "summary": "You have described symptoms that may be a medical emergency.",
            "reason": "Your symptoms include signs that require immediate emergency care.",
            "steps": [
                "Call 108 (emergency ambulance) immediately.",
                "Do not leave the person alone.",
                "Keep them calm and still until help arrives.",
            ],
            "warnings": [
                "Loss of consciousness",
                "Stopped breathing or severe difficulty breathing",
                "Uncontrolled bleeding",
                "Seizures or convulsions",
                "Blue lips or fingertips",
            ],
        },
        "hi": {
            "summary": "आपने जो लक्षण बताए हैं वे एक चिकित्सा आपातकाल हो सकते हैं।",
            "reason": "आपके लक्षणों में ऐसे संकेत हैं जिनके लिए तुरंत आपातकालीन देखभाल की आवश्यकता है।",
            "steps": [
                "तुरंत 108 (आपातकालीन एम्बुलेंस) पर कॉल करें।",
                "व्यक्ति को अकेला न छोड़ें।",
                "मदद आने तक उन्हें शांत और स्थिर रखें।",
            ],
            "warnings": [
                "होश खोना",
                "सांस रुकना या सांस लेने में गंभीर कठिनाई",
                "अनियंत्रित रक्तस्राव",
                "दौरे या ऐंठन",
                "नीले होंठ या उंगलियां",
            ],
        },
        "mr": {
            "summary": "तुम्ही सांगितलेली लक्षणे वैद्यकीय आणीबाणी असू शकतात।",
            "reason": "तुमच्या लक्षणांमध्ये असे संकेत आहेत ज्यांना तातडीने आपत्कालीन काळजी आवश्यक आहे।",
            "steps": [
                "ताबडतोब 108 (आपत्कालीन रुग्णवाहिका) वर कॉल करा।",
                "व्यक्तीला एकटे सोडू नका।",
                "मदत येईपर्यंत त्यांना शांत ठेवा।",
            ],
            "warnings": [
                "शुद्ध हरपणे",
                "श्वास थांबणे किंवा श्वास घेण्यास गंभीर त्रास",
                "अनियंत्रित रक्तस्राव",
                "झटके",
                "निळे ओठ किंवा बोटे",
            ],
        },
        "ta": {
            "summary": "நீங்கள் விவரித்த அறிகுறிகள் மருத்துவ அவசரநிலையாக இருக்கலாம்.",
            "reason": "உங்கள் அறிகுறிகளில் உடனடி அவசர சிகிச்சை தேவைப்படும் அறிகுறிகள் உள்ளன.",
            "steps": [
                "உடனே 108 (அவசர ஆம்புலன்ஸ்) அழைக்கவும்.",
                "நபரை தனியாக விடாதீர்கள்.",
                "உதவி வரும் வரை அவர்களை அமைதியாக வைத்திருங்கள்.",
            ],
            "warnings": [
                "நினைவிழத்தல்",
                "சுவாசம் நிற்பது அல்லது கடுமையான சுவாச சிரமம்",
                "கட்டுப்படுத்த முடியாத ரத்தப்போக்கு",
                "வலிப்பு",
                "நீல நிற உதடுகள் அல்லது விரல்கள்",
            ],
        },
        "te": {
            "summary": "మీరు వివరించిన లక్షణాలు వైద్య అత్యవసర పరిస్థితి కావచ్చు.",
            "reason": "మీ లక్షణాలలో తక్షణ అత్యవసర సంరక్షణ అవసరమయ్యే సంకేతాలు ఉన్నాయి.",
            "steps": [
                "వెంటనే 108 (అత్యవసర అంబులెన్స్) కి కాల్ చేయండి.",
                "వ్యక్తిని ఒంటరిగా వదలకండి.",
                "సహాయం వచ్చే వరకు వారిని శాంతంగా ఉంచండి.",
            ],
            "warnings": [
                "స్పృహ కోల్పోవడం",
                "శ్వాస ఆగిపోవడం లేదా తీవ్రమైన శ్వాస ఇబ్బంది",
                "నియంత్రించలేని రక్తస్రావం",
                "మూర్ఛ లేదా తిమ్మిర్లు",
                "నీలి పెదవులు లేదా వేళ్ళు",
            ],
        },
    }
    m = msgs.get(language, msgs["en"])
    return {
        "symptom_summary": m["summary"],
        "urgency_level": "emergency",
        "urgency_reason": m["reason"],
        "recommended_next_steps": m["steps"],
        "warning_signs": m["warnings"],
        "clarifying_question": None,
        "disclaimer": "This is not a medical diagnosis. If symptoms worsen or you feel unsafe, seek professional care.",
    }


def _safe_fallback(language: str = "en", ask_question: bool = True) -> dict:
    """Conservative moderate fallback — no facility names, no fake data."""
    msgs = {
        "en": {
            "summary": "You have described some health symptoms.",
            "reason": "Without complete information, we recommend a cautious approach and a visit to your nearest health facility.",
            "steps": [
                "Rest and avoid strenuous activity.",
                "Stay hydrated — drink clean water regularly.",
                "Monitor your symptoms closely over the next few hours.",
                "Visit your nearest Primary Health Centre (PHC) if symptoms persist or worsen.",
            ],
            "warnings": [
                "Difficulty breathing or chest pain",
                "High fever lasting more than 2 days",
                "Vomiting or diarrhea with signs of dehydration",
                "Loss of consciousness or confusion",
                "Symptoms rapidly getting worse",
            ],
            "question": "Can you describe your main symptom and how long you have had it?",
        },
        "hi": {
            "summary": "आपने कुछ स्वास्थ्य लक्षण बताए हैं।",
            "reason": "पूरी जानकारी के बिना, हम सावधानी बरतने और नजदीकी स्वास्थ्य केंद्र जाने की सलाह देते हैं।",
            "steps": [
                "आराम करें और भारी काम से बचें।",
                "पानी पीते रहें — नियमित रूप से साफ पानी पिएं।",
                "अगले कुछ घंटों में अपने लक्षणों पर ध्यान दें।",
                "यदि लक्षण बने रहें या बिगड़ें तो नजदीकी PHC जाएं।",
            ],
            "warnings": [
                "सांस लेने में कठिनाई या छाती में दर्द",
                "2 दिन से अधिक तेज बुखार",
                "उल्टी या दस्त के साथ पानी की कमी के लक्षण",
                "बेहोशी या भ्रम",
                "लक्षण तेजी से बिगड़ना",
            ],
            "question": "आपका मुख्य लक्षण क्या है और यह कब से है?",
        },
        "mr": {
            "summary": "तुम्ही काही आरोग्य लक्षणे सांगितली आहेत.",
            "reason": "पूर्ण माहितीशिवाय, आम्ही सावधगिरी बाळगण्याचा आणि जवळच्या आरोग्य केंद्राला भेट देण्याचा सल्ला देतो.",
            "steps": [
                "विश्रांती घ्या आणि जड काम टाळा.",
                "पाणी पित राहा — नियमितपणे स्वच्छ पाणी प्या.",
                "पुढील काही तासांत लक्षणांवर लक्ष ठेवा.",
                "लक्षणे कायम राहिल्यास किंवा बिघडल्यास जवळच्या PHC ला जा.",
            ],
            "warnings": [
                "श्वास घेण्यास त्रास किंवा छातीत दुखणे",
                "2 दिवसांपेक्षा जास्त तीव्र ताप",
                "उलटी किंवा जुलाब सोबत निर्जलीकरणाची लक्षणे",
                "बेशुद्धपणा किंवा गोंधळ",
                "लक्षणे वेगाने बिघडणे",
            ],
            "question": "तुमचे मुख्य लक्षण काय आहे आणि ते कधीपासून आहे?",
        },
        "ta": {
            "summary": "நீங்கள் சில உடல்நல அறிகுறிகளை விவரித்துள்ளீர்கள்.",
            "reason": "முழுமையான தகவல் இல்லாமல், நாங்கள் எச்சரிக்கையான அணுகுமுறையை பரிந்துரைக்கிறோம்.",
            "steps": [
                "ஓய்வு எடுங்கள் மற்றும் கடினமான செயல்களை தவிர்க்கவும்.",
                "தண்ணீர் குடிக்கவும் — தொடர்ந்து சுத்தமான தண்ணீர் குடிக்கவும்.",
                "அடுத்த சில மணி நேரங்களில் அறிகுறிகளை கவனிக்கவும்.",
                "அறிகுறிகள் தொடர்ந்தால் அல்லது மோசமாகினால் அருகிலுள்ள PHC க்கு செல்லவும்.",
            ],
            "warnings": [
                "சுவாசிக்க சிரமம் அல்லது நெஞ்சு வலி",
                "2 நாட்களுக்கும் மேல் அதிக காய்ச்சல்",
                "வாந்தி அல்லது வயிற்றுப்போக்கு மற்றும் நீர்ச்சத்து குறைவு",
                "நினைவிழத்தல் அல்லது குழப்பம்",
                "அறிகுறிகள் வேகமாக மோசமாவது",
            ],
            "question": "உங்கள் முக்கிய அறிகுறி என்ன, அது எப்போதிலிருந்து உள்ளது?",
        },
        "te": {
            "summary": "మీరు కొన్ని ఆరోగ్య లక్షణాలను వివరించారు.",
            "reason": "పూర్తి సమాచారం లేకుండా, మేము జాగ్రత్తగా వ్యవహరించమని మరియు సమీపంలోని ఆరోగ్య కేంద్రాన్ని సందర్శించమని సిఫార్సు చేస్తున్నాము.",
            "steps": [
                "విశ్రాంతి తీసుకోండి మరియు కష్టమైన పనులు చేయకండి.",
                "నీరు తాగుతూ ఉండండి — క్రమం తప్పకుండా శుభ్రమైన నీరు తాగండి.",
                "తదుపరి కొన్ని గంటలలో లక్షణాలను జాగ్రత్తగా గమనించండి.",
                "లక్షణాలు కొనసాగితే లేదా తీవ్రమైతే సమీపంలోని PHC కి వెళ్ళండి.",
            ],
            "warnings": [
                "శ్వాస తీసుకోవడంలో ఇబ్బంది లేదా ఛాతీ నొప్పి",
                "2 రోజులకు మించి అధిక జ్వరం",
                "వాంతి లేదా విరేచనాలు మరియు నిర్జలీకరణ సంకేతాలు",
                "స్పృహ కోల్పోవడం లేదా గందరగోళం",
                "లక్షణాలు వేగంగా తీవ్రమవడం",
            ],
            "question": "మీ ప్రధాన లక్షణం ఏమిటి మరియు అది ఎప్పటి నుండి ఉంది?",
        },
    }
    m = msgs.get(language, msgs["en"])
    return {
        "symptom_summary": m["summary"],
        "urgency_level": "moderate",
        "urgency_reason": m["reason"],
        "recommended_next_steps": m["steps"],
        "warning_signs": m["warnings"],
        "clarifying_question": m["question"] if ask_question else None,
        "disclaimer": "This is not a medical diagnosis. If symptoms worsen or you feel unsafe, seek professional care.",
    }


# ── Main triage function ───────────────────────────────────────────────────

def run_triage(text: str, language: str = "en") -> dict:
    """
    Full triage pipeline:
    1. Emergency keyword check (rule-based, instant)
    2. Gemini structured triage (with cache + validation + retry)
    3. Safe fallback if Gemini fails

    Returns triage result dict + observability metadata.
    """
    request_id = uuid.uuid4().hex[:10]
    start = time.time()

    obs = {
        "request_id": request_id,
        "endpoint": "triage",
        "gemini_status": "not_called",
        "fallback_used": False,
        "validation_passed": False,
        "from_cache": False,
        "emergency_keyword_hit": False,
    }

    # Step 1: Emergency keyword detection
    if is_emergency_by_keywords(text):
        obs["emergency_keyword_hit"] = True
        obs["fallback_used"] = True
        obs["gemini_status"] = "skipped_emergency"
        result = _emergency_fallback(language)
        result["_meta"] = {**obs, "latency_ms": round((time.time() - start) * 1000)}
        logger.info(f"[Triage][{request_id}] EMERGENCY keyword hit — returning emergency fallback")
        return result

    # Step 2: Gemini triage
    from gemini_client import call_triage, is_enabled
    if is_enabled():
        gemini_result, from_cache, error_code = call_triage(text, language, request_id)
        obs["from_cache"] = from_cache

        if gemini_result is not None:
            obs["gemini_status"] = "cache_hit" if from_cache else "success"
            obs["validation_passed"] = True
            # Normalize urgency_level to lowercase
            gemini_result["urgency_level"] = str(gemini_result.get("urgency_level", "moderate")).lower().strip()
            # Ensure disclaimer always present
            if not gemini_result.get("disclaimer"):
                gemini_result["disclaimer"] = "This is not a medical diagnosis. If symptoms worsen or you feel unsafe, seek professional care."
            gemini_result["_meta"] = {**obs, "latency_ms": round((time.time() - start) * 1000)}
            logger.info(f"[Triage][{request_id}] Gemini success — urgency={gemini_result['urgency_level']} cache={from_cache}")
            return gemini_result

        obs["gemini_status"] = f"failed:{error_code}"
        obs["fallback_used"] = True
        logger.warning(f"[Triage][{request_id}] Gemini failed ({error_code}) — using safe fallback")
    else:
        obs["gemini_status"] = "disabled"
        obs["fallback_used"] = True
        logger.info(f"[Triage][{request_id}] Gemini disabled — using safe fallback")

    # Step 3: Safe fallback
    result = _safe_fallback(language, ask_question=True)
    result["_meta"] = {**obs, "latency_ms": round((time.time() - start) * 1000)}
    return result

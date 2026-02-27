"""Safety filter — blocks diagnosis, prescription, and unsafe content."""

import re

BLOCKED_PATTERNS_EN = [
    r"\byou have\b", r"\byou are suffering from\b", r"\bdiagnos",
    r"\bpneumonia\b", r"\btuberculosis\b", r"\btyphoid\b", r"\bmalaria\b",
    r"\bdiabetes\b", r"\bcancer\b", r"\bdengue\b", r"\bcovid\b",
    r"\btake paracetamol\b", r"\btake medicine\b", r"\btake tablet\b",
    r"\btake antibiotic\b", r"\bprescri", r"\bmedication\b",
    r"\bdosage\b", r"\bmilligram\b", r"\bcapsule\b",
    r"\bthis is\s+\w+\s+disease\b", r"\bthis condition is\b",
]

BLOCKED_PATTERNS_HI = [
    r"आपको .+ है", r"बीमारी", r"रोग है", r"दवाई", r"गोली",
    r"पैरासिटामोल", r"एंटीबायोटिक", r"दवा लें", r"दवा खाएं",
    r"निदान", r"इलाज करें",
]

BLOCKED_PATTERNS_MR = [
    r"तुम्हाला .+ आहे", r"आजार", r"रोग आहे", r"औषध", r"गोळी",
    r"पॅरासिटामॉल", r"अँटिबायोटिक", r"औषध घ्या",
]

BLOCKED_PATTERNS_TA = [
    r"உங்களுக்கு .+ உள்ளது", r"நோய்", r"மருந்து", r"மாத்திரை",
    r"பாராசிட்டமால்", r"ஆண்டிபயாடிக்",
]

BLOCKED_PATTERNS_TE = [
    r"మీకు .+ ఉంది", r"వ్యాధి", r"మందు", r"టాబ్లెట్",
    r"పారాసిటమాల్", r"యాంటీబయాటిక్",
]

ALL_BLOCKED = (
    BLOCKED_PATTERNS_EN + BLOCKED_PATTERNS_HI +
    BLOCKED_PATTERNS_MR + BLOCKED_PATTERNS_TA + BLOCKED_PATTERNS_TE
)

SAFE_FALLBACK = {
    "en": "Based on your symptoms, we recommend consulting a healthcare professional. Please visit your nearest health facility for proper evaluation.",
    "hi": "आपके लक्षणों के आधार पर, हम स्वास्थ्य पेशेवर से परामर्श की सलाह देते हैं। कृपया उचित मूल्यांकन के लिए नजदीकी स्वास्थ्य केंद्र जाएं।",
    "mr": "तुमच्या लक्षणांच्या आधारे, आम्ही आरोग्य व्यावसायिकांचा सल्ला घेण्याची शिफारस करतो. कृपया योग्य मूल्यांकनासाठी जवळच्या आरोग्य केंद्रात जा.",
    "ta": "உங்கள் அறிகுறிகளின் அடிப்படையில், சுகாதார நிபுணரை அணுகுமாறு பரிந்துரைக்கிறோம். சரியான மதிப்பீட்டிற்கு அருகிலுள்ள சுகாதார நிலையத்திற்கு செல்லவும்.",
    "te": "మీ లక్షణాల ఆధారంగా, ఆరోగ్య నిపుణులను సంప్రదించమని మేము సిఫార్సు చేస్తున్నాము. సరైన మూల్యాంకనం కోసం సమీపంలోని ఆరోగ్య కేంద్రానికి వెళ్ళండి.",
}


def check_safety(text: str, language: str = "en") -> dict:
    """Check text for unsafe content. Returns {safe: bool, filtered_text: str}."""
    if not text:
        return {"safe": True, "filtered_text": text}

    for pattern in ALL_BLOCKED:
        try:
            if re.search(pattern, text, re.IGNORECASE):
                return {
                    "safe": False,
                    "filtered_text": SAFE_FALLBACK.get(language, SAFE_FALLBACK["en"]),
                    "blocked_reason": f"Matched blocked pattern",
                }
        except re.error:
            continue

    return {"safe": True, "filtered_text": text}

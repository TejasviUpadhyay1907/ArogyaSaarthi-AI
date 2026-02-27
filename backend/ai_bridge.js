/**
 * AI Bridge — Scope → Intent gate → Extract → Classify (rules) → Explain.
 * SMALL_TALK and CLARIFICATION_REQUIRED never reach triage.
 * NON_MEDICAL_SAFE → Gemini general answer (no medical advice).
 * OUT_OF_SCOPE → polite redirect, no Gemini.
 */

const AI_URL = process.env.AI_ENGINE_URL || 'http://localhost:8000';

const TIME_TO_ACT = { HIGH: 'NOW — call 108 immediately', MEDIUM: 'Within 24 hours', LOW: 'Monitor at home' };

// ── Multilingual small-talk / clarification replies (Node-side fallback) ──
const SMALL_TALK_REPLIES = {
  en: 'Hi 👋 Tell me your symptoms (e.g., fever for 2 days, cough, stomach pain).',
  hi: 'नमस्ते 👋 अपने लक्षण बताएं (जैसे: 2 दिन से बुखार, खांसी, पेट दर्द)।',
  mr: 'नमस्कार 👋 तुमची लक्षणे सांगा (उदा: 2 दिवसांपासून ताप, खोकला, पोटदुखी)।',
  ta: 'வணக்கம் 👋 உங்கள் அறிகுறிகளை சொல்லுங்கள் (எ.கா: 2 நாட்களாக காய்ச்சல், இருமல், வயிற்று வலி).',
  te: 'నమస్తే 👋 మీ లక్షణాలు చెప్పండి (ఉదా: 2 రోజులుగా జ్వరం, దగ్గు, కడుపు నొప్పి).',
};

const CLARIFICATION_REPLIES = {
  en: 'What symptom is bothering you most — fever, cough, pain, loose motion, or breathing difficulty? Since when?',
  hi: 'आपको सबसे ज़्यादा कौन सा लक्षण है — बुखार, खांसी, दर्द, दस्त, या सांस की तकलीफ? कब से?',
  mr: 'तुम्हाला सर्वात जास्त कोणते लक्षण आहे — ताप, खोकला, दुखणे, जुलाब, किंवा श्वास त्रास? कधीपासून?',
  ta: 'உங்களுக்கு மிகவும் தொந்தரவு தரும் அறிகுறி என்ன — காய்ச்சல், இருமல், வலி, வயிற்றுப்போக்கு, அல்லது மூச்சு திணறல்? எப்போதிலிருந்து?',
  te: 'మీకు అత్యంత ఇబ్బంది కలిగిస్తున్న లక్షణం ఏమిటి — జ్వరం, దగ్గు, నొప్పి, విరేచనాలు, లేదా ఊపిరి ఇబ్బంది? ఎప్పటి నుండి?',
};

// ── Scope classifier ─────────────────────────────────────────────────────
const MEDICAL_KW = [
  /fever|temperature|cough|cold|headache|stomach\s*pain|vomit|nausea|diarrhea|loose\s*motion/i,
  /chest\s*pain|chest\s*tight|breath|dizzy|faint|bleed|seizure|unconscious|body\s*ache|swelling|rash/i,
  /snake\s*bite|poison|weakness|fatigue|bukhar|khansi|sardi|sir\s*dard|pet\s*dard|ulti|dast|daura|behosh/i,
  /clinic|hospital|phc|chc|appointment|booking|emergency|home\s*care|triage|nearest\s*doctor/i,
  /बुखार|खांसी|सर्दी|सिरदर्द|पेट\s*दर्द|उल्टी|दस्त|छाती|सांस|चक्कर|बेहोश|खून|दौरा/u,
  /ताप|खोकला|डोकेदुखी|पोटदुखी|उलटी|जुलाब|छातीत|श्वास|रक्त|झटके|बेशुद्ध/u,
  /காய்ச்சல்|இருமல்|தலைவலி|வயிற்று|வாந்தி|நெஞ்சு|மூச்சு|ரத்தம்|வலிப்பு|மயக்கம்/u,
  /జ్వరం|దగ్గు|తలనొప్పి|కడుపు|వాంతి|విరేచనాలు|ఛాతీ|ఊపిరి|రక్తం|మూర్ఛ|స్పృహ/u,
];

const OUT_OF_SCOPE_KW = [
  /\b(which\s*medicine|what\s*(drug|tablet|capsule)|prescri(be|ption)|diagnose\s*me|diagnosis)\b/i,
  /\b(paracetamol|ibuprofen|antibiotic|steroid|insulin|metformin|aspirin|amoxicillin)\b/i,
  /\b(dosage|dose|mg\s*tablet|what\s*drug|drug\s*for|medicine\s*for|tablet\s*for)\b/i,
  /\b(stock\s*price|share\s*market|invest|politics|write\s*(me\s*a\s*)?(poem|song|essay)|recipe|cook)\b/i,
];

const OUT_OF_SCOPE_REPLIES = {
  en: "I'm ArogyaSaarthi — a medical navigation assistant. I can help with symptoms, urgency (LOW/MEDIUM/HIGH), and finding nearby PHC/CHC/hospitals. Tell me your symptoms or ask for the nearest clinic.",
  hi: "मैं ArogyaSaarthi हूँ — एक चिकित्सा नेविगेशन सहायक। मैं लक्षणों, आपातकाल स्तर (LOW/MEDIUM/HIGH), और नजदीकी PHC/CHC/अस्पताल खोजने में मदद कर सकता हूँ। अपने लक्षण बताएं।",
  mr: "मी ArogyaSaarthi आहे — एक वैद्यकीय नेव्हिगेशन सहाय्यक. मी लक्षणे, आणीबाणी पातळी (LOW/MEDIUM/HIGH), आणि जवळचे PHC/CHC/रुग्णालय शोधण्यात मदत करू शकतो. तुमची लक्षणे सांगा.",
  ta: "நான் ArogyaSaarthi — ஒரு மருத்துவ வழிகாட்டி உதவியாளர். அறிகுறிகள், அவசரநிலை (LOW/MEDIUM/HIGH), மற்றும் அருகிலுள்ள PHC/CHC/மருத்துவமனை கண்டுபிடிக்க உதவுவேன். உங்கள் அறிகுறிகளை சொல்லுங்கள்.",
  te: "నేను ArogyaSaarthi — ఒక వైద్య నావిగేషన్ సహాయకుడు. లక్షణాలు, అత్యవసర స్థాయి (LOW/MEDIUM/HIGH), మరియు సమీప PHC/CHC/ఆసుపత్రి కనుగొనడంలో సహాయం చేయగలను. మీ లక్షణాలు చెప్పండి.",
};

const NON_MEDICAL_REDIRECT = {
  en: '\n\n_If you have any symptoms, tell me what you\'re feeling (you can type or use the mic)._',
  hi: '\n\n_अगर आपको कोई लक्षण है, तो बताएं (टाइप करें या माइक का उपयोग करें)।_',
  mr: '\n\n_जर तुम्हाला काही लक्षणे असतील, तर सांगा (टाइप करा किंवा माइक वापरा)।_',
  ta: '\n\n_உங்களுக்கு ஏதாவது அறிகுறிகள் இருந்தால், சொல்லுங்கள் (தட்டச்சு செய்யுங்கள் அல்லது மைக் பயன்படுத்துங்கள்)._',
  te: '\n\n_మీకు ఏదైనా లక్షణాలు ఉంటే, చెప్పండి (టైప్ చేయండి లేదా మైక్ ఉపయోగించండి)._',
};

const NON_MEDICAL_SYSTEM_PROMPT = `You are ArogyaSaarthi, a friendly health navigation assistant for rural India.
The user is asking a general (non-medical) question. Answer it briefly and helpfully.
STRICT RULES:
- Do NOT provide any medical advice, diagnosis, or medication suggestions.
- If the question touches on health/medicine at all, decline and redirect to symptoms.
- Keep the answer short (2-3 sentences max).
- Be warm and friendly.
- Do NOT mention drug names, dosages, or treatments.`;

function localClassifyScope(text) {
  for (const p of OUT_OF_SCOPE_KW) {
    if (p.test(text)) return 'OUT_OF_SCOPE';
  }
  for (const p of MEDICAL_KW) {
    if (p.test(text)) return 'MEDICAL';
  }
  return 'NON_MEDICAL_SAFE';
}

async function classifyScope(text, language) {
  try {
    const res = await fetchJSON(`${AI_URL}/scope`, { text, language });
    if (res && ['MEDICAL', 'NON_MEDICAL_SAFE', 'OUT_OF_SCOPE'].includes(res.scope)) {
      return { scope: res.scope, llmUsed: res.llmUsed || false };
    }
  } catch {
    // Python down — use local
  }
  return { scope: localClassifyScope(text), llmUsed: false };
}

async function callGeminiGeneral(text, language) {
  // Call Python /scope-answer endpoint for safe general answers
  try {
    const res = await fetchJSON(`${AI_URL}/general-answer`, { text, language });
    if (res && res.reply) return res.reply;
  } catch {
    // fallback below
  }
  // Node-side fallback: simple canned response
  return null;
}

// ── Local intent gate (mirrors Python logic, used when Python is down) ────
const GREETING_PATTERNS = [
  /^(hi|hello|hey|hii|hai|helo+)[\s!.]*$/i,
  /^(thanks|thank you|thank u|thx|ty)[\s!.]*$/i,
  /^(ok|okay|k|fine|sure|alright|got it|noted)[\s!.]*$/i,
  /^(good morning|good evening|good afternoon|good night)[\s!.]*$/i,
  /^(bye|goodbye|see you|take care)[\s!.]*$/i,
  /^(yes|no|nope|yep|yeah|nah)[\s!.]*$/i,
  /^(test|testing|ping|check|1234)[\s!.]*$/i,
  /नमस्ते|हेलो|हाय|धन्यवाद|ठीक है|ओके/u,
  /नमस्कार|हॅलो|धन्यवाद|ठीक आहे/u,
  /வணக்கம்|ஹலோ|நன்றி|சரி/u,
  /నమస్తే|హలో|ధన్యవాదాలు|సరే/u,
];

const SYMPTOM_SIGNALS = [
  /fever|temperature|cough|cold|headache|stomach\s*pain|vomit|nausea|diarrhea|loose\s*motion/i,
  /chest\s*pain|chest\s*tight|breath|dizzy|faint|bleed|seizure|unconscious|body\s*ache|swelling|rash/i,
  /snake\s*bite|poison|weakness|fatigue|bukhar|khansi|sardi|sir\s*dard|pet\s*dard|ulti|dast|daura|behosh/i,
  /बुखार|खांसी|सर्दी|सिरदर्द|पेट\s*दर्द|उल्टी|दस्त|छाती|सांस|चक्कर|बेहोश|खून|दौरा/u,
  /ताप|खोकला|डोकेदुखी|पोटदुखी|उलटी|जुलाब|छातीत|श्वास|रक्त|झटके|बेशुद्ध/u,
  /காய்ச்சல்|இருமல்|தலைவலி|வயிற்று|வாந்தி|வயிற்றுப்போக்கு|நெஞ்சு|மூச்சு|ரத்தம்|வலிப்பு|மயக்கம்/u,
  /జ్వరం|దగ్గు|తలనొప్పి|కడుపు|వాంతి|విరేచనాలు|ఛాతీ|ఊపిరి|రక్తం|మూర్ఛ|స్పృహ/u,
];

const VAGUE_PATTERNS = [
  /not\s*(well|good|feeling\s*well)|feel\s*(bad|sick|unwell|ill)|i\s*(am|m)\s*(sick|unwell|ill)/i,
  /\b(help|problem|issue|pain|hurt|unwell|sick|ill)\b/i,
  /तबियत\s*(ठीक\s*नहीं|खराब)|बीमार\s*हूँ|अच्छा\s*नहीं/u,
  /बरं\s*नाही|आजारी/u,
  /உடம்பு\s*சரியில்லை|நலமில்லை/u,
  /బాగా\s*లేను|అనారోగ్యంగా/u,
];

function localClassifyIntent(text, language) {
  if (!text || !text.trim()) return 'SMALL_TALK';
  for (const p of GREETING_PATTERNS) {
    if (p.test(text)) return 'SMALL_TALK';
  }
  for (const p of SYMPTOM_SIGNALS) {
    if (p.test(text)) return 'SYMPTOMS';
  }
  for (const p of VAGUE_PATTERNS) {
    if (p.test(text)) return 'CLARIFICATION_REQUIRED';
  }
  const words = text.trim().split(/\s+/);
  if (words.length <= 3) return 'SMALL_TALK';
  return 'CLARIFICATION_REQUIRED';
}

// ── Response validator — called before returning any result ───────────────
const VALID_URGENCIES = new Set(['LOW', 'MEDIUM', 'HIGH']);
const VALID_INTENTS   = new Set(['SMALL_TALK', 'CLARIFICATION_REQUIRED', 'SYMPTOMS']);

function validateResponse(result, language = 'en') {
  // Ensure intent is always present and valid
  if (!result.intent || !VALID_INTENTS.has(result.intent)) {
    result.intent = 'CLARIFICATION_REQUIRED';
  }

  // For SYMPTOMS: ensure urgency is always valid
  if (result.intent === 'SYMPTOMS') {
    if (!result.urgency || !VALID_URGENCIES.has(result.urgency)) {
      console.warn(`[Validator] Invalid urgency '${result.urgency}' — defaulting to MEDIUM`);
      result.urgency = 'MEDIUM';
    }
    if (!result.careLevel) result.careLevel = 'PHC';

    // Ensure triageCard urgency matches
    if (result.triageCard) {
      if (!result.triageCard.urgency || !VALID_URGENCIES.has(result.triageCard.urgency)) {
        result.triageCard.urgency = result.urgency;
      }
    }
  }

  // Non-SYMPTOMS must never have a triageCard
  if (result.intent !== 'SYMPTOMS') {
    result.triageCard = null;
    result.urgency = undefined;
    result.careLevel = undefined;
  }

  return result;
}

async function callAIEngine(text, language, source) {
  // ── Step -1: Scope classifier ──────────────────────────────────────
  const { scope, llmUsed: scopeLlmUsed } = await classifyScope(text, language);

  // OUT_OF_SCOPE — no Gemini, just redirect
  if (scope === 'OUT_OF_SCOPE') {
    return {
      scope: 'OUT_OF_SCOPE',
      intent: 'SMALL_TALK',
      reply: OUT_OF_SCOPE_REPLIES[language] || OUT_OF_SCOPE_REPLIES.en,
      triageCard: null,
      facilities: [],
      booking: null,
      structured: null,
      disclaimer: null,
      meta: { llmUsed: false, fallbackUsed: false, latencyMs: 0 },
    };
  }

  // NON_MEDICAL_SAFE — Gemini general answer, then redirect nudge
  if (scope === 'NON_MEDICAL_SAFE') {
    const generalReply = await callGeminiGeneral(text, language);
    const redirect = NON_MEDICAL_REDIRECT[language] || NON_MEDICAL_REDIRECT.en;
    const reply = generalReply
      ? generalReply + redirect
      : (SMALL_TALK_REPLIES[language] || SMALL_TALK_REPLIES.en);
    return {
      scope: 'NON_MEDICAL_SAFE',
      intent: 'SMALL_TALK',
      reply,
      triageCard: null,
      facilities: [],
      booking: null,
      structured: null,
      disclaimer: null,
      meta: { llmUsed: !!generalReply, fallbackUsed: !generalReply, latencyMs: 0 },
    };
  }

  // ── MEDICAL — run full pipeline ────────────────────────────────────
  // ── Step 0: Intent gate (Gemini primary — returns extracted data for SYMPTOMS) ──
  let intentRes;
  let intentLlmUsed = false;
  let intentFallbackUsed = false;

  try {
    intentRes = await fetchJSON(`${AI_URL}/intent`, { text, language });
    intentLlmUsed = intentRes.llmUsed || false;
    intentFallbackUsed = intentRes.fallbackUsed || false;
  } catch {
    // Python down — use local intent gate
    const localIntent = localClassifyIntent(text, language);
    const localReply = localIntent === 'SMALL_TALK'
      ? (SMALL_TALK_REPLIES[language] || SMALL_TALK_REPLIES.en)
      : (CLARIFICATION_REPLIES[language] || CLARIFICATION_REPLIES.en);
    intentRes = { intent: localIntent, reply: localReply, extracted: null, llmUsed: false, fallbackUsed: true };
    intentFallbackUsed = true;
    console.log('[Gemini] failed → generic fallback used');
  }

  const { intent } = intentRes;

  // Short-circuit for non-symptom intents
  if (intent === 'SMALL_TALK' || intent === 'CLARIFICATION_REQUIRED') {
    return {
      scope: 'MEDICAL',
      intent,
      reply: intentRes.reply,
      triageCard: null,
      facilities: [],
      booking: null,
      structured: null,
      disclaimer: null,
      meta: { llmUsed: intentLlmUsed, fallbackUsed: intentFallbackUsed, latencyMs: 0 },
    };
  }

  // ── SYMPTOMS: use extracted data from /intent (skip separate /extract) ──
  // If Gemini already extracted, use it; otherwise fall back to /extract
  let extractRes = intentRes.extracted;
  if (!extractRes) {
    extractRes = await fetchJSON(`${AI_URL}/extract`, { text, language, source });
  }

  // ── Intent-based short-circuit: if extraction found nothing real ───
  const primary = extractRes.primaryComplaint;
  const redFlags = extractRes.redFlagsDetected || [];
  const durationVal = extractRes.duration?.value;
  if ((!primary || primary === 'unknown') && redFlags.length === 0 && !durationVal) {
    return validateResponse({
      scope: 'MEDICAL',
      intent: 'CLARIFICATION_REQUIRED',
      reply: CLARIFICATION_REPLIES[language] || CLARIFICATION_REPLIES.en,
      triageCard: null,
      facilities: [],
      booking: null,
      structured: null,
      disclaimer: null,
      meta: { llmUsed: intentLlmUsed, fallbackUsed: true, latencyMs: 0 },
    }, language);
  }

  // ── Step 2: Classify — always deterministic rules ──────────────────
  const classifyRes = await fetchJSON(`${AI_URL}/classify`, { structured: extractRes, language });

  // ── Step 3: Explain ────────────────────────────────────────────────
  const explainRes = await fetchJSON(`${AI_URL}/explain`, {
    urgency: classifyRes.urgency,
    careLevel: classifyRes.careLevel,
    structured: extractRes,
    reasonCodes: classifyRes.reasonCodes,
    language,
  });

  const llmUsed = !!(intentLlmUsed || explainRes.meta?.llmUsed);
  const fallbackUsed = !!(intentFallbackUsed || explainRes.meta?.fallbackUsed);

  const triageCard = buildTriageCard(
    classifyRes.urgency,
    classifyRes.careLevel,
    explainRes.timeToAct || TIME_TO_ACT[classifyRes.urgency],
    explainRes.topReasons || [],
    explainRes.watchFor || [],
    language,
  );

  return validateResponse({
    scope: 'MEDICAL',
    intent: 'SYMPTOMS',
    urgency: classifyRes.urgency,
    careLevel: classifyRes.careLevel,
    urgencyBadge: explainRes.urgencyBadge,
    reasonCodes: classifyRes.reasonCodes,
    structured: {
      primaryComplaint: extractRes.primaryComplaint,
      duration: extractRes.duration,
      severity: extractRes.severity,
      associatedSymptoms: extractRes.associatedSymptoms || [],
      redFlagsDetected: extractRes.redFlagsDetected || [],
      clarifyingQuestion: extractRes.clarifyingQuestion,
    },
    explanation: explainRes.explanation,
    disclaimer: explainRes.disclaimer,
    actions: explainRes.actions,
    recommended_facility: explainRes.careLabel,
    triageCard,
    meta: {
      llmUsed,
      fallbackUsed,
      extractionConfidence: extractRes.extractionConfidence,
    },
  }, language);
}

function buildTriageCard(urgency, careLevel, timeToAct, topReasons, watchFor, language) {
  const timeLabels = {
    HIGH: { en: 'NOW — call 108 immediately', hi: 'अभी — 108 पर कॉल करें', mr: 'आत्ता — 108 वर कॉल करा', ta: 'இப்போதே — 108 அழைக்கவும்', te: 'ఇప్పుడే — 108 కు కాల్ చేయండి' },
    MEDIUM: { en: 'Within 24 hours', hi: '24 घंटे के भीतर', mr: '24 तासांत', ta: '24 மணி நேரத்திற்குள்', te: '24 గంటల్లో' },
    LOW: { en: 'Monitor at home', hi: 'घर पर निगरानी करें', mr: 'घरी निरीक्षण करा', ta: 'வீட்டில் கண்காணிக்கவும்', te: 'ఇంట్లో పర్యవేక్షించండి' },
  };

  // Primary action based on urgency
  let primaryAction;
  if (urgency === 'HIGH') {
    primaryAction = { label: 'Call 108', action: 'CALL_108' };
  } else if (urgency === 'LOW') {
    primaryAction = { label: 'Home care tips', action: 'HOME_CARE' };
  } else {
    primaryAction = { label: 'Find nearest PHC', action: 'FIND_FACILITY' };
  }

  const secondaryAction = { label: 'Book Appointment', action: 'BOOK_APPOINTMENT' };

  return {
    urgency,
    careLevel,
    timeToAct: (timeLabels[urgency] || timeLabels.MEDIUM)[language] || timeLabels[urgency]?.en || timeToAct,
    why: topReasons.slice(0, 2),
    watchFor: watchFor.slice(0, 3),
    actions: [primaryAction, secondaryAction],
  };
}

async function fetchJSON(url, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s for Gemini calls
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`AI engine returned ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

// ── Local fallback (keyword-based, no Python needed) ──────────────────────

const RED_FLAG_KW = [
  { keywords: ['chest pain', 'chest tight', 'chati dard', 'seene dard', 'छाती दर्द', 'सीने दर्द', 'நெஞ்சு வலி', 'ఛాతీ నొప్పి', 'గుండె నొప్పి'], symptom: 'chest_pain' },
  { keywords: ['breathless', 'difficulty breathing', 'shortness of breath', 'cant breathe', "can't breathe", 'saans taklif', 'सांस तकलीफ', 'श्वास त्रास', 'மூச்சு திணறல்', 'ఊపిరి కష్టం', 'శ్వాస ఇబ్బంది'], symptom: 'breathlessness' },
  { keywords: ['unconscious', 'fainted', 'passed out', 'behosh', 'बेहोश', 'बेशुद्ध', 'மயக்கம்', 'స్పృహ లేదు'], symptom: 'unconscious' },
  { keywords: ['seizure', 'convulsion', 'daura', 'दौरा', 'मिर्गी', 'வலிப்பு', 'మూర్ఛ'], symptom: 'seizure' },
  { keywords: ['severe bleeding', 'heavy bleeding', 'बहुत खून', 'रक्तस्राव', 'ரத்தப்போக்கு', 'రక్తస్రావం'], symptom: 'severe_bleeding' },
  { keywords: ['snake bite', 'saanp', 'सांप काट', 'साप चावला', 'பாம்பு கடி', 'పాము కాటు'], symptom: 'snake_bite' },
];

const SYMPTOM_KW = [
  { keywords: ['fever', 'bukhar', 'बुखार', 'ताप', 'காய்ச்சல்', 'జ్వరం'], symptom: 'fever' },
  { keywords: ['cough', 'khansi', 'खांसी', 'खोकला', 'இருமல்', 'దగ్గు'], symptom: 'cough' },
  { keywords: ['cold', 'sardi', 'सर्दी', 'சளி', 'జలుబు'], symptom: 'cold' },
  { keywords: ['headache', 'sir dard', 'सिरदर्द', 'डोकेदुखी', 'தலைவலி', 'తలనొప్పి'], symptom: 'headache' },
  { keywords: ['stomach', 'pet dard', 'पेट', 'पोट', 'வயிறு', 'కడుపు'], symptom: 'stomach_pain' },
  { keywords: ['vomit', 'ulti', 'उल्टी', 'उलटी', 'வாந்தி', 'వాంతి'], symptom: 'vomiting' },
  { keywords: ['diarrhea', 'loose motion', 'दस्त', 'जुलाब', 'வயிற்றுப்போக்கு', 'విరేచనాలు'], symptom: 'diarrhea' },
  { keywords: ['body ache', 'badan dard', 'शरीर दर्द', 'अंगदुखी', 'உடல் வலி', 'ఒళ్ళు నొప్పి'], symptom: 'body_ache' },
];

const FALLBACK_DISCLAIMERS = {
  en: 'This is not a medical diagnosis. For emergencies, call 108 immediately.',
  hi: 'यह चिकित्सा निदान नहीं है। आपातकाल में तुरंत 108 पर कॉल करें।',
  mr: 'हे वैद्यकीय निदान नाही. आणीबाणीत लगेच 108 वर कॉल करा.',
  ta: 'இது மருத்துவ நோயறிதல் அல்ல. அவசரநிலையில் உடனடியாக 108 அழைக்கவும்.',
  te: 'ఇది వైద్య నిర్ధారణ కాదు. అత్యవసర పరిస్థితిలో వెంటనే 108 కు కాల్ చేయండి.',
};

const FALLBACK_EXPLANATIONS = {
  HIGH: {
    en: 'Your symptoms may be serious. Please call 108 or go to the nearest emergency facility immediately.',
    hi: 'आपके लक्षण गंभीर हो सकते हैं। कृपया तुरंत 108 पर कॉल करें या नजदीकी आपातकालीन सेवा में जाएं।',
    mr: 'तुमची लक्षणे गंभीर असू शकतात. कृपया लगेच 108 वर कॉल करा किंवा जवळच्या आणीबाणी सेवेत जा.',
    ta: 'உங்கள் அறிகுறிகள் தீவிரமாக இருக்கலாம். உடனடியாக 108 அழைக்கவும்.',
    te: 'మీ లక్షణాలు తీవ్రంగా ఉండవచ్చు. దయచేసి వెంటనే 108 కు కాల్ చేయండి.',
  },
  MEDIUM: {
    en: 'Your symptoms need medical attention. Please visit your nearest PHC within 24 hours.',
    hi: 'आपके लक्षणों को चिकित्सा ध्यान की जरूरत है। कृपया 24 घंटे के भीतर नजदीकी PHC जाएं।',
    mr: 'तुमच्या लक्षणांना वैद्यकीय लक्ष आवश्यक आहे. कृपया 24 तासांत जवळच्या PHC ला भेट द्या.',
    ta: 'உங்கள் அறிகுறிகளுக்கு மருத்துவ கவனிப்பு தேவை. 24 மணி நேரத்திற்குள் PHC செல்லவும்.',
    te: 'మీ లక్షణాలకు వైద్య శ్రద్ధ అవసరం. 24 గంటల్లో PHC కి వెళ్ళండి.',
  },
  LOW: {
    en: 'Your symptoms appear mild. Rest, stay hydrated, and visit PHC if symptoms persist.',
    hi: 'आपके लक्षण हल्के लगते हैं। आराम करें, पानी पीते रहें।',
    mr: 'तुमची लक्षणे सौम्य वाटतात. विश्रांती घ्या, पाणी प्या.',
    ta: 'உங்கள் அறிகுறிகள் லேசானவை. ஓய்வெடுங்கள், நீர் அருந்துங்கள்.',
    te: 'మీ లక్షణాలు తేలికగా కనిపిస్తున్నాయి. విశ్రాంతి తీసుకోండి.',
  },
};

function localFallbackTriage(text, language = 'en') {
  // Run scope classifier first
  const scope = localClassifyScope(text);

  if (scope === 'OUT_OF_SCOPE') {
    return {
      scope: 'OUT_OF_SCOPE',
      intent: 'SMALL_TALK',
      reply: OUT_OF_SCOPE_REPLIES[language] || OUT_OF_SCOPE_REPLIES.en,
      triageCard: null, facilities: [], booking: null, structured: null, disclaimer: null,
      meta: { llmUsed: false, fallbackUsed: false, latencyMs: 0 },
    };
  }

  if (scope === 'NON_MEDICAL_SAFE') {
    const redirect = NON_MEDICAL_REDIRECT[language] || NON_MEDICAL_REDIRECT.en;
    return {
      scope: 'NON_MEDICAL_SAFE',
      intent: 'SMALL_TALK',
      reply: (SMALL_TALK_REPLIES[language] || SMALL_TALK_REPLIES.en) + redirect,
      triageCard: null, facilities: [], booking: null, structured: null, disclaimer: null,
      meta: { llmUsed: false, fallbackUsed: false, latencyMs: 0 },
    };
  }

  // MEDICAL — run local intent gate
  const intent = localClassifyIntent(text, language);
  if (intent === 'SMALL_TALK') {
    return {
      scope: 'MEDICAL',
      intent: 'SMALL_TALK',
      reply: SMALL_TALK_REPLIES[language] || SMALL_TALK_REPLIES.en,
      triageCard: null, facilities: [], booking: null, structured: null, disclaimer: null,
      meta: { llmUsed: false, fallbackUsed: false, latencyMs: 0 },
    };
  }
  if (intent === 'CLARIFICATION_REQUIRED') {
    return {
      scope: 'MEDICAL',
      intent: 'CLARIFICATION_REQUIRED',
      reply: CLARIFICATION_REPLIES[language] || CLARIFICATION_REPLIES.en,
      triageCard: null, facilities: [], booking: null, structured: null, disclaimer: null,
      meta: { llmUsed: false, fallbackUsed: false, latencyMs: 0 },
    };
  }

  const lower = text.toLowerCase();

  // Check red flags first — also check combined patterns
  const hasChestPain = /chest\s*pain|chest\s*tight|छाती\s*दर्द|सीने\s*दर्द|நெஞ்சு\s*வலி|ఛాతీ\s*నొప్పి/i.test(lower);
  const hasBreathing = /breath|saans\s*taklif|सांस\s*तकलीफ|श्वास\s*त्रास|மூச்சு\s*திணறல்|ఊపిరి\s*కష్టం/i.test(lower);
  if (hasChestPain || hasBreathing) {
    return buildFallbackResult('HIGH', 'EMERGENCY', ['chest_pain', 'breathlessness'], ['RF-001', 'RF-002'], language);
  }

  for (const rf of RED_FLAG_KW) {
    if (rf.keywords.some(kw => lower.includes(kw.toLowerCase()))) {
      return buildFallbackResult('HIGH', 'EMERGENCY', [rf.symptom], ['RF-FALLBACK'], language);
    }
  }

  // Check general symptoms
  const found = [];
  for (const sk of SYMPTOM_KW) {
    if (sk.keywords.some(kw => lower.includes(kw.toLowerCase()))) {
      found.push(sk.symptom);
    }
  }

  // Check for duration hints
  const hasDuration = /\d+\s*(day|days|din|दिन|दिवस|நாள்|రోజు)/i.test(lower);
  const durationMatch = lower.match(/(\d+)\s*(day|days|din|दिन|दिवस|நாள்|రోజు)/i);
  const durationDays = durationMatch ? parseInt(durationMatch[1]) : null;

  if (found.length > 0) {
    // Fever >= 2 days -> MEDIUM
    if (found.includes('fever') && durationDays && durationDays >= 2) {
      return buildFallbackResult('MEDIUM', 'PHC', found, ['GEN-001'], language);
    }
    // Mild keyword present + short duration -> LOW
    const hasMild = /\bmild\b|\bhalka\b|\bthoda\b|\bslight\b|\blittle\b/i.test(lower);
    const shortDuration = !durationDays || durationDays < 2;
    if (hasMild && shortDuration && found.length === 1 && ['cough', 'cold', 'body_ache', 'headache'].includes(found[0])) {
      return buildFallbackResult('LOW', 'HOME', found, ['GEN-010'], language);
    }
    // Single mild symptom with "since yesterday" / "since morning" / "today" -> LOW
    if (shortDuration && found.length === 1 && ['cough', 'cold'].includes(found[0])) {
      return buildFallbackResult('LOW', 'HOME', found, ['GEN-010'], language);
    }
    // Default for found symptoms
    return buildFallbackResult('MEDIUM', 'PHC', found, ['DEFAULT'], language);
  }

  // Nothing detected — conservative default
  return buildFallbackResult('MEDIUM', 'PHC', ['unknown'], ['DEFAULT'], language);
}

function buildFallbackResult(urgency, careLevel, symptoms, reasonCodes, language) {
  // Guard: urgency must always be valid
  if (!VALID_URGENCIES.has(urgency)) urgency = 'MEDIUM';
  if (!['HOME','PHC','CHC','DISTRICT_HOSPITAL','EMERGENCY'].includes(careLevel)) careLevel = 'PHC';
  const badgeColors = { HIGH: 'RED', MEDIUM: 'YELLOW', LOW: 'GREEN' };
  const badgeLabels = {
    HIGH: { en: 'HIGH URGENCY', hi: 'उच्च आपातकाल', mr: 'उच्च आणीबाणी', ta: 'அதிக அவசரம்', te: 'అధిక అత్యవసరం' },
    MEDIUM: { en: 'MEDIUM URGENCY', hi: 'मध्यम गंभीरता', mr: 'मध्यम गंभीरता', ta: 'நடுத்தர தீவிரம்', te: 'మధ్యస్థ తీవ్రత' },
    LOW: { en: 'LOW URGENCY', hi: 'कम गंभीरता', mr: 'कमी गंभीरता', ta: 'குறைந்த தீவிரம்', te: 'తక్కువ తీవ్రత' },
  };
  const careLabels = {
    HOME: { en: 'Home Care', hi: 'घरेलू देखभाल', mr: 'घरगुती काळजी', ta: 'வீட்டு பராமரிப்பு', te: 'ఇంటి సంరక్షణ' },
    PHC: { en: 'Primary Health Centre (PHC)', hi: 'प्राथमिक स्वास्थ्य केंद्र (PHC)', mr: 'प्राथमिक आरोग्य केंद्र (PHC)', ta: 'ஆரம்ப சுகாதார நிலையம் (PHC)', te: 'ప్రాథమిక ఆరోగ్య కేంద్రం (PHC)' },
    EMERGENCY: { en: 'Emergency — Call 108', hi: 'आपातकाल — 108 पर कॉल करें', mr: 'आणीबाणी — 108 वर कॉल करा', ta: 'அவசரநிலை — 108 அழைக்கவும்', te: 'అత్యవసరం — 108 కు కాల్ చేయండి' },
  };

  const actions = urgency === 'HIGH'
    ? [{ type: 'PRIMARY', label: 'Call 108', action: 'CALL_108' }, { type: 'SECONDARY', label: 'Go to Emergency', action: 'VISIT_EMERGENCY' }]
    : urgency === 'LOW'
    ? [{ type: 'PRIMARY', label: 'Home care', action: 'HOME_CARE' }, { type: 'SECONDARY', label: 'Book Appointment', action: 'BOOK_APPOINTMENT' }]
    : [{ type: 'PRIMARY', label: 'Visit PHC', action: 'VISIT_PHC' }, { type: 'SECONDARY', label: 'Book Appointment', action: 'BOOK_APPOINTMENT' }];

  return {
    scope: 'MEDICAL',
    intent: 'SYMPTOMS',
    urgency,
    careLevel,
    urgencyBadge: { label: (badgeLabels[urgency] || {})[language] || urgency, color: badgeColors[urgency] || 'YELLOW' },
    reasonCodes,
    structured: {
      primaryComplaint: symptoms[0] || 'unknown',
      duration: { value: null, unit: null },
      severity: 'unknown',
      associatedSymptoms: symptoms.slice(1),
      redFlagsDetected: urgency === 'HIGH' ? symptoms : [],
      clarifyingQuestion: null,
    },
    explanation: (FALLBACK_EXPLANATIONS[urgency] || FALLBACK_EXPLANATIONS.MEDIUM)[language] || FALLBACK_EXPLANATIONS.MEDIUM.en,
    disclaimer: FALLBACK_DISCLAIMERS[language] || FALLBACK_DISCLAIMERS.en,
    recommended_facility: (careLabels[careLevel] || careLabels.PHC)[language] || careLevel,
    actions,
  };
}

module.exports = { callAIEngine, localFallbackTriage, classifyScope, localClassifyScope };

const { Router } = require('express');
const { getDb } = require('../db/sqlite');
const { callAIEngine, localFallbackTriage } = require('../ai_bridge');
const { buildEnrichedTriageCard } = require('./triage_helpers');

const router = Router();
const VALID_URGENCIES = new Set(['LOW', 'MEDIUM', 'HIGH']);

// ── Localized triageCard labels ────────────────────────────────────────────
const URGENCY_LABELS = {
  HIGH:   { en: '🚨 HIGH URGENCY', hi: '🚨 उच्च आपातकाल', mr: '🚨 उच्च आणीबाणी', ta: '🚨 அதிக அவசரம்', te: '🚨 అధిక అత్యవసరం' },
  MEDIUM: { en: '⚠️ MEDIUM URGENCY', hi: '⚠️ मध्यम गंभीरता', mr: '⚠️ मध्यम गंभीरता', ta: '⚠️ நடுத்தர தீவிரம்', te: '⚠️ మధ్యస్థ తీవ్రత' },
  LOW:    { en: '✅ LOW URGENCY', hi: '✅ कम गंभीरता', mr: '✅ कमी गंभीरता', ta: '✅ குறைந்த தீவிரம்', te: '✅ తక్కువ తీవ్రత' },
};

const HEADLINES = {
  HIGH:   { en: 'Call 108 or go to Emergency now', hi: 'अभी 108 पर कॉल करें या आपातकाल जाएं', mr: 'आत्ता 108 वर कॉल करा किंवा आणीबाणीत जा', ta: 'இப்போதே 108 அழைக்கவும் அல்லது அவசரநிலைக்கு செல்லவும்', te: 'ఇప్పుడే 108 కు కాల్ చేయండి లేదా అత్యవసర విభాగానికి వెళ్ళండి' },
  MEDIUM: { en: 'Visit PHC within 24 hours', hi: '24 घंटे के भीतर PHC जाएं', mr: '24 तासांत PHC ला भेट द्या', ta: '24 மணி நேரத்திற்குள் PHC செல்லவும்', te: '24 గంటల్లో PHC కి వెళ్ళండి' },
  LOW:    { en: 'Rest at home, monitor symptoms', hi: 'घर पर आराम करें, लक्षण देखें', mr: 'घरी विश्रांती घ्या, लक्षणे पहा', ta: 'வீட்டில் ஓய்வெடுங்கள், அறிகுறிகளை கண்காணிக்கவும்', te: 'ఇంట్లో విశ్రాంతి తీసుకోండి, లక్షణాలు గమనించండి' },
};

const TIME_TO_ACT_LABELS = {
  HIGH:   { en: 'NOW — immediately', hi: 'अभी — तुरंत', mr: 'आत्ता — लगेच', ta: 'இப்போதே — உடனடியாக', te: 'ఇప్పుడే — వెంటనే' },
  MEDIUM: { en: 'Within 24 hours', hi: '24 घंटे के भीतर', mr: '24 तासांत', ta: '24 மணி நேரத்திற்குள்', te: '24 గంటల్లో' },
  LOW:    { en: 'Monitor for 48 hours', hi: '48 घंटे निगरानी करें', mr: '48 तास निरीक्षण करा', ta: '48 மணி நேரம் கண்காணிக்கவும்', te: '48 గంటలు పర్యవేక్షించండి' },
};

const DISCLAIMERS = {
  en: 'Not a diagnosis. For emergencies call 108.',
  hi: 'यह निदान नहीं है। आपातकाल में 108 पर कॉल करें।',
  mr: 'हे निदान नाही. आणीबाणीत 108 वर कॉल करा.',
  ta: 'இது நோயறிதல் அல்ல. அவசரநிலையில் 108 அழைக்கவும்.',
  te: 'ఇది నిర్ధారణ కాదు. అత్యవసరంలో 108 కు కాల్ చేయండి.',
};

const WATCH_FOR_DEFAULTS = {
  HIGH:   { en: ['Loss of consciousness', 'Worsening breathing', 'Severe chest pain'], hi: ['बेहोशी', 'सांस बिगड़ना', 'तेज छाती दर्द'], mr: ['बेशुद्धी', 'श्वास बिघडणे', 'तीव्र छातीत दुखणे'], ta: ['நினைவிழப்பு', 'மூச்சு மோசமாதல்', 'கடுமையான நெஞ்சு வலி'], te: ['స్పృహ కోల్పోవడం', 'శ్వాస మరింత కష్టమవడం', 'తీవ్ర ఛాతీ నొప్పి'] },
  MEDIUM: { en: ['Breathing difficulty', 'Chest pain', 'Fainting'], hi: ['सांस की तकलीफ', 'छाती दर्द', 'बेहोशी'], mr: ['श्वास त्रास', 'छातीत दुखणे', 'बेशुद्धी'], ta: ['மூச்சு திணறல்', 'நெஞ்சு வலி', 'மயக்கம்'], te: ['ఊపిరి ఇబ్బంది', 'ఛాతీ నొప్పి', 'మూర్ఛ'] },
  LOW:    { en: ['Fever above 3 days', 'Worsening symptoms', 'Breathing difficulty'], hi: ['3 दिन से ज़्यादा बुखार', 'लक्षण बिगड़ना', 'सांस की तकलीफ'], mr: ['3 दिवसांपेक्षा जास्त ताप', 'लक्षणे बिघडणे', 'श्वास त्रास'], ta: ['3 நாட்களுக்கு மேல் காய்ச்சல்', 'அறிகுறிகள் மோசமாதல்', 'மூச்சு திணறல்'], te: ['3 రోజులకు మించి జ్వరం', 'లక్షణాలు మరింత తీవ్రమవడం', 'ఊపిరి ఇబ్బంది'] },
};

const SYMPTOM_DISPLAY = {
  fever: { en: 'Fever', hi: 'बुखार', mr: 'ताप', ta: 'காய்ச்சல்', te: 'జ్వరం' },
  cough: { en: 'Cough', hi: 'खांसी', mr: 'खोकला', ta: 'இருமல்', te: 'దగ్గు' },
  cold: { en: 'Cold', hi: 'सर्दी', mr: 'सर्दी', ta: 'சளி', te: 'జలుబు' },
  headache: { en: 'Headache', hi: 'सिरदर्द', mr: 'डोकेदुखी', ta: 'தலைவலி', te: 'తలనొప్పి' },
  stomach_pain: { en: 'Stomach pain', hi: 'पेट दर्द', mr: 'पोटदुखी', ta: 'வயிற்று வலி', te: 'కడుపు నొప్పి' },
  chest_pain: { en: 'Chest pain', hi: 'छाती दर्द', mr: 'छातीत दुखणे', ta: 'நெஞ்சு வலி', te: 'ఛాతీ నొప్పి' },
  breathlessness: { en: 'Breathing difficulty', hi: 'सांस की तकलीफ', mr: 'श्वास त्रास', ta: 'மூச்சு திணறல்', te: 'ఊపిరి ఇబ్బంది' },
  vomiting: { en: 'Vomiting', hi: 'उल्टी', mr: 'उलटी', ta: 'வாந்தி', te: 'వాంతి' },
  diarrhea: { en: 'Loose motion', hi: 'दस्त', mr: 'जुलाब', ta: 'வயிற்றுப்போக்கு', te: 'విరేచనాలు' },
  body_ache: { en: 'Body ache', hi: 'शरीर दर्द', mr: 'अंगदुखी', ta: 'உடல் வலி', te: 'ఒళ్ళు నొప్పి' },
  unconscious: { en: 'Unconsciousness', hi: 'बेहोशी', mr: 'बेशुद्धी', ta: 'மயக்கம்', te: 'స్పృహ లేకపోవడం' },
  seizure: { en: 'Seizures', hi: 'दौरे', mr: 'झटके', ta: 'வலிப்பு', te: 'మూర్ఛ' },
  bleeding: { en: 'Bleeding', hi: 'खून बहना', mr: 'रक्तस्राव', ta: 'ரத்தப்போக்கு', te: 'రక్తస్రావం' },
  unknown: { en: 'Reported symptoms', hi: 'बताए गए लक्षण', mr: 'सांगितलेली लक्षणे', ta: 'தெரிவிக்கப்பட்ட அறிகுறிகள்', te: 'తెలిపిన లక్షణాలు' },
};


// POST /api/triage
router.post('/', async (req, res) => {
  const start = Date.now();
  const { sessionId, text, language = 'en', source = 'text' } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'text is required' });
  }

  const db = getDb();

  let session = sessionId ? db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) : null;
  if (!session) {
    const { v4: uuidv4 } = require('uuid');
    const sid = sessionId || uuidv4();
    db.prepare('INSERT OR IGNORE INTO sessions (id, language) VALUES (?, ?)').run(sid, language);
    session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sid);
  }

  try {
    const result = await callAIEngine(text, language, source);
    const latency = Date.now() - start;

    // Non-symptom intents — return immediately, no triage card
    if (result.intent === 'SMALL_TALK' || result.intent === 'CLARIFICATION_REQUIRED') {
      return res.json({
        intent: result.intent,
        reply: result.reply,
        triageCard: null,
        facilities: [],
        disclaimer: DISCLAIMERS[language] || DISCLAIMERS.en,
        meta: { llmUsed: result.meta?.llmUsed || false, fallbackUsed: result.meta?.fallbackUsed || false, latencyMs: latency },
      });
    }

    // SYMPTOMS — build enriched card
    const urgency = VALID_URGENCIES.has(result.urgency) ? result.urgency : 'MEDIUM';
    const careLevel = result.careLevel || 'PHC';
    const enrichedCard = buildEnrichedTriageCard(urgency, careLevel, result.reasonCodes, result.structured, language);

    // Log triage (no PII)
    db.prepare(`INSERT INTO triage_logs (session_id, language, urgency, care_level, reason_codes, source, llm_used, fallback_used, latency_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      session.id, language, urgency, careLevel,
      JSON.stringify(result.reasonCodes || []), source,
      result.meta?.llmUsed ? 1 : 0,
      result.meta?.fallbackUsed ? 1 : 0,
      latency
    );

    db.prepare(`UPDATE sessions SET last_urgency = ?, last_care_level = ?, triage_count = triage_count + 1, last_active = datetime('now') WHERE id = ?`)
      .run(urgency, careLevel, session.id);

    res.json({
      intent: 'SYMPTOMS',
      triageCard: enrichedCard,
      facilities: [],
      structured: result.structured,
      disclaimer: DISCLAIMERS[language] || DISCLAIMERS.en,
      // Legacy fields (deprecated — kept for backward compat)
      urgency,
      careLevel,
      explanation: result.explanation,
      recommended_facility: result.recommended_facility,
      urgencyBadge: result.urgencyBadge,
      actions: result.actions,
      meta: { llmUsed: result.meta?.llmUsed || false, fallbackUsed: result.meta?.fallbackUsed || false, latencyMs: latency },
    });

  } catch (err) {
    console.error('[Triage] AI engine error, using fallback:', err.message);
    const fallback = localFallbackTriage(text, language);
    const latency = Date.now() - start;

    if (fallback.intent === 'SMALL_TALK' || fallback.intent === 'CLARIFICATION_REQUIRED') {
      return res.json({
        intent: fallback.intent,
        reply: fallback.reply,
        triageCard: null,
        facilities: [],
        disclaimer: DISCLAIMERS[language] || DISCLAIMERS.en,
        meta: { llmUsed: false, fallbackUsed: true, latencyMs: latency },
      });
    }

    const urgency = VALID_URGENCIES.has(fallback.urgency) ? fallback.urgency : 'MEDIUM';
    const careLevel = fallback.careLevel || 'PHC';
    const enrichedCard = buildEnrichedTriageCard(urgency, careLevel, fallback.reasonCodes, fallback.structured, language);

    db.prepare(`INSERT INTO triage_logs (session_id, language, urgency, care_level, reason_codes, source, llm_used, fallback_used, latency_ms)
      VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?)`).run(
      session.id, language, urgency, careLevel,
      JSON.stringify(fallback.reasonCodes || []), source, latency
    );

    db.prepare(`UPDATE sessions SET last_urgency = ?, last_care_level = ?, triage_count = triage_count + 1, last_active = datetime('now') WHERE id = ?`)
      .run(urgency, careLevel, session.id);

    res.json({
      intent: 'SYMPTOMS',
      triageCard: enrichedCard,
      facilities: [],
      structured: fallback.structured,
      disclaimer: DISCLAIMERS[language] || DISCLAIMERS.en,
      urgency,
      careLevel,
      explanation: fallback.explanation,
      recommended_facility: fallback.recommended_facility,
      meta: { llmUsed: false, fallbackUsed: true, latencyMs: latency },
    });
  }
});

module.exports = router;

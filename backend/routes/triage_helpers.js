/**
 * Shared triage card builder — used by both triage.js and chat.js.
 * Urgency/careLevel ALWAYS come from deterministic rule engine, never Gemini.
 */

const VALID_URGENCIES = new Set(['LOW', 'MEDIUM', 'HIGH']);

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

function getSymptomLabel(key, lang) {
  return (SYMPTOM_DISPLAY[key] || SYMPTOM_DISPLAY.unknown)[lang]
    || (SYMPTOM_DISPLAY[key] || SYMPTOM_DISPLAY.unknown).en;
}

/**
 * Build a fully-populated, localized triage card.
 * urgency and careLevel MUST come from deterministic rule engine.
 */
function buildEnrichedTriageCard(urgency, careLevel, reasonCodes, structured, language) {
  const lang = language || 'en';
  const safeUrgency = VALID_URGENCIES.has(urgency) ? urgency : 'MEDIUM';
  const safeCareLevel = careLevel || 'PHC';

  // why bullets (max 2)
  const why = [];
  const primary = structured?.primaryComplaint;
  const duration = structured?.duration;
  if (primary && primary !== 'unknown') {
    const label = getSymptomLabel(primary, lang);
    const dur = duration?.value ? ` for ${duration.value} ${duration.unit || 'days'}` : '';
    why.push(label + dur);
  }
  const associated = structured?.associatedSymptoms || [];
  if (associated.length > 0 && why.length < 2) {
    why.push(getSymptomLabel(associated[0], lang));
  }
  if (why.length === 0) why.push(getSymptomLabel('unknown', lang));

  // watchFor (localized defaults)
  const watchFor = (WATCH_FOR_DEFAULTS[safeUrgency] || WATCH_FOR_DEFAULTS.MEDIUM)[lang]
    || WATCH_FOR_DEFAULTS[safeUrgency].en;

  // actions — all with priority field, all actionIds match /api/chat/action
  const actions = safeUrgency === 'HIGH'
    ? [
        { priority: 'PRIMARY',   label: 'Call 108',           actionId: 'CALL_108' },
        { priority: 'SECONDARY', label: 'Find Emergency',     actionId: 'FIND_FACILITY' },
        { priority: 'SECONDARY', label: 'Book Appointment',   actionId: 'BOOK_APPOINTMENT' },
      ]
    : safeUrgency === 'LOW'
    ? [
        { priority: 'PRIMARY',   label: 'Home care tips',     actionId: 'HOME_TIPS' },
        { priority: 'SECONDARY', label: 'Find nearest PHC',   actionId: 'FIND_FACILITY' },
        { priority: 'SECONDARY', label: 'Book Appointment',   actionId: 'BOOK_APPOINTMENT' },
      ]
    : [
        { priority: 'PRIMARY',   label: 'Find nearest PHC',   actionId: 'FIND_FACILITY' },
        { priority: 'SECONDARY', label: 'Book Appointment',   actionId: 'BOOK_APPOINTMENT' },
        { priority: 'SECONDARY', label: 'Home care tips',     actionId: 'HOME_TIPS' },
      ];

  return {
    urgency: safeUrgency,
    careLevel: safeCareLevel,
    urgencyLabel: (URGENCY_LABELS[safeUrgency] || URGENCY_LABELS.MEDIUM)[lang] || URGENCY_LABELS[safeUrgency].en,
    headline: (HEADLINES[safeUrgency] || HEADLINES.MEDIUM)[lang] || HEADLINES[safeUrgency].en,
    timeToAct: (TIME_TO_ACT_LABELS[safeUrgency] || TIME_TO_ACT_LABELS.MEDIUM)[lang] || TIME_TO_ACT_LABELS[safeUrgency].en,
    why: why.slice(0, 2),
    watchFor: watchFor.slice(0, 3),
    actions,
  };
}

module.exports = { buildEnrichedTriageCard };

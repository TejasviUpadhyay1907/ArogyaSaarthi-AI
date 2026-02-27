/**
 * Symptom Checker routes
 * POST /api/symptom-checker/followups  — dynamic follow-up questions
 * POST /api/symptom-checker/triage     — full triage with enriched card
 */
const { Router } = require('express');
const { callAIEngine, localFallbackTriage } = require('../ai_bridge');
const { buildEnrichedTriageCard } = require('./triage_helpers');

const router = Router();

// ── Follow-up question rules (deterministic, symptom-specific) ─────────────
const FOLLOWUP_RULES = {
  fever: [
    { id: 'fever_temp', type: 'choice', questionKey: 'fever_temp', options: ['below_100', '100_102', 'above_102'] },
    { id: 'fever_chills', type: 'yesno', questionKey: 'fever_chills' },
    { id: 'fever_rash', type: 'yesno', questionKey: 'fever_rash' },
  ],
  chest_pain: [
    { id: 'cp_radiation', type: 'yesno', questionKey: 'cp_radiation' },
    { id: 'cp_breathless', type: 'yesno', questionKey: 'cp_breathless' },
    { id: 'cp_sweating', type: 'yesno', questionKey: 'cp_sweating' },
  ],
  breathlessness: [
    { id: 'breath_rest', type: 'yesno', questionKey: 'breath_rest' },
    { id: 'breath_onset', type: 'choice', questionKey: 'breath_onset', options: ['sudden', 'gradual', 'exertion'] },
    { id: 'breath_position', type: 'yesno', questionKey: 'breath_position' },
  ],
  cough: [
    { id: 'cough_type', type: 'choice', questionKey: 'cough_type', options: ['dry', 'wet', 'blood'] },
    { id: 'cough_night', type: 'yesno', questionKey: 'cough_night' },
  ],
  stomach_pain: [
    { id: 'sp_location', type: 'choice', questionKey: 'sp_location', options: ['upper', 'lower', 'all_over'] },
    { id: 'sp_vomiting', type: 'yesno', questionKey: 'sp_vomiting' },
    { id: 'sp_blood', type: 'yesno', questionKey: 'sp_blood' },
  ],
  headache: [
    { id: 'ha_severity', type: 'slider', questionKey: 'ha_severity', min: 1, max: 10 },
    { id: 'ha_vision', type: 'yesno', questionKey: 'ha_vision' },
    { id: 'ha_neck', type: 'yesno', questionKey: 'ha_neck' },
  ],
  vomiting: [
    { id: 'vom_blood', type: 'yesno', questionKey: 'vom_blood' },
    { id: 'vom_frequency', type: 'choice', questionKey: 'vom_frequency', options: ['once', '2_3_times', 'more_than_3'] },
  ],
  diarrhea: [
    { id: 'dia_blood', type: 'yesno', questionKey: 'dia_blood' },
    { id: 'dia_frequency', type: 'choice', questionKey: 'dia_frequency', options: ['1_2', '3_5', 'more_than_5'] },
    { id: 'dia_dehydration', type: 'yesno', questionKey: 'dia_dehydration' },
  ],
  default: [
    { id: 'gen_worsening', type: 'yesno', questionKey: 'gen_worsening' },
    { id: 'gen_similar_before', type: 'yesno', questionKey: 'gen_similar_before' },
    { id: 'gen_pain_scale', type: 'slider', questionKey: 'gen_pain_scale', min: 1, max: 10 },
  ],
};

// ── i18n for follow-up questions ───────────────────────────────────────────
const Q_LABELS = {
  fever_temp: {
    en: 'What is your temperature?',
    hi: 'आपका तापमान क्या है?',
    mr: 'तुमचे तापमान किती आहे?',
    ta: 'உங்கள் வெப்பநிலை என்ன?',
    te: 'మీ ఉష్ణోగ్రత ఎంత?',
  },
  fever_chills: {
    en: 'Are you experiencing chills or shivering?',
    hi: 'क्या आपको ठंड लग रही है या कंपकंपी हो रही है?',
    mr: 'तुम्हाला थंडी वाजत आहे का?',
    ta: 'உங்களுக்கு குளிர் அல்லது நடுக்கம் உள்ளதா?',
    te: 'మీకు చలి లేదా వణుకు ఉందా?',
  },
  fever_rash: {
    en: 'Do you have any skin rash?',
    hi: 'क्या आपकी त्वचा पर कोई दाने हैं?',
    mr: 'तुमच्या त्वचेवर पुरळ आहे का?',
    ta: 'உங்களுக்கு தோல் தடிப்பு உள்ளதா?',
    te: 'మీకు చర్మంపై దద్దుర్లు ఉన్నాయా?',
  },
  cp_radiation: {
    en: 'Does the pain spread to your arm, jaw, or back?',
    hi: 'क्या दर्द आपके हाथ, जबड़े या पीठ तक फैलता है?',
    mr: 'वेदना हात, जबडा किंवा पाठीपर्यंत पसरते का?',
    ta: 'வலி உங்கள் கை, தாடை அல்லது முதுகுக்கு பரவுகிறதா?',
    te: 'నొప్పి మీ చేయి, దవడ లేదా వీపుకు వ్యాపిస్తుందా?',
  },
  cp_breathless: {
    en: 'Are you having difficulty breathing along with chest pain?',
    hi: 'क्या छाती दर्द के साथ सांस लेने में तकलीफ है?',
    mr: 'छातीत दुखण्यासोबत श्वास घेण्यास त्रास होतो का?',
    ta: 'நெஞ்சு வலியுடன் மூச்சு திணறல் உள்ளதா?',
    te: 'ఛాతీ నొప్పితో పాటు శ్వాస తీసుకోవడంలో ఇబ్బంది ఉందా?',
  },
  cp_sweating: {
    en: 'Are you sweating excessively or feeling cold and clammy?',
    hi: 'क्या आपको बहुत पसीना आ रहा है या ठंडा और चिपचिपा महसूस हो रहा है?',
    mr: 'तुम्हाला जास्त घाम येतो का किंवा थंड आणि ओलसर वाटते का?',
    ta: 'நீங்கள் அதிகமாக வியர்க்கிறீர்களா அல்லது குளிர்ச்சியாக உணர்கிறீர்களா?',
    te: 'మీకు అధికంగా చెమట పడుతుందా లేదా చల్లగా అనిపిస్తుందా?',
  },
  breath_rest: {
    en: 'Do you have breathing difficulty even at rest?',
    hi: 'क्या आराम करते समय भी सांस लेने में तकलीफ होती है?',
    mr: 'विश्रांती घेताना देखील श्वास घेण्यास त्रास होतो का?',
    ta: 'ஓய்வில் இருக்கும்போதும் மூச்சு திணறல் உள்ளதா?',
    te: 'విశ్రాంతిలో కూడా శ్వాస తీసుకోవడంలో ఇబ్బంది ఉందా?',
  },
  breath_onset: {
    en: 'How did the breathing difficulty start?',
    hi: 'सांस की तकलीफ कैसे शुरू हुई?',
    mr: 'श्वास त्रास कसा सुरू झाला?',
    ta: 'மூச்சு திணறல் எப்படி தொடங்கியது?',
    te: 'శ్వాస ఇబ్బంది ఎలా మొదలైంది?',
  },
  breath_position: {
    en: 'Does lying flat make your breathing worse?',
    hi: 'क्या लेटने पर सांस की तकलीफ बढ़ती है?',
    mr: 'झोपल्यावर श्वास त्रास वाढतो का?',
    ta: 'படுத்திருக்கும்போது மூச்சு திணறல் அதிகமாகுமா?',
    te: 'పడుకున్నప్పుడు శ్వాస ఇబ్బంది పెరుగుతుందా?',
  },
  cough_type: {
    en: 'What type of cough do you have?',
    hi: 'आपको किस प्रकार की खांसी है?',
    mr: 'तुम्हाला कोणत्या प्रकारचा खोकला आहे?',
    ta: 'உங்களுக்கு எந்த வகையான இருமல் உள்ளது?',
    te: 'మీకు ఏ రకమైన దగ్గు ఉంది?',
  },
  cough_night: {
    en: 'Is your cough worse at night?',
    hi: 'क्या रात में खांसी ज़्यादा होती है?',
    mr: 'रात्री खोकला जास्त होतो का?',
    ta: 'இரவில் இருமல் அதிகமாகுமா?',
    te: 'రాత్రి దగ్గు ఎక్కువగా ఉంటుందా?',
  },
  sp_location: {
    en: 'Where is the stomach pain located?',
    hi: 'पेट दर्द कहाँ है?',
    mr: 'पोटदुखी कुठे आहे?',
    ta: 'வயிற்று வலி எங்கே உள்ளது?',
    te: 'కడుపు నొప్పి ఎక్కడ ఉంది?',
  },
  sp_vomiting: {
    en: 'Do you have vomiting along with stomach pain?',
    hi: 'क्या पेट दर्द के साथ उल्टी भी है?',
    mr: 'पोटदुखीसोबत उलटी होते का?',
    ta: 'வயிற்று வலியுடன் வாந்தியும் உள்ளதா?',
    te: 'కడుపు నొప్పితో పాటు వాంతి కూడా ఉందా?',
  },
  sp_blood: {
    en: 'Have you noticed any blood in stool or vomit?',
    hi: 'क्या मल या उल्टी में खून दिखा है?',
    mr: 'मल किंवा उलटीत रक्त दिसले का?',
    ta: 'மலம் அல்லது வாந்தியில் ரத்தம் தெரிந்ததா?',
    te: 'మలం లేదా వాంతిలో రక్తం కనిపించిందా?',
  },
  ha_severity: {
    en: 'On a scale of 1–10, how severe is your headache?',
    hi: '1–10 के पैमाने पर, आपका सिरदर्द कितना गंभीर है?',
    mr: '1–10 च्या प्रमाणात, तुमची डोकेदुखी किती तीव्र आहे?',
    ta: '1–10 அளவில், உங்கள் தலைவலி எவ்வளவு தீவிரமானது?',
    te: '1–10 స్కేల్‌లో, మీ తలనొప్పి ఎంత తీవ్రంగా ఉంది?',
  },
  ha_vision: {
    en: 'Do you have any vision changes or blurring?',
    hi: 'क्या आपकी दृष्टि में कोई बदलाव या धुंधलापन है?',
    mr: 'दृष्टीत काही बदल किंवा अंधुकपणा आहे का?',
    ta: 'பார்வையில் மாற்றங்கள் அல்லது மங்கல் உள்ளதா?',
    te: 'దృష్టిలో మార్పులు లేదా మసకగా కనిపిస్తుందా?',
  },
  ha_neck: {
    en: 'Do you have neck stiffness along with headache?',
    hi: 'क्या सिरदर्द के साथ गर्दन में अकड़न है?',
    mr: 'डोकेदुखीसोबत मान ताठ आहे का?',
    ta: 'தலைவலியுடன் கழுத்து விறைப்பு உள்ளதா?',
    te: 'తలనొప్పితో పాటు మెడ బిగుతుగా ఉందా?',
  },
  vom_blood: {
    en: 'Is there any blood in your vomit?',
    hi: 'क्या उल्टी में खून है?',
    mr: 'उलटीत रक्त आहे का?',
    ta: 'வாந்தியில் ரத்தம் உள்ளதா?',
    te: 'వాంతిలో రక్తం ఉందా?',
  },
  vom_frequency: {
    en: 'How many times have you vomited?',
    hi: 'आपको कितनी बार उल्टी हुई?',
    mr: 'तुम्हाला किती वेळा उलटी झाली?',
    ta: 'நீங்கள் எத்தனை முறை வாந்தி எடுத்தீர்கள்?',
    te: 'మీకు ఎన్నిసార్లు వాంతి అయింది?',
  },
  dia_blood: {
    en: 'Is there any blood in your stool?',
    hi: 'क्या मल में खून है?',
    mr: 'मलात रक्त आहे का?',
    ta: 'மலத்தில் ரத்தம் உள்ளதா?',
    te: 'మలంలో రక్తం ఉందా?',
  },
  dia_frequency: {
    en: 'How many times have you had loose motions today?',
    hi: 'आज कितनी बार दस्त हुए?',
    mr: 'आज किती वेळा जुलाब झाले?',
    ta: 'இன்று எத்தனை முறை வயிற்றுப்போக்கு ஏற்பட்டது?',
    te: 'ఈరోజు ఎన్నిసార్లు విరేచనాలు అయ్యాయి?',
  },
  dia_dehydration: {
    en: 'Do you feel very thirsty, dizzy, or have dry mouth?',
    hi: 'क्या आपको बहुत प्यास, चक्कर या मुंह सूखने की समस्या है?',
    mr: 'तुम्हाला खूप तहान, चक्कर किंवा तोंड कोरडे वाटते का?',
    ta: 'மிகவும் தாகம், தலைசுற்றல் அல்லது வாய் வறட்சி உள்ளதா?',
    te: 'చాలా దాహం, తలతిరుగుడు లేదా నోరు పొడిగా ఉందా?',
  },
  gen_worsening: {
    en: 'Are your symptoms getting worse over time?',
    hi: 'क्या आपके लक्षण समय के साथ बिगड़ रहे हैं?',
    mr: 'तुमची लक्षणे वेळेनुसार बिघडत आहेत का?',
    ta: 'உங்கள் அறிகுறிகள் காலப்போக்கில் மோசமாகுகின்றனவா?',
    te: 'మీ లక్షణాలు కాలక్రమేణా మరింత తీవ్రమవుతున్నాయా?',
  },
  gen_similar_before: {
    en: 'Have you had similar symptoms before?',
    hi: 'क्या पहले भी ऐसे लक्षण हुए हैं?',
    mr: 'आधी असे लक्षणे झाले होते का?',
    ta: 'முன்பு இதுபோன்ற அறிகுறிகள் இருந்ததா?',
    te: 'ముందు కూడా ఇలాంటి లక్షణాలు వచ్చాయా?',
  },
  gen_pain_scale: {
    en: 'On a scale of 1–10, how much discomfort are you feeling?',
    hi: '1–10 के पैमाने पर, आप कितनी तकलीफ महसूस कर रहे हैं?',
    mr: '1–10 च्या प्रमाणात, तुम्हाला किती त्रास होत आहे?',
    ta: '1–10 அளவில், நீங்கள் எவ்வளவு அசௌகரியம் உணர்கிறீர்கள்?',
    te: '1–10 స్కేల్‌లో, మీకు ఎంత అసౌకర్యంగా అనిపిస్తుంది?',
  },
};

const OPT_LABELS = {
  below_100: { en: 'Below 100°F', hi: '100°F से कम', mr: '100°F पेक्षा कमी', ta: '100°F க்கும் குறைவு', te: '100°F కంటే తక్కువ' },
  '100_102': { en: '100–102°F', hi: '100–102°F', mr: '100–102°F', ta: '100–102°F', te: '100–102°F' },
  above_102: { en: 'Above 102°F', hi: '102°F से ज़्यादा', mr: '102°F पेक्षा जास्त', ta: '102°F க்கும் அதிகம்', te: '102°F కంటే ఎక్కువ' },
  sudden: { en: 'Suddenly', hi: 'अचानक', mr: 'अचानक', ta: 'திடீரென', te: 'అకస్మాత్తుగా' },
  gradual: { en: 'Gradually', hi: 'धीरे-धीरे', mr: 'हळूहळू', ta: 'படிப்படியாக', te: 'క్రమంగా' },
  exertion: { en: 'During exertion', hi: 'मेहनत के दौरान', mr: 'श्रम करताना', ta: 'உழைப்பின் போது', te: 'శ్రమ సమయంలో' },
  dry: { en: 'Dry cough', hi: 'सूखी खांसी', mr: 'कोरडा खोकला', ta: 'உலர் இருமல்', te: 'పొడి దగ్గు' },
  wet: { en: 'Wet/productive', hi: 'बलगम वाली', mr: 'ओला खोकला', ta: 'ஈரமான இருமல்', te: 'తడి దగ్గు' },
  blood: { en: 'With blood', hi: 'खून के साथ', mr: 'रक्तासह', ta: 'ரத்தத்துடன்', te: 'రక్తంతో' },
  upper: { en: 'Upper abdomen', hi: 'ऊपरी पेट', mr: 'वरचे पोट', ta: 'மேல் வயிறு', te: 'పై కడుపు' },
  lower: { en: 'Lower abdomen', hi: 'निचला पेट', mr: 'खालचे पोट', ta: 'கீழ் வயிறு', te: 'కింది కడుపు' },
  all_over: { en: 'All over', hi: 'पूरे पेट में', mr: 'सर्वत्र', ta: 'எங்கும்', te: 'అంతటా' },
  once: { en: 'Once', hi: 'एक बार', mr: 'एकदा', ta: 'ஒரு முறை', te: 'ఒకసారి' },
  '2_3_times': { en: '2–3 times', hi: '2–3 बार', mr: '2–3 वेळा', ta: '2–3 முறை', te: '2–3 సార్లు' },
  more_than_3: { en: 'More than 3', hi: '3 से ज़्यादा', mr: '3 पेक्षा जास्त', ta: '3 க்கும் அதிகம்', te: '3 కంటే ఎక్కువ' },
  '1_2': { en: '1–2 times', hi: '1–2 बार', mr: '1–2 वेळा', ta: '1–2 முறை', te: '1–2 సార్లు' },
  '3_5': { en: '3–5 times', hi: '3–5 बार', mr: '3–5 वेळा', ta: '3–5 முறை', te: '3–5 సార్లు' },
  more_than_5: { en: 'More than 5', hi: '5 से ज़्यादा', mr: '5 पेक्षा जास्त', ta: '5 க்கும் அதிகம்', te: '5 కంటే ఎక్కువ' },
};

function getOptLabel(key, lang) {
  const l = OPT_LABELS[key];
  if (!l) return key;
  return l[lang] || l.en;
}

function getQLabel(key, lang) {
  const q = Q_LABELS[key];
  if (!q) return key;
  return q[lang] || q.en;
}

function buildFollowups(selectedSymptoms, lang) {
  const symptoms = Array.isArray(selectedSymptoms) ? selectedSymptoms : [selectedSymptoms];
  const seen = new Set();
  const questions = [];

  // Priority: first symptom drives the question set
  const primary = symptoms[0] || 'default';
  const rules = FOLLOWUP_RULES[primary] || FOLLOWUP_RULES.default;

  for (const rule of rules) {
    if (seen.has(rule.id)) continue;
    seen.add(rule.id);
    const q = {
      id: rule.id,
      type: rule.type,
      question: getQLabel(rule.questionKey, lang),
    };
    if (rule.type === 'choice') {
      q.options = rule.options.map(o => ({ value: o, label: getOptLabel(o, lang) }));
    }
    if (rule.type === 'slider') {
      q.min = rule.min || 1;
      q.max = rule.max || 10;
    }
    questions.push(q);
    if (questions.length >= 4) break;
  }

  // Add a generic worsening question if < 2 questions
  if (questions.length < 2 && !seen.has('gen_worsening')) {
    questions.push({
      id: 'gen_worsening',
      type: 'yesno',
      question: getQLabel('gen_worsening', lang),
    });
  }

  return questions;
}

// POST /api/symptom-checker/followups
router.post('/followups', (req, res) => {
  const { selectedSymptoms = [], ageGroup, duration, severity, language = 'en' } = req.body;
  const lang = ['en', 'hi', 'mr', 'ta', 'te'].includes(language) ? language : 'en';

  const questions = buildFollowups(selectedSymptoms, lang);
  return res.json({ questions, lang });
});

// POST /api/symptom-checker/triage
router.post('/triage', async (req, res) => {
  const {
    patient, ageGroup, trimester,
    selectedSymptoms = [], duration, severity,
    followupAnswers = {}, language = 'en',
  } = req.body;

  const lang = ['en', 'hi', 'mr', 'ta', 'te'].includes(language) ? language : 'en';

  // Build a text description for the AI engine
  const symptomsText = selectedSymptoms.join(', ') || 'general symptoms';
  const contextText = [
    symptomsText,
    duration ? `duration: ${duration}` : '',
    severity ? `severity: ${severity}` : '',
    patient ? `patient: ${patient}` : '',
    ageGroup ? `age group: ${ageGroup}` : '',
    trimester ? `trimester: ${trimester}` : '',
  ].filter(Boolean).join(', ');

  const start = Date.now();
  let result;
  try {
    result = await callAIEngine(contextText, lang, 'text');
  } catch {
    result = localFallbackTriage(contextText, lang);
  }

  const urgency = result.urgency || 'MEDIUM';
  const careLevel = result.careLevel || 'PHC';
  const structured = result.structured || {
    primaryComplaint: selectedSymptoms[0] || 'unknown',
    associatedSymptoms: selectedSymptoms.slice(1),
    duration: duration ? { value: duration, unit: 'days' } : null,
  };

  const triageCard = buildEnrichedTriageCard(urgency, careLevel, result.reasonCodes || [], structured, lang);

  return res.json({
    triageCard,
    urgency,
    careLevel,
    nextStep: (urgency === 'HIGH' || urgency === 'MEDIUM') ? 'ASK_LOCATION' : null,
    meta: {
      llmUsed: result.meta?.llmUsed || false,
      fallbackUsed: result.meta?.fallbackUsed || false,
      latencyMs: Date.now() - start,
    },
  });
});

module.exports = router;

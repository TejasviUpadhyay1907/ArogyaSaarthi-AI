const { Router } = require('express');
const router = Router();

// GET /api/demo-symptom-checker — judge demo for Symptom Checker
router.get('/', (req, res) => {
  res.json({
    description: 'ArogyaSaarthi Symptom Checker — Judge Demo Test Cases',
    endpoint: 'POST /api/triage',
    body: '{ "text": "<message>", "language": "en|hi|mr|ta|te" }',
    testCases: [
      // ── Small talk — must NEVER trigger triage ──────────────────
      { id: 1, input: 'hello', language: 'en', expectedIntent: 'SMALL_TALK', expectedUrgency: null, expectedTriageCard: null, note: 'Greeting — no triage' },
      { id: 2, input: 'thanks', language: 'en', expectedIntent: 'SMALL_TALK', expectedUrgency: null, expectedTriageCard: null, note: 'Thanks — no triage' },
      { id: 3, input: 'ok', language: 'en', expectedIntent: 'SMALL_TALK', expectedUrgency: null, expectedTriageCard: null, note: 'Acknowledgement — no triage' },
      { id: 4, input: 'नमस्ते', language: 'hi', expectedIntent: 'SMALL_TALK', expectedUrgency: null, expectedTriageCard: null, note: 'Hindi greeting' },
      { id: 5, input: 'నమస్తే', language: 'te', expectedIntent: 'SMALL_TALK', expectedUrgency: null, expectedTriageCard: null, note: 'Telugu greeting' },
      { id: 6, input: 'வணக்கம்', language: 'ta', expectedIntent: 'SMALL_TALK', expectedUrgency: null, expectedTriageCard: null, note: 'Tamil greeting' },
      { id: 7, input: 'नमस्कार', language: 'mr', expectedIntent: 'SMALL_TALK', expectedUrgency: null, expectedTriageCard: null, note: 'Marathi greeting' },

      // ── Clarification required ──────────────────────────────────
      { id: 8, input: 'not feeling well', language: 'en', expectedIntent: 'CLARIFICATION_REQUIRED', expectedUrgency: null, note: 'Vague — ask for symptom' },
      { id: 9, input: 'I am sick', language: 'en', expectedIntent: 'CLARIFICATION_REQUIRED', expectedUrgency: null, note: 'Vague health complaint' },
      { id: 10, input: 'help', language: 'en', expectedIntent: 'CLARIFICATION_REQUIRED', expectedUrgency: null, note: 'Single word — clarify' },
      { id: 11, input: 'तबियत ठीक नहीं', language: 'hi', expectedIntent: 'CLARIFICATION_REQUIRED', expectedUrgency: null, note: 'Hindi vague complaint' },
      { id: 12, input: 'బాగా లేను', language: 'te', expectedIntent: 'CLARIFICATION_REQUIRED', expectedUrgency: null, note: 'Telugu vague complaint' },

      // ── MEDIUM / PHC ────────────────────────────────────────────
      { id: 13, input: 'fever 2 days', language: 'en', expectedIntent: 'SYMPTOMS', expectedUrgency: 'MEDIUM', expectedCareLevel: 'PHC', note: 'Classic fever — PHC within 24h' },
      { id: 14, input: 'loose motion for 3 days', language: 'en', expectedIntent: 'SYMPTOMS', expectedUrgency: 'MEDIUM', expectedCareLevel: 'PHC', note: 'Diarrhea 3 days' },
      { id: 15, input: 'fever with headache for 2 days', language: 'en', expectedIntent: 'SYMPTOMS', expectedUrgency: 'MEDIUM', expectedCareLevel: 'PHC', note: 'Fever + headache' },
      { id: 16, input: '2 दिन से बुखार है', language: 'hi', expectedIntent: 'SYMPTOMS', expectedUrgency: 'MEDIUM', expectedCareLevel: 'PHC', note: 'Hindi fever 2 days' },
      { id: 17, input: '3 दिवसांपासून ताप आहे', language: 'mr', expectedIntent: 'SYMPTOMS', expectedUrgency: 'MEDIUM', expectedCareLevel: 'PHC', note: 'Marathi fever 3 days' },
      { id: 18, input: '2 நாட்களாக காய்ச்சல்', language: 'ta', expectedIntent: 'SYMPTOMS', expectedUrgency: 'MEDIUM', expectedCareLevel: 'PHC', note: 'Tamil fever 2 days' },
      { id: 19, input: '2 రోజులుగా జ్వరం మరియు తలనొప్పి', language: 'te', expectedIntent: 'SYMPTOMS', expectedUrgency: 'MEDIUM', expectedCareLevel: 'PHC', note: 'Telugu fever + headache' },

      // ── HIGH / EMERGENCY ────────────────────────────────────────
      { id: 20, input: 'chest pain and difficulty breathing', language: 'en', expectedIntent: 'SYMPTOMS', expectedUrgency: 'HIGH', expectedCareLevel: 'EMERGENCY', note: 'Red flag — call 108 immediately' },
      { id: 21, input: 'I fainted and had a seizure', language: 'en', expectedIntent: 'SYMPTOMS', expectedUrgency: 'HIGH', expectedCareLevel: 'EMERGENCY', note: 'Unconscious + seizure' },
      { id: 22, input: 'मेरी छाती में दर्द है और सांस लेने में तकलीफ है', language: 'hi', expectedIntent: 'SYMPTOMS', expectedUrgency: 'HIGH', expectedCareLevel: 'EMERGENCY', note: 'Hindi chest pain + breathlessness' },
      { id: 23, input: 'நெஞ்சு வலி மற்றும் மூச்சு திணறல்', language: 'ta', expectedIntent: 'SYMPTOMS', expectedUrgency: 'HIGH', expectedCareLevel: 'EMERGENCY', note: 'Tamil chest pain + breathlessness' },
      { id: 24, input: 'ఛాతీ నొప్పి మరియు ఊపిరి ఆడటం కష్టం', language: 'te', expectedIntent: 'SYMPTOMS', expectedUrgency: 'HIGH', expectedCareLevel: 'EMERGENCY', note: 'Telugu chest pain + breathlessness' },
      { id: 25, input: 'snake bite on my leg', language: 'en', expectedIntent: 'SYMPTOMS', expectedUrgency: 'HIGH', expectedCareLevel: 'EMERGENCY', note: 'Snake bite emergency' },

      // ── LOW / HOME ──────────────────────────────────────────────
      { id: 26, input: 'mild cough since yesterday', language: 'en', expectedIntent: 'SYMPTOMS', expectedUrgency: 'LOW', expectedCareLevel: 'HOME', note: 'Mild short-duration cough' },
      { id: 27, input: 'slight cold today', language: 'en', expectedIntent: 'SYMPTOMS', expectedUrgency: 'LOW', expectedCareLevel: 'HOME', note: 'Mild cold today' },
    ],
    expectedResponseShape: {
      intent: 'SYMPTOMS | SMALL_TALK | CLARIFICATION_REQUIRED',
      triageCard: {
        urgency: 'LOW | MEDIUM | HIGH',
        careLevel: 'HOME | PHC | CHC | DISTRICT_HOSPITAL | EMERGENCY',
        urgencyLabel: 'Localized urgency string',
        headline: 'Short action headline',
        timeToAct: 'NOW | Within 24 hours | Monitor for 48 hours',
        why: ['max 2 reason bullets'],
        watchFor: ['max 3 red flag bullets'],
        actions: [{ priority: 'PRIMARY | SECONDARY', label: '...', action: 'CALL_108 | FIND_FACILITY | ...' }],
      },
      facilities: [{ id: 1, type: 'PHC', name: '...', distanceKm: 3.2, hours: '9am – 5pm', district: 'Pune' }],
      structured: { primaryComplaint: '...', duration: { value: 2, unit: 'days' }, severity: '...', associatedSymptoms: [], redFlagsDetected: [] },
      disclaimer: 'Not a diagnosis. For emergencies call 108.',
      meta: { llmUsed: true, fallbackUsed: false, latencyMs: 120 },
    },
  });
});

module.exports = router;

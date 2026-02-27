const { Router } = require('express');
const router = Router();

// GET /api/demo-tests — judge test suite with expected intents + urgency
router.get('/', (req, res) => {
  res.json([
    // ── Small talk (must NEVER trigger triage) ──────────────────────
    { id: 1, input: 'hello', language: 'en', expectedIntent: 'SMALL_TALK', expectedUrgency: null, note: 'Greeting must not trigger triage' },
    { id: 2, input: 'hi', language: 'en', expectedIntent: 'SMALL_TALK', expectedUrgency: null, note: 'Greeting' },
    { id: 3, input: 'thanks', language: 'en', expectedIntent: 'SMALL_TALK', expectedUrgency: null, note: 'Thanks must not trigger triage' },
    { id: 4, input: 'ok', language: 'en', expectedIntent: 'SMALL_TALK', expectedUrgency: null, note: 'Acknowledgement' },
    { id: 5, input: 'नमस्ते', language: 'hi', expectedIntent: 'SMALL_TALK', expectedUrgency: null, note: 'Hindi greeting' },
    { id: 6, input: 'నమస్తే', language: 'te', expectedIntent: 'SMALL_TALK', expectedUrgency: null, note: 'Telugu greeting' },
    { id: 7, input: 'வணக்கம்', language: 'ta', expectedIntent: 'SMALL_TALK', expectedUrgency: null, note: 'Tamil greeting' },
    { id: 8, input: 'नमस्कार', language: 'mr', expectedIntent: 'SMALL_TALK', expectedUrgency: null, note: 'Marathi greeting' },

    // ── Clarification required ──────────────────────────────────────
    { id: 9, input: 'not feeling well', language: 'en', expectedIntent: 'CLARIFICATION_REQUIRED', expectedUrgency: null, note: 'Vague — must ask for symptom' },
    { id: 10, input: 'I am sick', language: 'en', expectedIntent: 'CLARIFICATION_REQUIRED', expectedUrgency: null, note: 'Vague health complaint' },
    { id: 11, input: 'help', language: 'en', expectedIntent: 'CLARIFICATION_REQUIRED', expectedUrgency: null, note: 'Single word help' },
    { id: 12, input: 'तबियत ठीक नहीं', language: 'hi', expectedIntent: 'CLARIFICATION_REQUIRED', expectedUrgency: null, note: 'Hindi vague complaint' },
    { id: 13, input: 'బాగా లేను', language: 'te', expectedIntent: 'CLARIFICATION_REQUIRED', expectedUrgency: null, note: 'Telugu vague complaint' },

    // ── Symptoms → MEDIUM/PHC ───────────────────────────────────────
    { id: 14, input: 'fever 2 days', language: 'en', expectedIntent: 'SYMPTOMS', expectedUrgency: 'MEDIUM', expectedCareLevel: 'PHC', note: 'Classic fever case' },
    { id: 15, input: 'I have had fever for 3 days with headache', language: 'en', expectedIntent: 'SYMPTOMS', expectedUrgency: 'MEDIUM', expectedCareLevel: 'PHC', note: 'Fever + headache' },
    { id: 16, input: 'loose motion for 3 days', language: 'en', expectedIntent: 'SYMPTOMS', expectedUrgency: 'MEDIUM', expectedCareLevel: 'PHC', note: 'Diarrhea 3 days' },
    { id: 17, input: '2 दिन से बुखार है', language: 'hi', expectedIntent: 'SYMPTOMS', expectedUrgency: 'MEDIUM', expectedCareLevel: 'PHC', note: 'Hindi fever 2 days' },
    { id: 18, input: '3 दिवसांपासून ताप आहे', language: 'mr', expectedIntent: 'SYMPTOMS', expectedUrgency: 'MEDIUM', expectedCareLevel: 'PHC', note: 'Marathi fever 3 days' },
    { id: 19, input: '2 நாட்களாக காய்ச்சல்', language: 'ta', expectedIntent: 'SYMPTOMS', expectedUrgency: 'MEDIUM', expectedCareLevel: 'PHC', note: 'Tamil fever 2 days' },
    { id: 20, input: '2 రోజులుగా జ్వరం మరియు తలనొప్పి', language: 'te', expectedIntent: 'SYMPTOMS', expectedUrgency: 'MEDIUM', expectedCareLevel: 'PHC', note: 'Telugu fever + headache' },

    // ── Symptoms → HIGH/EMERGENCY ───────────────────────────────────
    { id: 21, input: 'chest pain and difficulty breathing', language: 'en', expectedIntent: 'SYMPTOMS', expectedUrgency: 'HIGH', expectedCareLevel: 'EMERGENCY', note: 'Red flag — must be HIGH' },
    { id: 22, input: 'I fainted and had a seizure', language: 'en', expectedIntent: 'SYMPTOMS', expectedUrgency: 'HIGH', expectedCareLevel: 'EMERGENCY', note: 'Unconscious + seizure' },
    { id: 23, input: 'मेरी छाती में दर्द है और सांस लेने में तकलीफ है', language: 'hi', expectedIntent: 'SYMPTOMS', expectedUrgency: 'HIGH', expectedCareLevel: 'EMERGENCY', note: 'Hindi chest pain + breathlessness' },
    { id: 24, input: 'நெஞ்சு வலி மற்றும் மூச்சு திணறல்', language: 'ta', expectedIntent: 'SYMPTOMS', expectedUrgency: 'HIGH', expectedCareLevel: 'EMERGENCY', note: 'Tamil chest pain + breathlessness' },
    { id: 25, input: 'ఛాతీ నొప్పి మరియు ఊపిరి ఆడటం కష్టం', language: 'te', expectedIntent: 'SYMPTOMS', expectedUrgency: 'HIGH', expectedCareLevel: 'EMERGENCY', note: 'Telugu chest pain + breathlessness' },
    { id: 26, input: 'snake bite on my leg', language: 'en', expectedIntent: 'SYMPTOMS', expectedUrgency: 'HIGH', expectedCareLevel: 'EMERGENCY', note: 'Snake bite emergency' },

    // ── Symptoms → LOW/HOME ─────────────────────────────────────────
    { id: 27, input: 'mild cough since yesterday', language: 'en', expectedIntent: 'SYMPTOMS', expectedUrgency: 'LOW', expectedCareLevel: 'HOME', note: 'Mild short-duration cough' },
    { id: 28, input: 'slight cold today', language: 'en', expectedIntent: 'SYMPTOMS', expectedUrgency: 'LOW', expectedCareLevel: 'HOME', note: 'Mild cold today' },
  ]);
});

module.exports = router;

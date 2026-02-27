const { Router } = require('express');
const router = Router();

// GET /api/demo-scope-tests
router.get('/', (_req, res) => {
  res.json({
    description: 'ArogyaSaarthi Scope Classifier — Judge Demo Test Cases',
    endpoint: 'POST /api/chat',
    body: '{ "message": "<text>", "language": "en|hi|mr|ta|te" }',
    scopeValues: ['MEDICAL', 'NON_MEDICAL_SAFE', 'OUT_OF_SCOPE'],
    testCases: [
      // ── NON_MEDICAL_SAFE ────────────────────────────────────────────
      { id: 1,  input: 'hello',                                    language: 'en', expectedScope: 'NON_MEDICAL_SAFE', note: 'Greeting' },
      { id: 2,  input: 'what is the capital of India',             language: 'en', expectedScope: 'NON_MEDICAL_SAFE', note: 'General factual question' },
      { id: 3,  input: 'how are you',                              language: 'en', expectedScope: 'NON_MEDICAL_SAFE', note: 'Small talk' },
      { id: 4,  input: 'what is 2 + 2',                            language: 'en', expectedScope: 'NON_MEDICAL_SAFE', note: 'Math question' },
      { id: 5,  input: 'tell me a joke',                           language: 'en', expectedScope: 'NON_MEDICAL_SAFE', note: 'Fun request' },
      { id: 6,  input: 'नमस्ते',                                   language: 'hi', expectedScope: 'NON_MEDICAL_SAFE', note: 'Hindi greeting' },
      { id: 7,  input: 'what is the weather today',                language: 'en', expectedScope: 'NON_MEDICAL_SAFE', note: 'General question' },

      // ── MEDICAL ─────────────────────────────────────────────────────
      { id: 8,  input: 'fever 2 days',                             language: 'en', expectedScope: 'MEDICAL', note: 'Classic symptom' },
      { id: 9,  input: 'chest pain and difficulty breathing',      language: 'en', expectedScope: 'MEDICAL', note: 'Red flag emergency' },
      { id: 10, input: 'clinic near pimpri pune',                  language: 'en', expectedScope: 'MEDICAL', note: 'Facility search' },
      { id: 11, input: 'book appointment at PHC',                  language: 'en', expectedScope: 'MEDICAL', note: 'Booking intent' },
      { id: 12, input: 'loose motion for 3 days',                  language: 'en', expectedScope: 'MEDICAL', note: 'Symptom with duration' },
      { id: 13, input: '2 दिन से बुखार है',                        language: 'hi', expectedScope: 'MEDICAL', note: 'Hindi symptom' },
      { id: 14, input: 'nearest hospital emergency',               language: 'en', expectedScope: 'MEDICAL', note: 'Emergency facility' },
      { id: 15, input: 'home care for cold',                       language: 'en', expectedScope: 'MEDICAL', note: 'Home care query' },
      { id: 16, input: 'snake bite on my leg',                     language: 'en', expectedScope: 'MEDICAL', note: 'Emergency red flag' },
      { id: 17, input: 'నెఞ్చు నొప్పి మరియు ఊపిరి ఆడటం కష్టం',  language: 'te', expectedScope: 'MEDICAL', note: 'Telugu chest pain' },

      // ── OUT_OF_SCOPE ─────────────────────────────────────────────────
      { id: 18, input: 'which medicine should I take for fever',   language: 'en', expectedScope: 'OUT_OF_SCOPE', note: 'Drug recommendation — redirect' },
      { id: 19, input: 'diagnose me',                              language: 'en', expectedScope: 'OUT_OF_SCOPE', note: 'Diagnosis request — redirect' },
      { id: 20, input: 'what drug cures diabetes',                 language: 'en', expectedScope: 'OUT_OF_SCOPE', note: 'Drug query — redirect' },
      { id: 21, input: 'give me a prescription',                   language: 'en', expectedScope: 'OUT_OF_SCOPE', note: 'Prescription request — redirect' },
      { id: 22, input: 'is paracetamol safe for me',               language: 'en', expectedScope: 'OUT_OF_SCOPE', note: 'Medication safety — redirect' },
      { id: 23, input: 'what is the stock price of Reliance',      language: 'en', expectedScope: 'OUT_OF_SCOPE', note: 'Finance — out of scope' },
      { id: 24, input: 'write me a poem',                          language: 'en', expectedScope: 'OUT_OF_SCOPE', note: 'Creative writing — out of scope' },
    ],
    expectedResponseShape: {
      scope: 'MEDICAL | NON_MEDICAL_SAFE | OUT_OF_SCOPE',
      intent: 'SYMPTOMS | SMALL_TALK | CLARIFICATION_REQUIRED',
      reply: 'string',
      triageCard: 'object or null',
      facilities: 'array',
      booking: 'null (future)',
      meta: { llmUsed: true, fallbackUsed: false, latencyMs: 120 },
    },
  });
});

module.exports = router;

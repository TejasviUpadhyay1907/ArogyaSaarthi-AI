require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getDb } = require('./db/sqlite');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize DB on startup
getDb();

// Routes
app.use('/api/session', require('./routes/session'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/chat/action', require('./routes/chat_action'));
app.use('/api/triage', require('./routes/triage'));
app.use('/api/doctors', require('./routes/doctors'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/facilities', require('./routes/facilities'));
app.use('/api/facilities/nearby', require('./routes/facilities_live'));
app.use('/api/metrics', require('./routes/metrics'));
app.use('/api/demo', require('./routes/demo'));
app.use('/api/demo-tests', require('./routes/demo_tests'));
app.use('/api/demo-symptom-checker', require('./routes/demo_symptom_checker'));
app.use('/api/demo-scope-tests', require('./routes/demo_scope_tests'));
app.use('/api/symptom-checker', require('./routes/symptom_checker'));

// Legacy routes (frontend currently calls /triage and /metrics without /api prefix)
app.post('/triage', async (req, res) => {
  const { text, language = 'en' } = req.body;
  // Forward to the triage handler
  req.body = { text, language, source: 'text' };
  const triageRouter = require('./routes/triage');
  // Use the same logic
  const { callAIEngine, localFallbackTriage } = require('./ai_bridge');
  const start = Date.now();
  try {
    const result = await callAIEngine(text, language, 'text');
    const latency = Date.now() - start;
    res.json({ ...result, meta: { ...result.meta, latencyMs: latency } });
  } catch {
    const fallback = localFallbackTriage(text, language);
    const latency = Date.now() - start;
    res.json({ ...fallback, meta: { llmUsed: false, latencyMs: latency, fallback: true } });
  }
});

app.get('/metrics', (req, res) => {
  const db = getDb();
  const totalSessions = db.prepare('SELECT COUNT(*) as c FROM sessions').get().c;
  const triageCalls = db.prepare('SELECT COUNT(*) as c FROM triage_logs').get().c;
  const urgencyCounts = db.prepare('SELECT urgency, COUNT(*) as c FROM triage_logs GROUP BY urgency').all();
  const counts = { LOW: 0, MEDIUM: 0, HIGH: 0 };
  for (const row of urgencyCounts) counts[row.urgency] = row.c;
  const llmUsed = db.prepare('SELECT COUNT(*) as c FROM triage_logs WHERE llm_used = 1').get().c;
  const avgLatency = db.prepare('SELECT AVG(latency_ms) as avg FROM triage_logs').get().avg || 0;
  res.json({
    total_sessions: totalSessions, triage_calls: triageCalls,
    low_count: counts.LOW, medium_count: counts.MEDIUM, high_count: counts.HIGH,
    llm_used_count: llmUsed, fallback_used_count: triageCalls - llmUsed,
    avg_latency_ms: Math.round(avgLatency),
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'backend', port: PORT });
});

// Judge demo flow endpoint
app.get('/api/demo-judge-flow', (req, res) => {
  res.json({
    description: 'Scripted judge test flow for ArogyaSaarthi',
    flows: [
      {
        step: 1, input: 'hello',
        expectedAction: 'SMALL_TALK', expectedTriageCard: null,
        note: 'Greeting must never trigger triage or return a triageCard',
      },
      {
        step: 2, input: 'fever from 2 days',
        expectedAction: 'TRIAGE', expectedUrgency: 'MEDIUM', expectedCareLevel: 'PHC',
        expectedNextStep: 'ASK_LOCATION',
        note: 'MEDIUM urgency → triageCard shown, location asked before facilities',
      },
      {
        step: 3, input: 'pimpri gurav pune',
        expectedAction: 'LOCATION_PROVIDED',
        note: 'Location stored, top 3 PHC facilities returned from DB',
      },
      {
        step: 4, input: 'these are far',
        expectedAction: 'REFINE_LOCATION',
        note: 'Asks for updated area/pincode, never asks symptoms again',
      },
      {
        step: 5, input: 'book appointment',
        expectedAction: 'SHOW_DOCTORS',
        note: 'Returns doctors list from DB filtered by careLevel',
      },
      {
        step: 6, input: 'chest pain and breathlessness',
        expectedAction: 'TRIAGE', expectedUrgency: 'HIGH', expectedCareLevel: 'EMERGENCY',
        note: 'HIGH urgency → CALL_108 primary action, emergency facilities',
      },
      {
        step: 7, input: 'mild cough since morning',
        expectedAction: 'TRIAGE', expectedUrgency: 'LOW', expectedCareLevel: 'HOME',
        note: 'LOW urgency → HOME_TIPS primary action, no location asked',
      },
      {
        step: 8, input: 'which medicine for fever',
        expectedAction: 'OUT_OF_SCOPE',
        note: 'Drug/prescription request → redirect, no Gemini, no triage',
      },
      {
        step: 9, input: 'what is the capital of India',
        expectedAction: 'NON_MEDICAL_SAFE',
        note: 'General question → Gemini answers briefly + redirect nudge',
      },
      {
        step: 10, input: 'बुखार है 3 दिन से',
        expectedAction: 'TRIAGE', expectedLanguage: 'hi',
        note: 'Hindi input → Hindi triageCard labels and reply',
      },
    ],
    actionEndpoint: 'POST /api/chat/action',
    actionIds: ['CALL_108', 'ASK_LOCATION', 'FIND_FACILITY', 'SHOW_DOCTORS', 'SHOW_SLOTS', 'BOOK_APPOINTMENT', 'HOME_TIPS'],
  });
});

app.listen(PORT, () => {
  console.log(`[ArogyaSaarthi] Backend running on http://localhost:${PORT}`);
  console.log(`[ArogyaSaarthi] AI Engine expected at ${process.env.AI_ENGINE_URL || 'http://localhost:8000'}`);
});

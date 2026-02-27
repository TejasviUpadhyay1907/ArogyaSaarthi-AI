require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const { getDb }  = require('./db/sqlite');
const { requireAuth } = require('./middleware/auth');

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Initialize DB on startup
getDb();

// ── Rate limiters ─────────────────────────────────────────────────────────
// Global: 200 req / 15 min per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// AI routes: stricter — 60 req / 15 min per IP
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.uid || req.ip, // per-uid when authenticated
  message: { error: 'AI rate limit exceeded. Please wait before sending more requests.' },
});

app.use(globalLimiter);

// ── Public routes (no auth required) ─────────────────────────────────────
app.use('/api/session',  require('./routes/session'));
app.use('/api/metrics',  require('./routes/metrics'));
app.use('/api/demo',     require('./routes/demo'));
app.use('/api/demo-tests',           require('./routes/demo_tests'));
app.use('/api/demo-symptom-checker', require('./routes/demo_symptom_checker'));
app.use('/api/demo-scope-tests',     require('./routes/demo_scope_tests'));

// ── Protected AI routes (require valid Firebase ID token) ─────────────────
app.use('/api/chat',            aiLimiter, requireAuth, require('./routes/chat'));
app.use('/api/chat/action',     aiLimiter, requireAuth, require('./routes/chat_action'));
app.use('/api/triage',          aiLimiter, requireAuth, require('./routes/triage'));
app.use('/api/symptom-checker', aiLimiter, requireAuth, require('./routes/symptom_checker'));

// ── Protected data routes ─────────────────────────────────────────────────
app.use('/api/doctors',       requireAuth, require('./routes/doctors'));
app.use('/api/appointments',  requireAuth, require('./routes/appointments'));
app.use('/api/facilities',    requireAuth, require('./routes/facilities'));
app.use('/api/facilities/nearby', requireAuth, require('./routes/facilities_live'));

// ── Legacy routes (kept for backward compat, now also protected) ──────────
app.post('/triage', requireAuth, async (req, res) => {
  const { text, language = 'en' } = req.body;
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
  const triageCalls   = db.prepare('SELECT COUNT(*) as c FROM triage_logs').get().c;
  const urgencyCounts = db.prepare('SELECT urgency, COUNT(*) as c FROM triage_logs GROUP BY urgency').all();
  const counts = { LOW: 0, MEDIUM: 0, HIGH: 0 };
  for (const row of urgencyCounts) counts[row.urgency] = row.c;
  const llmUsed    = db.prepare('SELECT COUNT(*) as c FROM triage_logs WHERE llm_used = 1').get().c;
  const avgLatency = db.prepare('SELECT AVG(latency_ms) as avg FROM triage_logs').get().avg || 0;
  res.json({
    total_sessions: totalSessions, triage_calls: triageCalls,
    low_count: counts.LOW, medium_count: counts.MEDIUM, high_count: counts.HIGH,
    llm_used_count: llmUsed, fallback_used_count: triageCalls - llmUsed,
    avg_latency_ms: Math.round(avgLatency),
  });
});

// ── Health check (public) ─────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'backend', port: PORT });
});

// ── Judge demo flow (public — for hackathon judges) ───────────────────────
app.get('/api/demo-judge-flow', (req, res) => {
  res.json({
    description: 'Scripted judge test flow for ArogyaSaarthi',
    note: 'Protected endpoints require Authorization: Bearer <FIREBASE_ID_TOKEN>',
    flows: [
      { step: 1, input: 'hello', expectedAction: 'SMALL_TALK' },
      { step: 2, input: 'fever from 2 days', expectedAction: 'TRIAGE', expectedUrgency: 'MEDIUM' },
      { step: 3, input: 'pimpri gurav pune', expectedAction: 'LOCATION_PROVIDED' },
      { step: 4, input: 'these are far', expectedAction: 'REFINE_LOCATION' },
      { step: 5, input: 'book appointment', expectedAction: 'SHOW_DOCTORS' },
      { step: 6, input: 'chest pain and breathlessness', expectedAction: 'TRIAGE', expectedUrgency: 'HIGH' },
      { step: 7, input: 'mild cough since morning', expectedAction: 'TRIAGE', expectedUrgency: 'LOW' },
      { step: 8, input: 'which medicine for fever', expectedAction: 'OUT_OF_SCOPE' },
      { step: 9, input: 'what is the capital of India', expectedAction: 'NON_MEDICAL_SAFE' },
      { step: 10, input: 'बुखार है 3 दिन से', expectedAction: 'TRIAGE', expectedLanguage: 'hi' },
    ],
    actionEndpoint: 'POST /api/chat/action',
  });
});

app.listen(PORT, () => {
  console.log(`[ArogyaSaarthi] Backend running on http://localhost:${PORT}`);
  console.log(`[ArogyaSaarthi] AI Engine expected at ${process.env.AI_ENGINE_URL || 'http://localhost:8000'}`);
  console.log(`[ArogyaSaarthi] Auth: Firebase Admin SDK active`);
});

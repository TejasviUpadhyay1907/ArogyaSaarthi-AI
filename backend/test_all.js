/**
 * ArogyaSaarthi — Self-contained integration test.
 * Starts the server, runs all endpoint tests, then exits.
 * Run: node test_all.js
 */
require('dotenv').config();
process.env.DATABASE_FILE = './db/test_arogya.db';

const express = require('express');
const cors = require('cors');
const http = require('http');
const { getDb } = require('./db/sqlite');

// ── Boot server ────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());
getDb();

app.use('/api/session', require('./routes/session'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/triage', require('./routes/triage'));
app.use('/api/doctors', require('./routes/doctors'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/facilities', require('./routes/facilities'));
app.use('/api/metrics', require('./routes/metrics'));
app.use('/api/demo', require('./routes/demo'));

// Legacy routes
const { callAIEngine, localFallbackTriage } = require('./ai_bridge');
app.post('/triage', async (req, res) => {
  const { text, language = 'en' } = req.body;
  try {
    const r = await callAIEngine(text, language, 'text');
    res.json(r);
  } catch {
    res.json(localFallbackTriage(text, language));
  }
});
app.get('/metrics', (req, res) => {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) as c FROM sessions').get().c;
  const calls = db.prepare('SELECT COUNT(*) as c FROM triage_logs').get().c;
  const rows = db.prepare('SELECT urgency, COUNT(*) as c FROM triage_logs GROUP BY urgency').all();
  const counts = { LOW: 0, MEDIUM: 0, HIGH: 0 };
  rows.forEach(r => { counts[r.urgency] = r.c; });
  const avg = db.prepare('SELECT AVG(latency_ms) as a FROM triage_logs').get().a || 0;
  res.json({ total_sessions: total, triage_calls: calls, ...counts, avg_latency_ms: Math.round(avg) });
});
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = 4099; // test port
const server = http.createServer(app);

// ── HTTP helpers ───────────────────────────────────────────────────────────
function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: PORT, path, method,
      headers: { 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) },
    };
    const r = http.request(opts, res => {
      let b = ''; res.on('data', d => b += d);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(b) }); } catch { resolve({ status: res.statusCode, body: b }); } });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}
const post = (path, body) => req('POST', path, body);
const get  = (path)       => req('GET',  path);

// ── Test runner ────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
function check(name, condition, detail = '') {
  if (condition) { console.log(`  ✅ ${name}${detail ? ' — ' + detail : ''}`); pass++; }
  else           { console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); fail++; }
}

async function runTests() {
  console.log('\n🧪 ArogyaSaarthi API Integration Tests\n');

  // 1. Health
  const h = await get('/health');
  check('GET /health', h.body.status === 'ok');

  // 2. Session start
  const s = await post('/api/session/start', { language: 'en' });
  check('POST /api/session/start', !!s.body.sessionId, s.body.sessionId);
  const sid = s.body.sessionId;

  // 3. Session get (empty)
  const sg = await get(`/api/session/${sid}`);
  check('GET /api/session/:id', sg.body.sessionId === sid);

  // 4. Triage HIGH — chest pain + breathing
  const t1 = await post('/api/triage', { sessionId: sid, text: 'chest pain and difficulty breathing', language: 'en', source: 'text' });
  check('POST /api/triage HIGH (en)', t1.body.urgency === 'HIGH', `urgency=${t1.body.urgency} care=${t1.body.careLevel}`);
  check('Triage has disclaimer', !!t1.body.disclaimer);
  check('Triage has actions', Array.isArray(t1.body.actions) && t1.body.actions.length > 0);
  check('Triage has urgencyBadge', !!t1.body.urgencyBadge?.color);

  // 5. Triage MEDIUM — fever 3 days
  const t2 = await post('/api/triage', { sessionId: sid, text: 'fever for 3 days with headache', language: 'en', source: 'text' });
  check('POST /api/triage MEDIUM (en)', t2.body.urgency === 'MEDIUM', `urgency=${t2.body.urgency} care=${t2.body.careLevel}`);

  // 6. Triage LOW — mild cough
  const t3 = await post('/api/triage', { sessionId: sid, text: 'mild cough since yesterday', language: 'en', source: 'text' });
  check('POST /api/triage LOW (en)', t3.body.urgency === 'LOW', `urgency=${t3.body.urgency} care=${t3.body.careLevel}`);

  // 7. Hindi triage
  const t4 = await post('/api/triage', { sessionId: sid, text: '2 din se bukhar hai aur sir dard', language: 'hi', source: 'voice' });
  check('POST /api/triage Hindi (voice)', ['MEDIUM','HIGH'].includes(t4.body.urgency), `urgency=${t4.body.urgency}`);
  check('Hindi disclaimer present', t4.body.disclaimer?.includes('108'));

  // 8. Telugu triage HIGH
  const t5 = await post('/api/triage', { text: 'ఛాతీ నొప్పి మరియు ఊపిరి ఆడటం కష్టం', language: 'te', source: 'voice' });
  check('POST /api/triage Telugu HIGH', t5.body.urgency === 'HIGH', `urgency=${t5.body.urgency}`);

  // 9. Marathi triage
  const t6 = await post('/api/triage', { text: 'छातीत दुखतेय आणि श्वास घेण्यास त्रास', language: 'mr', source: 'text' });
  check('POST /api/triage Marathi HIGH', t6.body.urgency === 'HIGH', `urgency=${t6.body.urgency}`);

  // 10. Tamil triage
  const t7 = await post('/api/triage', { text: '2 நாட்களாக காய்ச்சல்', language: 'ta', source: 'text' });
  check('POST /api/triage Tamil MEDIUM', ['MEDIUM','HIGH'].includes(t7.body.urgency), `urgency=${t7.body.urgency}`);

  // 11. Chat
  const c1 = await post('/api/chat', { sessionId: sid, message: 'I have chest pain', language: 'en', source: 'text' });
  check('POST /api/chat reply', !!c1.body.reply);
  check('POST /api/chat triage embedded', !!c1.body.triage?.urgency);
  check('POST /api/chat meta', c1.body.meta?.llmUsed === false);

  // 12. Chat Hindi
  const c2 = await post('/api/chat', { sessionId: sid, message: 'bukhar hai 2 din se', language: 'hi', source: 'voice' });
  check('POST /api/chat Hindi', !!c2.body.reply);

  // 13. Session updated after triage
  const sg2 = await get(`/api/session/${sid}`);
  check('Session triageCount updated', sg2.body.triageCount > 0, `count=${sg2.body.triageCount}`);
  check('Session lastUrgency set', !!sg2.body.lastUrgency);

  // 14. Doctors list
  const d1 = await get('/api/doctors?facility=PHC&lang=en');
  check('GET /api/doctors PHC', d1.body.doctors?.length > 0, `count=${d1.body.doctors?.length}`);

  const d2 = await get('/api/doctors?lang=hi');
  check('GET /api/doctors Hindi names', d2.body.doctors?.[0]?.name?.includes('डॉ'), `name=${d2.body.doctors?.[0]?.name}`);

  // 15. Slots
  const today = new Date().toISOString().split('T')[0];
  const sl = await get(`/api/doctors/1/slots?date=${today}`);
  check('GET /api/doctors/1/slots', sl.body.slots?.length > 0, `slots=${sl.body.slots?.length}`);

  // 16. Book appointment
  const slotId = sl.body.slots?.[0]?.id;
  const a1 = await post('/api/appointments/book', { sessionId: sid, doctorId: 1, slotId, patientAlias: 'USER', reason: 'fever', language: 'en' });
  check('POST /api/appointments/book', a1.body.status === 'CONFIRMED', `id=${a1.body.appointmentId}`);
  check('Appointment has doctor info', !!a1.body.doctor?.name);
  check('Appointment has slot info', !!a1.body.slot?.time);

  // 17. Double booking prevention
  const a2 = await post('/api/appointments/book', { sessionId: sid, doctorId: 1, slotId, patientAlias: 'USER2', reason: 'test', language: 'en' });
  check('Double booking blocked (409)', a2.status === 409 && !!a2.body.error, `status=${a2.status}`);

  // 18. Facilities
  const f1 = await get('/api/facilities?district=Pune&type=PHC&lang=en');
  check('GET /api/facilities PHC', f1.body.facilities?.length > 0, `count=${f1.body.facilities?.length}`);
  check('Facility has distanceKm', f1.body.facilities?.[0]?.distanceKm !== undefined);

  const f2 = await get('/api/facilities?type=DISTRICT_HOSPITAL&lang=hi');
  check('GET /api/facilities District Hindi', f2.body.facilities?.length > 0, `name=${f2.body.facilities?.[0]?.name}`);

  // 19. Metrics
  const m = await get('/api/metrics');
  check('GET /api/metrics triage_calls', m.body.triage_calls > 0, JSON.stringify(m.body));

  // 20. Demo
  const demo = await get('/api/demo');
  check('GET /api/demo phrases', demo.body.phrases?.length >= 10, `count=${demo.body.phrases?.length}`);

  // 21. Legacy /triage
  const lt = await post('/triage', { text: 'fever for 2 days', language: 'en' });
  check('Legacy POST /triage', !!lt.body.urgency, `urgency=${lt.body.urgency}`);

  // 22. Legacy /metrics
  const lm = await get('/metrics');
  check('Legacy GET /metrics', lm.body.total_sessions !== undefined);

  // 23. Safety — no diagnosis in explanation
  const safe = await post('/api/triage', { text: 'fever for 2 days', language: 'en', source: 'text' });
  const hasDiagnosis = /\byou have\b|\bdiagnos|\bpneumonia\b|\bmalaria\b/i.test(safe.body.explanation || '');
  check('Safety: no diagnosis in explanation', !hasDiagnosis, `explanation="${safe.body.explanation?.slice(0,60)}..."`);

  // 24. Seizure -> HIGH
  const t8 = await post('/api/triage', { text: 'patient had a seizure and is unconscious', language: 'en', source: 'text' });
  check('Seizure/unconscious -> HIGH', t8.body.urgency === 'HIGH', `urgency=${t8.body.urgency}`);

  // 25. Snake bite -> HIGH
  const t9 = await post('/api/triage', { text: 'snake bite on leg', language: 'en', source: 'text' });
  check('Snake bite -> HIGH', t9.body.urgency === 'HIGH', `urgency=${t9.body.urgency}`);

  // Summary
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${pass} passed, ${fail} failed out of ${pass + fail} tests`);
  if (fail === 0) console.log('🎉 All tests passed!');
  else console.log(`⚠️  ${fail} test(s) failed`);
}

server.listen(PORT, async () => {
  try {
    await runTests();
  } catch (e) {
    console.error('Fatal test error:', e);
  } finally {
    server.close();
    // Clean up test DB
    const fs = require('fs');
    try { fs.unlinkSync('./db/test_arogya.db'); } catch {}
    process.exit(fail > 0 ? 1 : 0);
  }
});

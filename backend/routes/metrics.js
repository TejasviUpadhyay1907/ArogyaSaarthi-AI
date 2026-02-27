const { Router } = require('express');
const { getDb } = require('../db/sqlite');

const router = Router();

// GET /api/metrics
router.get('/', (req, res) => {
  const db = getDb();

  const totalSessions = db.prepare('SELECT COUNT(*) as c FROM sessions').get().c;
  const triageCalls = db.prepare('SELECT COUNT(*) as c FROM triage_logs').get().c;

  const urgencyCounts = db.prepare(`
    SELECT urgency, COUNT(*) as c FROM triage_logs GROUP BY urgency
  `).all();

  const counts = { LOW: 0, MEDIUM: 0, HIGH: 0 };
  for (const row of urgencyCounts) {
    counts[row.urgency] = row.c;
  }

  const llmUsed = db.prepare('SELECT COUNT(*) as c FROM triage_logs WHERE llm_used = 1').get().c;
  const fallbackUsed = db.prepare('SELECT COUNT(*) as c FROM triage_logs WHERE fallback_used = 1').get().c;

  const avgLatency = db.prepare('SELECT AVG(latency_ms) as avg FROM triage_logs').get().avg || 0;

  res.json({
    total_sessions: totalSessions,
    triage_calls: triageCalls,
    low_count: counts.LOW,
    medium_count: counts.MEDIUM,
    high_count: counts.HIGH,
    llm_used_count: llmUsed,
    fallback_used_count: fallbackUsed,
    avg_latency_ms: Math.round(avgLatency),
  });
});

module.exports = router;

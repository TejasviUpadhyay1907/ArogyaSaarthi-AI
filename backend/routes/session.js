const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/sqlite');

const router = Router();

// POST /api/session/start
router.post('/start', (req, res) => {
  const db = getDb();
  const sessionId = uuidv4();
  const language = req.body.language || 'en';

  db.prepare('INSERT INTO sessions (id, language) VALUES (?, ?)').run(sessionId, language);

  res.json({ sessionId });
});

// GET /api/session/:sessionId
router.get('/:sessionId', (req, res) => {
  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json({
    sessionId: session.id,
    language: session.language,
    triageCount: session.triage_count,
    clarifyCount: session.clarify_count,
    lastUrgency: session.last_urgency,
    lastCareLevel: session.last_care_level,
    createdAt: session.created_at,
    lastActive: session.last_active,
  });
});

module.exports = router;

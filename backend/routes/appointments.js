const { Router } = require('express');
const { getDb } = require('../db/sqlite');

const router = Router();

// POST /api/appointments/book
router.post('/book', (req, res) => {
  const db = getDb();
  const { sessionId, doctorId, slotId, patientAlias = 'USER', reason = '', language = 'en' } = req.body;

  if (!doctorId || !slotId) {
    return res.status(400).json({ error: 'doctorId and slotId are required' });
  }

  // Check slot availability (prevent double booking)
  const slot = db.prepare('SELECT * FROM slots WHERE id = ? AND is_available = 1').get(slotId);
  if (!slot) {
    return res.status(409).json({ error: 'Slot is no longer available' });
  }

  // Check doctor exists
  const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(doctorId);
  if (!doctor) {
    return res.status(404).json({ error: 'Doctor not found' });
  }

  // Book: mark slot unavailable + create appointment
  const txn = db.transaction(() => {
    db.prepare('UPDATE slots SET is_available = 0 WHERE id = ?').run(slotId);
    const result = db.prepare(
      'INSERT INTO appointments (session_id, doctor_id, slot_id, patient_alias, reason, language) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(sessionId || null, doctorId, slotId, patientAlias, reason, language);
    return result.lastInsertRowid;
  });

  const appointmentId = txn();

  const lang = language || 'en';
  res.json({
    appointmentId,
    status: 'CONFIRMED',
    doctor: {
      id: doctor.id,
      name: doctor[`name_${lang}`] || doctor.name_en,
      specialization: doctor[`specialization_${lang}`] || doctor.specialization_en,
    },
    slot: {
      id: slot.id,
      date: slot.slot_date,
      time: slot.slot_time,
    },
  });
});

module.exports = router;

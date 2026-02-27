const { Router } = require('express');
const { getDb } = require('../db/sqlite');

const router = Router();

// GET /api/doctors?facility=PHC&lang=en
router.get('/', (req, res) => {
  const db = getDb();
  const { facility, lang = 'en' } = req.query;

  let query = 'SELECT * FROM doctors WHERE active = 1';
  const params = [];
  if (facility) {
    query += ' AND facility_type = ?';
    params.push(facility);
  }

  const rows = db.prepare(query).all(...params);
  const doctors = rows.map(r => formatDoctor(r, lang));
  res.json({ doctors });
});

// GET /api/doctors/:id/slots?date=YYYY-MM-DD
router.get('/:id/slots', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { date } = req.query;

  let query = 'SELECT * FROM slots WHERE doctor_id = ? AND is_available = 1';
  const params = [id];
  if (date) {
    query += ' AND slot_date = ?';
    params.push(date);
  }
  query += ' ORDER BY slot_date, slot_time';

  const slots = db.prepare(query).all(...params);
  res.json({ slots });
});

function formatDoctor(row, lang) {
  return {
    id: row.id,
    name: row[`name_${lang}`] || row.name_en,
    specialization: row[`specialization_${lang}`] || row.specialization_en,
    facilityType: row.facility_type,
    rating: row.rating,
    experienceYears: row.experience_years,
  };
}

module.exports = router;

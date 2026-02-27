const { Router } = require('express');
const { getDb } = require('../db/sqlite');

const router = Router();

// GET /api/facilities?district=Pune&type=PHC&lang=en
router.get('/', (req, res) => {
  const db = getDb();
  const { district, type, lang = 'en' } = req.query;

  let query = 'SELECT * FROM facilities WHERE active = 1';
  const params = [];

  if (district) {
    query += ' AND district = ?';
    params.push(district);
  }
  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }

  query += ' ORDER BY distance_km ASC';

  const rows = db.prepare(query).all(...params);
  const facilities = rows.map(r => ({
    id: r.id,
    name: r[`name_${lang}`] || r.name_en,
    type: r.type,
    district: r.district,
    address: r[`address_${lang}`] || r.address_en || r.address_en,
    phone: r.phone,
    distanceKm: r.distance_km,
    latitude: r.latitude,
    longitude: r.longitude,
  }));

  res.json({ facilities });
});

module.exports = router;

// GET /api/facilities/suggested?careLevel=PHC&locationText=pune&language=en
router.get('/suggested', (req, res) => {
  const db = getDb();
  const { careLevel = 'PHC', locationText, language = 'en' } = req.query;
  const lang = ['en', 'hi', 'mr', 'ta', 'te'].includes(language) ? language : 'en';

  const typeMap = {
    HOME: [], PHC: ['PHC'], CHC: ['CHC', 'PHC'],
    DISTRICT_HOSPITAL: ['DISTRICT_HOSPITAL', 'CHC'], EMERGENCY: ['DISTRICT_HOSPITAL'],
  };
  const types = typeMap[careLevel] || ['PHC'];
  if (types.length === 0) return res.json({ facilities: [] });

  const nameCol = `name_${lang}`;
  const addrCol = `address_${lang}`;
  const ph = types.map(() => '?').join(',');

  let q = `SELECT id, COALESCE(${nameCol}, name_en) as name, type, district,
                  COALESCE(${addrCol}, address_en) as address, phone, distance_km
           FROM facilities WHERE type IN (${ph}) AND active=1`;
  const params = [...types];

  if (locationText) {
    q += ` AND (district LIKE ? OR COALESCE(${addrCol}, address_en) LIKE ?)`;
    params.push(`%${locationText}%`, `%${locationText}%`);
  }
  q += ' ORDER BY distance_km ASC LIMIT 3';

  let rows = db.prepare(q).all(...params);
  // fallback: ignore location filter if no results
  if (rows.length === 0 && locationText) {
    rows = db.prepare(
      `SELECT id, COALESCE(${nameCol}, name_en) as name, type, district,
              COALESCE(${addrCol}, address_en) as address, phone, distance_km
       FROM facilities WHERE type IN (${ph}) AND active=1 ORDER BY distance_km ASC LIMIT 3`
    ).all(...types);
  }

  const facilities = rows.map(r => ({
    id: r.id, name: r.name, type: r.type, district: r.district,
    address: r.address, phone: r.phone, distanceKm: r.distance_km,
    hours: r.type === 'DISTRICT_HOSPITAL' ? '24 hours' : '9am – 5pm',
  }));

  res.json({ facilities });
});

module.exports = router;

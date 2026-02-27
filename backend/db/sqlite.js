const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DATABASE_FILE || path.join(__dirname, 'arogya.db');

let db;

function getDb() {
  if (db) return db;

  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Run schema
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  // Migration: add fallback_used column if missing (for existing DBs)
  const cols = db.prepare("PRAGMA table_info(triage_logs)").all().map(c => c.name);
  if (!cols.includes('fallback_used')) {
    db.exec('ALTER TABLE triage_logs ADD COLUMN fallback_used INTEGER DEFAULT 0');
    console.log('[DB] Migrated: added fallback_used column to triage_logs');
  }

  // Migration: add session memory columns if missing
  const sCols = db.prepare("PRAGMA table_info(sessions)").all().map(c => c.name);
  const sessionMigrations = [
    ['last_intent',           'ALTER TABLE sessions ADD COLUMN last_intent TEXT'],
    ['last_facility_type',    'ALTER TABLE sessions ADD COLUMN last_facility_type TEXT'],
    ['last_user_location',    'ALTER TABLE sessions ADD COLUMN last_user_location TEXT'],
    ['last_facility_results',      'ALTER TABLE sessions ADD COLUMN last_facility_results TEXT'],
    ['last_known_location_text',   'ALTER TABLE sessions ADD COLUMN last_known_location_text TEXT'],
    ['last_known_pincode',         'ALTER TABLE sessions ADD COLUMN last_known_pincode TEXT'],
    ['last_district',              'ALTER TABLE sessions ADD COLUMN last_district TEXT'],
    ['last_doctor_id',             'ALTER TABLE sessions ADD COLUMN last_doctor_id INTEGER'],
  ];
  for (const [col, sql] of sessionMigrations) {
    if (!sCols.includes(col)) {
      db.exec(sql);
      console.log(`[DB] Migrated: added ${col} column to sessions`);
    }
  }

  // Seed if doctors table is empty
  const count = db.prepare('SELECT COUNT(*) as c FROM doctors').get();
  if (count.c === 0) {
    const seed = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
    db.exec(seed);
    generateSlots(db);
    console.log('[DB] Seeded database with doctors, facilities, and slots');
  }

  return db;
}

function generateSlots(database) {
  const doctors = database.prepare('SELECT id FROM doctors').all();
  const times = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];
  const insert = database.prepare('INSERT INTO slots (doctor_id, slot_date, slot_time, is_available) VALUES (?, ?, ?, 1)');

  const today = new Date();
  const txn = database.transaction(() => {
    for (const doc of doctors) {
      for (let d = 0; d < 3; d++) {
        const date = new Date(today);
        date.setDate(date.getDate() + d);
        const dateStr = date.toISOString().split('T')[0];
        for (const time of times) {
          insert.run(doc.id, dateStr, time);
        }
      }
    }
  });
  txn();
}

module.exports = { getDb };

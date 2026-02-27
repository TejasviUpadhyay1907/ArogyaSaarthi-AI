-- ArogyaSaarthi SQLite Schema

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    language TEXT DEFAULT 'en',
    created_at TEXT DEFAULT (datetime('now')),
    last_active TEXT DEFAULT (datetime('now')),
    clarify_count INTEGER DEFAULT 0,
    last_urgency TEXT,
    last_care_level TEXT,
    triage_count INTEGER DEFAULT 0,
    last_intent TEXT,
    last_facility_type TEXT,
    last_user_location TEXT,
    last_facility_results TEXT,
    last_known_location_text TEXT,
    last_known_pincode TEXT,
    last_district TEXT,
    last_doctor_id INTEGER
);

CREATE TABLE IF NOT EXISTS triage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    timestamp TEXT DEFAULT (datetime('now')),
    language TEXT DEFAULT 'en',
    urgency TEXT NOT NULL,
    care_level TEXT NOT NULL,
    reason_codes TEXT,
    source TEXT DEFAULT 'text',
    llm_used INTEGER DEFAULT 0,
    fallback_used INTEGER DEFAULT 0,
    latency_ms INTEGER DEFAULT 0,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS doctors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en TEXT NOT NULL,
    name_hi TEXT,
    name_mr TEXT,
    name_ta TEXT,
    name_te TEXT,
    specialization_en TEXT NOT NULL,
    specialization_hi TEXT,
    specialization_mr TEXT,
    specialization_ta TEXT,
    specialization_te TEXT,
    facility_type TEXT DEFAULT 'PHC',
    rating REAL DEFAULT 4.5,
    experience_years INTEGER DEFAULT 5,
    active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doctor_id INTEGER NOT NULL,
    slot_date TEXT NOT NULL,
    slot_time TEXT NOT NULL,
    is_available INTEGER DEFAULT 1,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id)
);

CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    doctor_id INTEGER NOT NULL,
    slot_id INTEGER NOT NULL,
    patient_alias TEXT DEFAULT 'USER',
    reason TEXT,
    language TEXT DEFAULT 'en',
    status TEXT DEFAULT 'CONFIRMED',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (doctor_id) REFERENCES doctors(id),
    FOREIGN KEY (slot_id) REFERENCES slots(id)
);

CREATE TABLE IF NOT EXISTS facilities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_en TEXT NOT NULL,
    name_hi TEXT,
    name_mr TEXT,
    name_ta TEXT,
    name_te TEXT,
    type TEXT NOT NULL,
    district TEXT DEFAULT 'Pune',
    address_en TEXT,
    address_hi TEXT,
    phone TEXT,
    latitude REAL,
    longitude REAL,
    distance_km REAL DEFAULT 5.0,
    active INTEGER DEFAULT 1
);

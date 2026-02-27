# ArogyaSaarthi AI — Health Navigator Backend

> Voice-first rural healthcare navigation. Rules decide urgency. AI only helps understand and explain.

---

## Architecture

```
Browser (React PWA)
    │  POST /triage, /api/chat, /api/doctors, etc.
    ▼
Node.js + Express  (port 4000)   ← API Gateway + SQLite DB
    │  POST /extract, /classify, /explain
    ▼
Python FastAPI     (port 8000)   ← NLP extraction + deterministic rules + explanation
    │  (optional)
    ▼
LLM API (OpenAI/etc.)            ← Only if USE_LLM=true AND key present
```

**Safety boundary:** Urgency classification is always deterministic rule-based (Python `triage_rules.py`). LLM never decides urgency.

**Fallback:** If Python service is down, Node uses a local keyword-based fallback so the demo never breaks.

---

## Quick Start

### 1. Install dependencies

```bash
# Node backend
cd backend
npm install

# Python AI engine
cd ../ai_engine
pip install -r requirements.txt
```

### 2. Configure environment

```bash
# backend/.env  (copy from .env.example)
PORT=4000
AI_ENGINE_URL=http://localhost:8000
DATABASE_FILE=./db/arogya.db
NODE_ENV=development

# ai_engine/.env  (copy from .env.example)
PORT=8000
USE_LLM=false
LLM_API_KEY=
```

### 3. Start services

**Terminal 1 — Python AI Engine:**
```bash
cd ai_engine
python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 — Node Backend:**
```bash
cd backend
node server.js
```

**Terminal 3 — Frontend:**
```bash
cd frontend
npm run dev
```

The SQLite database is auto-created and seeded on first run (6 doctors, 8 facilities, slots for 3 days).

---

## API Reference

### Session
```bash
# Start session
curl -X POST http://localhost:4000/api/session/start \
  -H "Content-Type: application/json" \
  -d '{"language":"en"}'
# → {"sessionId":"uuid"}

# Get session
curl http://localhost:4000/api/session/<sessionId>
```

### Chat (AI Assistant page)
```bash
# English
curl -X POST http://localhost:4000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"<id>","message":"I have chest pain and difficulty breathing","language":"en","source":"text"}'

# Hindi (voice input — same endpoint, source=voice)
curl -X POST http://localhost:4000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"<id>","message":"2 din se bukhar hai aur saans lene mein takleef","language":"hi","source":"voice"}'

# Telugu
curl -X POST http://localhost:4000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"ఛాతీ నొప్పి మరియు ఊపిరి ఆడటం కష్టం","language":"te","source":"voice"}'
```

### Triage (Symptom Checker page)
```bash
# English — HIGH urgency
curl -X POST http://localhost:4000/api/triage \
  -H "Content-Type: application/json" \
  -d '{"text":"chest pain and difficulty breathing","language":"en","source":"text"}'

# Hindi — MEDIUM urgency
curl -X POST http://localhost:4000/api/triage \
  -H "Content-Type: application/json" \
  -d '{"text":"2 din se bukhar hai","language":"hi","source":"voice"}'

# Marathi — HIGH urgency
curl -X POST http://localhost:4000/api/triage \
  -H "Content-Type: application/json" \
  -d '{"text":"छातीत दुखतेय आणि श्वास घेण्यास त्रास","language":"mr","source":"text"}'

# Tamil — MEDIUM urgency
curl -X POST http://localhost:4000/api/triage \
  -H "Content-Type: application/json" \
  -d '{"text":"2 நாட்களாக காய்ச்சல்","language":"ta","source":"text"}'

# Telugu — LOW urgency
curl -X POST http://localhost:4000/api/triage \
  -H "Content-Type: application/json" \
  -d '{"text":"కొంచెం దగ్గు నిన్న నుండి","language":"te","source":"text"}'
```

### Doctors & Appointments
```bash
# List PHC doctors (English)
curl "http://localhost:4000/api/doctors?facility=PHC&lang=en"

# List all doctors (Hindi names)
curl "http://localhost:4000/api/doctors?lang=hi"

# Get slots for doctor 1 today
curl "http://localhost:4000/api/doctors/1/slots?date=$(date +%Y-%m-%d)"

# Book appointment
curl -X POST http://localhost:4000/api/appointments/book \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"<id>","doctorId":1,"slotId":5,"patientAlias":"USER","reason":"fever","language":"en"}'
```

### Facilities
```bash
curl "http://localhost:4000/api/facilities?district=Pune&type=PHC&lang=en"
curl "http://localhost:4000/api/facilities?type=DISTRICT_HOSPITAL&lang=hi"
```

### Metrics (judge-friendly)
```bash
curl http://localhost:4000/api/metrics
# → {"total_sessions":12,"triage_calls":34,"low_count":10,"medium_count":18,"high_count":6,"llm_used_count":0,...}
```

### Demo helper
```bash
curl http://localhost:4000/api/demo
# → 20 sample phrases in 5 languages with expected urgency
```

---

## Demo Script — 5 Inputs & Expected Outputs

| # | Language | Input | Expected |
|---|----------|-------|----------|
| 1 | English | `"chest pain and difficulty breathing"` | HIGH / EMERGENCY |
| 2 | Hindi | `"2 din se bukhar hai aur sir dard"` | MEDIUM / PHC |
| 3 | English | `"mild cough since yesterday"` | LOW / HOME |
| 4 | Telugu | `"ఛాతీ నొప్పి మరియు ఊపిరి ఆడటం కష్టం"` | HIGH / EMERGENCY |
| 5 | Marathi | `"3 दिवसांपासून ताप आहे"` | MEDIUM / PHC |

---

## Voice Input

Voice-to-text happens entirely in the browser using the Web Speech API. The frontend sends the recognized text string to the backend with `"source":"voice"`. The backend treats voice input identically to typed text — the `source` field is logged for analytics only.

```json
{
  "message": "mujhe bukhar hai 2 din se",
  "language": "hi",
  "source": "voice"
}
```

No audio is ever sent to the backend. No audio is stored.

---

## Run Tests
```bash
cd backend
node test_all.js
# → 37 tests, all passing
```

---

## Folder Structure

```
arogyasaarthi/
├── backend/
│   ├── server.js              # Express entry point (port 4000)
│   ├── package.json
│   ├── .env.example
│   ├── ai_bridge.js           # Node ↔ Python + local fallback
│   ├── test_all.js            # Integration tests (37 tests)
│   ├── routes/
│   │   ├── session.js         # POST /api/session/start, GET /api/session/:id
│   │   ├── chat.js            # POST /api/chat
│   │   ├── triage.js          # POST /api/triage
│   │   ├── doctors.js         # GET /api/doctors, GET /api/doctors/:id/slots
│   │   ├── appointments.js    # POST /api/appointments/book
│   │   ├── facilities.js      # GET /api/facilities
│   │   ├── metrics.js         # GET /api/metrics
│   │   └── demo.js            # GET /api/demo
│   └── db/
│       ├── sqlite.js          # DB init + auto-seed
│       ├── schema.sql
│       └── seed.sql
├── ai_engine/
│   ├── app.py                 # FastAPI entry point (port 8000)
│   ├── requirements.txt
│   ├── .env.example
│   ├── nlp_extractor.py       # Regex + dictionary extraction (5 languages)
│   ├── triage_rules.py        # Deterministic rule engine
│   ├── explainer.py           # Template-based explanation generator
│   ├── safety.py              # Output safety filter
│   ├── rules/
│   │   └── triage_rules.json  # 12 red-flag + 14 general rules
│   └── i18n/
│       ├── labels_en.json
│       ├── labels_hi.json
│       ├── labels_mr.json
│       ├── labels_ta.json
│       └── labels_te.json
├── frontend/                  # React PWA (already built)
├── docker-compose.yml
└── README.md
```

---

## Safety Guarantees

- Urgency is **always** determined by `triage_rules.py` — deterministic, auditable JSON rules
- LLM (if enabled) can only improve extraction/explanation text, never change urgency
- `safety.py` blocks diagnosis terms, disease names, medication advice from any output
- Conservative default: unknown symptoms → MEDIUM / PHC
- No PII stored: only anonymized metrics (urgency, language, latency, source)
- Disclaimer injected on every response

---

*Built for India. Designed for Bharat. 🇮🇳*

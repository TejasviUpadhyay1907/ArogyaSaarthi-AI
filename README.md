<p align="center">
  <img src="frontend/public/vite.svg" width="64" alt="ArogyaSaarthi AI" />
</p>

<h1 align="center">ArogyaSaarthi AI</h1>
<p align="center"><strong>Voice-First Rural Healthcare Navigator for India</strong></p>
<p align="center">
  Rules decide urgency. AI only helps understand and explain.<br/>
  5 languages · Deterministic triage · Zero PII · Offline-resilient
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-React_19-61DAFB?style=flat-square&logo=react" />
  <img src="https://img.shields.io/badge/Backend-Node.js_+_Express-339933?style=flat-square&logo=node.js" />
  <img src="https://img.shields.io/badge/AI_Engine-Python_+_FastAPI-009688?style=flat-square&logo=fastapi" />
  <img src="https://img.shields.io/badge/LLM-Gemini_2.5_Flash-4285F4?style=flat-square&logo=google" />
  <img src="https://img.shields.io/badge/Auth-Firebase-FFCA28?style=flat-square&logo=firebase" />
  <img src="https://img.shields.io/badge/DB-SQLite-003B57?style=flat-square&logo=sqlite" />
  <img src="https://img.shields.io/badge/Tests-37_passing-brightgreen?style=flat-square" />
</p>

---

## What is ArogyaSaarthi?

ArogyaSaarthi AI is a voice-first web application that helps rural and semi-urban Indians navigate the healthcare system. Users speak their symptoms in Hindi, English, Marathi, Tamil, or Telugu — and the app uses AI to structure those symptoms, then applies **deterministic rule-based triage** to classify urgency and guide them to the right care level.

- ✅ Classifies urgency: **LOW** (home care) · **MEDIUM** (visit PHC within 24h) · **HIGH** (call 108 immediately)
- ✅ Maps to India's referral chain: Home → PHC → CHC → District Hospital → Emergency
- ❌ Never diagnoses diseases
- ❌ Never prescribes medications
- ❌ Never stores personal health data


---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  FRONTEND — React 19 + Vite + Tailwind CSS (Port 5173)                  │
│  Voice input (Web Speech API) · 5-language i18n · Firebase Auth          │
│  Pages: Home, Chat, SymptomChecker, Appointment, NearbyFacilities       │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │  REST API (JSON)
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  BACKEND — Node.js + Express (Port 4000)                                │
│  API Gateway · Firebase Auth middleware · Rate limiting · SQLite DB      │
│  AI Bridge: Scope → Intent → Extract → Classify → Explain pipeline      │
│  Local fallback engine (works when Python service is down)               │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │  REST API (JSON)
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  AI ENGINE — Python + FastAPI (Port 8000)                               │
│  Gemini 2.5 Flash (NLP extraction + explanation + scope + intent)        │
│  Deterministic rule engine (26 JSON rules — urgency is NEVER AI-driven) │
│  4-layer safety filter · 5-language regex dictionaries · Template fallback│
└─────────────────────────────────────────────────────────────────────────┘
```

**Safety boundary:** Urgency classification is always deterministic rule-based (`triage_rules.py`). Gemini is used only for understanding (NLP extraction) and explaining (vernacular text generation). If Gemini is unavailable, the system falls back to regex extraction + template explanations — same response shape, zero downtime.

---

## Features

| Feature | Description |
|---------|-------------|
| 🎙️ Voice-first input | Speak symptoms in 5 Indian languages via Web Speech API — no typing needed |
| 🤖 AI Chat assistant | Conversational interface with scope classification, intent detection, and inline triage cards |
| 🩺 Guided Symptom Checker | 4-step wizard: patient context → symptom selection → AI follow-ups → triage result |
| 🛡️ Deterministic triage | 26 auditable JSON rules decide urgency — AI never makes medical decisions |
| 🏥 Facility finder | Location-based search for nearest PHC/CHC/District Hospital with distance and contact info |
| 📅 Appointment booking | Browse doctors by facility type, view available slots, book with one tap |
| 🌐 5-language support | Full i18n: English, Hindi, Marathi, Tamil, Telugu — UI, explanations, and voice |
| 🔒 Firebase Auth | Google Sign-In + email/password with email verification, role-based access |
| 📵 Offline fallback | Regex extraction + template explanations when Gemini API is unavailable |
| 📊 Analytics endpoint | `/api/metrics` — sessions, urgency distribution, LLM usage, avg latency |
| 🚨 Emergency integration | 108/104 call buttons, always-visible emergency bar |
| 🔐 Zero PII | No personal data stored — anonymized session logs only, DPDP Act 2023 compliant |


---

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- npm / pip

### 1. Clone and install

```bash
git clone https://github.com/your-team/arogyasaarthi.git
cd arogyasaarthi

# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install

# AI Engine
cd ../ai_engine
pip install -r requirements.txt
```

### 2. Configure environment

**`frontend/.env`**
```env
VITE_API_URL=
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```
> Leave `VITE_API_URL` empty for local dev — Vite proxy handles `/api` routes automatically.

**`backend/.env`** (copy from `.env.example`)
```env
PORT=4000
AI_ENGINE_URL=http://localhost:8000
DATABASE_FILE=./db/arogya.db
NODE_ENV=development
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
```

**`ai_engine/.env`**
```env
PORT=8000
USE_LLM=true
LLM_PROVIDER=gemini
LLM_API_KEY=your_gemini_api_key
MODEL_NAME=models/gemini-2.5-flash
```
> Set `USE_LLM=false` to run without Gemini — the system uses regex extraction + template explanations as fallback.

### 3. Start all services

Open 3 terminals:

```bash
# Terminal 1 — AI Engine
cd ai_engine
python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — Backend
cd backend
node server.js

# Terminal 3 — Frontend
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

The SQLite database is auto-created and seeded on first run with 6 doctors, 8 facilities, and appointment slots for 3 days.

### Docker (alternative)

```bash
docker-compose up
```
This starts all 3 services. Frontend at `:5173`, Backend at `:4000`, AI Engine at `:8000`.


---

## Project Structure

```
arogyasaarthi/
│
├── frontend/                          # React 19 + Vite + Tailwind CSS
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.jsx              # Landing page with hero, features, how-it-works
│   │   │   ├── Chat.jsx              # AI chat interface (voice + text, inline triage cards)
│   │   │   ├── SymptomChecker.jsx    # 4-step guided symptom checker wizard
│   │   │   ├── Appointment.jsx       # Doctor listing + slot booking
│   │   │   ├── NearbyFacilities.jsx  # Location-based facility finder
│   │   │   ├── Dashboard.jsx         # User profile + quick links
│   │   │   └── AuthPage.jsx          # Login / signup (Firebase)
│   │   ├── components/
│   │   │   ├── Navbar.jsx            # Navigation + language selector + user menu
│   │   │   ├── EmergencyBar.jsx      # Always-visible 108/104 emergency banner
│   │   │   ├── EmergencyBanner.jsx   # Emergency banner variant
│   │   │   ├── Footer.jsx            # Footer with emergency contacts + disclaimer
│   │   │   ├── Logo.jsx              # SVG logo component
│   │   │   └── MobileMenu.jsx        # Mobile navigation drawer
│   │   ├── context/
│   │   │   └── AuthContext.jsx        # Firebase auth state + Firestore profile
│   │   ├── i18n/
│   │   │   ├── LangContext.jsx        # Language provider + t() translation function
│   │   │   ├── en.json               # English translations
│   │   │   ├── hi.json               # Hindi translations
│   │   │   ├── mr.json               # Marathi translations
│   │   │   ├── ta.json               # Tamil translations
│   │   │   └── te.json               # Telugu translations
│   │   ├── services/
│   │   │   └── api.js                # Authenticated API client (Firebase token)
│   │   ├── routes/
│   │   │   └── ProtectedRoute.jsx    # Auth guard (login + email verification)
│   │   ├── firebase.js               # Firebase app init
│   │   ├── App.jsx                   # Router + providers
│   │   ├── main.jsx                  # Entry point
│   │   └── index.css                 # Global styles + animations
│   ├── .env                          # Firebase config + API URL
│   ├── vite.config.js                # Vite config with API proxy
│   └── package.json
│
├── backend/                           # Node.js + Express API Gateway
│   ├── server.js                     # Express entry point (port 4000)
│   ├── ai_bridge.js                  # AI pipeline orchestrator + local fallback
│   ├── firebase-admin.js             # Firebase Admin SDK init
│   ├── middleware/
│   │   └── auth.js                   # Firebase JWT verification middleware
│   ├── routes/
│   │   ├── session.js                # POST /api/session/start, GET /api/session/:id
│   │   ├── chat.js                   # POST /api/chat (conversational AI)
│   │   ├── chat_action.js            # POST /api/chat/action (card button actions)
│   │   ├── triage.js                 # POST /api/triage (direct triage)
│   │   ├── symptom_checker.js        # POST /api/symptom-checker/* (guided flow)
│   │   ├── doctors.js                # GET /api/doctors, GET /api/doctors/:id/slots
│   │   ├── appointments.js           # POST /api/appointments/book
│   │   ├── facilities.js             # GET /api/facilities
│   │   ├── facilities_live.js        # GET /api/facilities/nearby (pincode-based)
│   │   ├── metrics.js                # GET /api/metrics (analytics)
│   │   ├── demo.js                   # GET /api/demo (sample phrases)
│   │   ├── demo_tests.js             # GET /api/demo-tests
│   │   ├── demo_symptom_checker.js   # GET /api/demo-symptom-checker
│   │   ├── demo_scope_tests.js       # GET /api/demo-scope-tests
│   │   └── triage_helpers.js         # Shared triage utilities
│   ├── db/
│   │   ├── sqlite.js                 # DB init + auto-seed on first run
│   │   ├── schema.sql                # Table definitions
│   │   └── seed.sql                  # 6 doctors, 8 facilities, slot generation
│   ├── test_all.js                   # 37 integration tests
│   ├── .env.example                  # Environment template
│   └── package.json
│
├── ai_engine/                         # Python + FastAPI AI Microservice
│   ├── app.py                        # FastAPI app — 7 endpoints
│   ├── nlp_extractor.py              # Gemini + 5-language regex symptom extraction
│   ├── triage_rules.py               # Deterministic rule engine (26 JSON rules)
│   ├── triage_engine.py              # Unified triage pipeline
│   ├── explainer.py                  # Gemini + template explanation generator
│   ├── safety.py                     # Output safety filter (50+ blocked terms)
│   ├── intent_gate.py                # Gemini + regex intent classification
│   ├── gemini_client.py              # Gemini API wrapper with retry + timeout
│   ├── rules/
│   │   └── triage_rules.json         # 12 red-flag + 14 general triage rules
│   ├── i18n/
│   │   ├── labels_en.json            # English labels + templates
│   │   ├── labels_hi.json            # Hindi
│   │   ├── labels_mr.json            # Marathi
│   │   ├── labels_ta.json            # Tamil
│   │   └── labels_te.json            # Telugu
│   ├── .env                          # Gemini API key + config
│   └── requirements.txt
│
├── docker-compose.yml                 # One-command deployment (3 services)
├── design.md                          # Detailed system design document
├── requirements.md                    # Functional + non-functional requirements
├── HACKATHON_PLAN.md                  # 5-day implementation plan
└── README.md                          # ← You are here
```


---

## How It Works

```
User speaks symptoms (Hindi/English/Marathi/Tamil/Telugu)
    │
    ▼
┌─ Scope Classifier (Gemini) ─────────────────────────────────┐
│  "which medicine?" → OUT_OF_SCOPE (polite redirect)          │
│  "hello"           → NON_MEDICAL_SAFE (friendly reply)       │
│  "chest pain"      → MEDICAL (proceed to triage)             │
└──────────────────────────────────────────────────────────────┘
    │ MEDICAL
    ▼
┌─ Intent Gate + NLP Extraction (Gemini 2.5 Flash) ────────────┐
│  Extracts: primary symptom, duration, severity, red flags     │
│  SMALL_TALK → friendly reply     CLARIFICATION → ask details  │
│  SYMPTOMS → structured data passed to rule engine             │
└──────────────────────────────────────────────────────────────┘
    │ SYMPTOMS
    ▼
┌─ Deterministic Rule Engine (NO AI) ──────────────────────────┐
│  12 red-flag rules → AUTO HIGH / EMERGENCY                    │
│  14 general rules  → LOW / MEDIUM / HIGH                      │
│  Default           → MEDIUM / PHC (conservative)              │
│  Rules are auditable JSON — no black box                      │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
┌─ Explanation Generator (Gemini, safety-filtered) ────────────┐
│  Converts triage result to simple vernacular explanation       │
│  Safety filter blocks diagnosis/medication terms (50+ terms)  │
│  Fallback: pre-written templates if Gemini fails              │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
┌─ Result ─────────────────────────────────────────────────────┐
│  🟢🟡🔴 Urgency badge + time to act                          │
│  📍 Recommended facility + booking option                     │
│  📋 "Why this urgency" reasoning                              │
│  ⚠️ "Watch for" warning signs                                 │
│  🚨 Call 108 button (if HIGH)                                 │
│  ⚠️ Disclaimer (always visible)                               │
└──────────────────────────────────────────────────────────────┘
```

---

## API Reference

All protected endpoints require `Authorization: Bearer <FIREBASE_ID_TOKEN>` header.

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/session/start` | Start anonymous session → `{sessionId}` |
| GET | `/api/session/:id` | Get session state |
| GET | `/api/metrics` | Analytics: sessions, urgency counts, LLM usage, latency |
| GET | `/api/demo` | 20 sample phrases in 5 languages with expected urgency |
| GET | `/health` | Health check |

### Protected — AI Triage

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Conversational AI chat (voice/text → scope → intent → triage) |
| POST | `/api/chat/action` | Execute card actions (CALL_108, FIND_FACILITY, BOOK_APPOINTMENT, etc.) |
| POST | `/api/triage` | Direct triage: text → urgency + care level + explanation |
| POST | `/api/symptom-checker/followups` | Get AI-generated follow-up questions for selected symptoms |
| POST | `/api/symptom-checker/triage` | Submit guided symptom checker for triage |
| POST | `/api/symptom-checker/facilities` | Get suggested facilities based on triage result + location |

### Protected — Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/doctors` | List doctors (filter by facility type, language) |
| GET | `/api/doctors/:id/slots` | Get available appointment slots |
| POST | `/api/appointments/book` | Book an appointment |
| GET | `/api/facilities` | List facilities (filter by district, type, language) |
| GET | `/api/facilities/nearby` | Find facilities by pincode |

### AI Engine Endpoints (internal, port 8000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/triage` | Unified triage pipeline |
| POST | `/scope` | Scope classifier (MEDICAL / NON_MEDICAL_SAFE / OUT_OF_SCOPE) |
| POST | `/intent` | Intent gate + extraction (SMALL_TALK / CLARIFICATION / SYMPTOMS) |
| POST | `/extract` | NLP symptom extraction |
| POST | `/classify` | Deterministic rule-based classification |
| POST | `/explain` | Explanation generation |
| POST | `/safety-check` | Safety filter check |
| GET | `/health` | AI engine health + Gemini status |


---

## Demo Script — 5 Inputs & Expected Outputs

| # | Language | Input | Expected Urgency | Expected Care Level |
|---|----------|-------|------------------|---------------------|
| 1 | English | `"chest pain and difficulty breathing"` | 🔴 HIGH | EMERGENCY |
| 2 | Hindi | `"2 din se bukhar hai aur sir dard"` | 🟡 MEDIUM | PHC |
| 3 | English | `"mild cough since yesterday"` | 🟢 LOW | HOME |
| 4 | Telugu | `"ఛాతీ నొప్పి మరియు ఊపిరి ఆడటం కష్టం"` | 🔴 HIGH | EMERGENCY |
| 5 | Marathi | `"3 दिवसांपासून ताप आहे"` | 🟡 MEDIUM | PHC |

### Out-of-Scope Handling

| Input | Response |
|-------|----------|
| `"which medicine for fever"` | Polite redirect — "I can help with symptoms, not prescriptions" |
| `"hello"` | Friendly greeting + symptom prompt |
| `"what is the capital of India"` | Brief answer + redirect to symptoms |

---

## Voice Input

Voice-to-text happens entirely in the browser using the **Web Speech API**. The frontend sends the recognized text string to the backend — no audio is ever transmitted or stored.

Supported voice languages:
- `en-IN` (English - India)
- `hi-IN` (Hindi)
- `mr-IN` (Marathi)
- `ta-IN` (Tamil)
- `te-IN` (Telugu)

```json
{
  "message": "mujhe bukhar hai 2 din se",
  "language": "hi",
  "source": "voice"
}
```

The `source` field is logged for analytics only — voice and text inputs are processed identically.

---

## Safety Architecture

```
Layer 1: Scope Classifier
  → Blocks out-of-scope queries (prescriptions, diagnosis requests, non-health topics)

Layer 2: NLP Constraints
  → Entity extraction only — no inference, no diagnosis
  → Confidence thresholds — low confidence triggers clarifying questions

Layer 3: Deterministic Rules
  → Urgency decided by auditable JSON rules — never by AI
  → Red flags always override to HIGH/EMERGENCY
  → Conservative default: unknown symptoms → MEDIUM/PHC

Layer 4: Output Validation
  → 50+ blocked terms across 5 languages (diagnosis, medication, disease names)
  → Template fallback if Gemini output fails safety check
  → Disclaimer injected on every response
```

**Blocked term examples:** `diagnosis`, `pneumonia`, `paracetamol`, `बीमारी`, `दवाई`, `गोली`, `நோய்`, `మందు`, and 40+ more.

---

## Database

SQLite (file-based, zero-config). Auto-created and seeded on first backend start.

| Table | Purpose | PII? |
|-------|---------|------|
| `sessions` | Session state (language, last urgency, location) | No — session ID only |
| `triage_logs` | Anonymized triage analytics (urgency, language, latency) | No |
| `doctors` | Doctor profiles in 5 languages | No |
| `facilities` | Healthcare facilities with coordinates | No |
| `slots` | Appointment time slots | No |
| `appointments` | Booked appointments (patient alias only) | No — alias only |

---

## Tests

```bash
cd backend
node test_all.js
```

37 integration tests covering:
- Session creation and retrieval
- Triage classification (HIGH/MEDIUM/LOW across languages)
- Chat flow (scope → intent → triage)
- Doctor listing and slot retrieval
- Appointment booking
- Facility search
- Metrics endpoint
- Fallback behavior (Python service down)


---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 19, Vite 7, Tailwind CSS 4 | SPA with glass-morphism UI, mobile-first |
| Voice | Web Speech API | Browser-native STT — zero cost, no audio sent to server |
| Auth | Firebase Auth + Firestore | Google Sign-In, email/password, email verification, user profiles |
| Backend | Node.js 18+, Express 4 | API gateway, rate limiting, session management |
| Database | SQLite (better-sqlite3) | Zero-config, file-based, auto-seeded |
| AI Engine | Python 3.10+, FastAPI | NLP extraction, rule engine, explanation generation |
| LLM | Google Gemini 2.5 Flash | Scope classification, intent detection, symptom extraction, explanation |
| Triage | Deterministic JSON rules | 26 auditable rules — urgency is never AI-driven |
| Safety | Custom filter (5 languages) | 50+ blocked terms, template fallback, disclaimer injection |
| i18n | JSON translation files | 5 languages: EN, HI, MR, TA, TE |
| Deployment | Docker Compose | Single-command startup for all 3 services |

---

## Environment Variables

### Frontend (`frontend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | No | Backend URL. Leave empty for local dev (Vite proxy). |
| `VITE_FIREBASE_API_KEY` | Yes | Firebase Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Yes | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Yes | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Yes | Firebase app ID |

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 4000) |
| `AI_ENGINE_URL` | No | Python AI engine URL (default: `http://localhost:8000`) |
| `DATABASE_FILE` | No | SQLite file path (default: `./db/arogya.db`) |
| `NODE_ENV` | No | Environment (default: `development`) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Yes | Firebase Admin SDK service account JSON (single-line) |
| `FIREBASE_PROJECT_ID` | Yes | Firebase project ID |

### AI Engine (`ai_engine/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 8000) |
| `USE_LLM` | No | Enable Gemini (`true`/`false`, default: `true`) |
| `LLM_PROVIDER` | No | LLM provider (default: `gemini`) |
| `LLM_API_KEY` | If USE_LLM=true | Gemini API key |
| `MODEL_NAME` | No | Gemini model (default: `models/gemini-2.5-flash`) |

---

## Triage Rules

All rules live in `ai_engine/rules/triage_rules.json` — version-controlled, human-readable, auditable.

**Red-flag rules (12)** — auto-trigger HIGH/EMERGENCY:
- Chest pain + breathlessness, loss of consciousness, seizures, severe bleeding
- Snake bite, poisoning, pregnancy danger signs, stroke signs
- Severe abdominal pain, high fever in infants, difficulty breathing

**General rules (14)** — match symptoms + duration + severity:
- Fever ≥3 days → MEDIUM/PHC
- Fever + cough → MEDIUM/PHC
- Mild cough <3 days → LOW/HOME
- Vomiting + diarrhea >1 day → MEDIUM/PHC

**Default rule** — when nothing matches:
- Unknown symptoms → MEDIUM/PHC (conservative — always escalate uncertainty)

---

## Supported Languages

| Code | Language | Voice Input | UI | Triage Explanations | Symptom Extraction |
|------|----------|-------------|----|--------------------|-------------------|
| `en` | English | ✅ | ✅ | ✅ | ✅ |
| `hi` | Hindi | ✅ | ✅ | ✅ | ✅ |
| `mr` | Marathi | ✅ | ✅ | ✅ | ✅ |
| `ta` | Tamil | ✅ | ✅ | ✅ | ✅ |
| `te` | Telugu | ✅ | ✅ | ✅ | ✅ |

Adding a new language requires:
1. `frontend/src/i18n/<lang>.json` — UI translations
2. `ai_engine/i18n/labels_<lang>.json` — triage labels + templates
3. Regex patterns in `nlp_extractor.py` — symptom/duration/severity keywords

No model retraining needed.

---

## Emergency Contacts

Always displayed in the app:

| Service | Number |
|---------|--------|
| 🚑 Ambulance | **108** |
| 📞 Medical Helpline | **104** |
| 👩 Women Helpline | **181** |

---

## License

Built for the AMD Slingshot Hackathon — AI for Social Good challenge.

*Built for India. Designed for Bharat.* 🇮🇳

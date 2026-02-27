# ArogyaSaarthi AI — Hackathon Implementation Plan

> Challenge: **AI for Social Good**  
> Team: 2 members | Deadline: 01/03/2026

**One-line Pitch:** ArogyaSaarthi is a voice-first Hindi/English web app that turns unstructured symptom descriptions into safe, deterministic urgency guidance for rural patients — rules decide urgency, AI only helps understand and explain.

---

## Team Skills Map

| Area | Teammate (Web/Node) | You (Python/AI) |
|------|---------------------|-----------------|
| Languages | JavaScript, TypeScript basics | Python, SQL basics |
| Frontend | HTML5, CSS3, Bootstrap, Vanilla JS | — |
| Backend | Node.js, Express.js, REST APIs | REST APIs (Python), Flask/FastAPI |
| Database | SQLite (file-based), basic schema design | Reads/writes via API only |
| AI/ML | — | Pandas, NumPy, LLM basics, Prompt Engineering, RAG concepts, Multi-LLM Integration |
| DSA/CS | DSA basics | DSA, OOPs, DBMS, SE |
| Tools | Git, GitHub, Postman | Git, GitHub, Postman |

**Division of Work (Crystal Clear):**
- **Teammate (Web/Node owner):**
  - Frontend (HTML/CSS/Bootstrap/JS + Web Speech API).
  - Node.js + Express backend (API gateway, routing, `/metrics`).
  - SQLite integration for anonymized session logs and metrics only.
  - Deployment of frontend + Node service.
- **You (Python/AI owner):**
  - Python AI microservice (`app.py` using Flask, as in plan).
  - Deterministic rule engine (`triage_rules.py` + `triage_rules.json`).
  - Keyword/LLM-based extraction (`nlp_extractor.py`).
  - Explanation generation (`explainer.py`) with strict safety guardrails.
  - Fallback mode logic (keyword + templates when LLM fails).
- **Both (shared):**
  - Integration testing (browser → Node → Python AI).
  - Demo video and live walkthrough.
  - Deck, architecture diagram, AMD Slingshot submission form.

---

## Final Tech Stack (Consistent, Prototype-Ready)

| Layer | Technology | Owner |
|-------|------------|-------|
| Frontend | HTML5 + CSS3 + Bootstrap 5 + Vanilla JS | Teammate |
| Voice Input | Web Speech API (browser built-in, free) | Teammate |
| API Gateway | Node.js + Express.js | Teammate |
| AI Microservice | Python + Flask (`app.py`) | You |
| Storage | SQLite (file-based, anonymized **session logs only**) | Teammate |
| Rules Storage | Version-controlled JSON (`ai_engine/rules/triage_rules.json`) | You |
| AI - Extraction | Keyword + optional LLM (OpenAI/Gemini) | You |
| AI - Explanation | Optional LLM + safety filters | You |
| Triage Engine | Deterministic rule engine (`triage_rules.py`) | You |
| Observability | Node `GET /metrics` + SQLite logs | Teammate (Node), You (fields) |
| Version Control | Git + GitHub | Both |
| API Tools | Postman + Swagger (Express + Flask docs) | Both |
| Deployment | Render.com (Node + Python) or local demo | Both |

> No heavy infra (no RAG/vector DB). LLM is **optional** and used only for extraction and/or explanation, never to decide urgency.

---

## Project Structure

```text
arogyasaarthi/
├── frontend/
│   ├── index.html          # Landing + language select + one-line pitch
│   ├── record.html         # Voice recording screen
│   ├── confirm.html        # Transcription confirm
│   ├── results.html        # Urgency + guidance display
│   ├── css/
│   │   └── style.css       # Custom styles on top of Bootstrap
│   └── js/
│       ├── voice.js        # Web Speech API logic
│       ├── api.js          # Fetch calls to Node backend
│       └── results.js      # Render urgency badge + guidance
│
├── backend/                # Node.js + Express API gateway
│   ├── server.js           # Entry point
│   ├── routes/
│   │   ├── session.js      # POST /session/start
│   │   ├── symptoms.js     # POST /symptoms/process → Python /extract
│   │   └── triage.js       # POST /triage/classify → Python /classify + /explain
│   ├── metrics.js          # GET /metrics (aggregates SQLite logs)
│   ├── db/
│   │   └── sqlite.js       # SQLite connection (session_logs.db file, session logs only)
│   └── .env                # API keys (LLM), SQLite path, Python service URL
│
├── ai_engine/              # Python AI microservice (you own this)
│   ├── nlp_extractor.py    # Keyword + LLM entity extraction (optional LLM)
│   ├── triage_rules.py     # Rule-based classification (deterministic)
│   ├── explainer.py        # LLM explanation generator with safety filters
│   ├── rules/
│   │   └── triage_rules.json  # All triage rules (version-controlled JSON)
│   ├── prompts/
│   │   ├── extract_hi.txt  # Hindi extraction prompt
│   │   └── explain_hi.txt  # Hindi explanation prompt
│   └── app.py              # Flask API (called by Node backend)
│
└── README.md
```

> **Important:** Triage rules live in JSON files inside `ai_engine/rules/`. SQLite is used **only** for anonymized session logs and metrics, not for storing rules.

---

## API Contract (High-Level)

- **Frontend → Node**
  - `POST /triage`
  - **Request body:**
    ```json
    {
      "text": "...",
      "language": "hi" | "en"
    }
    ```
- **Node → Python AI microservice**
  - `POST /extract`
  - `POST /classify`
  - `POST /explain`
- **Node → Frontend response**
  - **Response body:**
    ```json
    {
      "urgency": "LOW" | "MEDIUM" | "HIGH",
      "recommended_facility": "...",
      "explanation": "...",
      "disclaimer": "..."
    }
    ```

---

## Deterministic-First Safety Architecture (AMD Alignment)

- **Rules decide urgency, always:**
  - Urgency (`LOW` / `MEDIUM` / `HIGH`) and facility recommendation (Home / PHC / CHC / District Hospital / Emergency) are **always computed by deterministic rules** in `triage_rules.py` using `triage_rules.json`.
  - LLM output is never used directly to set or override urgency or facility.
- **LLM is optional and constrained:**
  - LLM may be used for:
    - Better extraction of structured fields (symptoms, duration, red flags).
    - Generating simple, friendly explanations in Hindi/English.
  - Even when LLM assists extraction, the rule engine re-checks everything and applies hard-coded rules; final urgency is still deterministic.
- **No diagnosis, no prescription, no disease naming:**
  - The system never names diseases, never suggests medicines, and never acts as telemedicine.
  - Prompts and post-processing blocks diagnosis-like terms, drug names, and risky language.
- **Conservative default when uncertain:**
  - If extraction is uncertain/ambiguous, the engine falls back to a conservative default:
    - **Urgency:** `MEDIUM`
    - **Facility:** `PHC`
    - Plus a strong disclaimer recommending in-person evaluation.
- **The system intentionally prefers safe over precise decisions in uncertain cases.**
- **Auditable triage rules:**
  - All triage rules are stored as human-readable JSON inside `triage_rules.json`, making them easy to review, audit, and refine over time.

---

## Fallback Mode (Offline / LLM Failure)

- **When is fallback triggered?**
  - LLM API fails (timeout, 5xx, rate limits).
  - No API key configured in `.env`.
  - Low-connectivity demo environment where calling LLM is not reliable.
- **Fallback behaviour:**
  - Use **keyword-based extraction only**:
    - Simple dictionaries and regexes to detect key symptoms (e.g., chest pain, breathlessness, fever days).
  - Feed these extracted keywords into the deterministic rule engine.
  - Generate explanation using pre-written templates:
    - Per urgency level (LOW / MEDIUM / HIGH).
    - Optional small variations for common red flags.
- **Guaranteed response shape:**
  - Even in full fallback mode, the system always returns:
    - `urgency`
    - `recommended_facility`
    - `explanation` (template-based)
    - `disclaimer`
- **Voice vs. typed input:**
  - Voice input depends on browser Web Speech API support.
  - If unsupported or offline, the user can still **type symptoms**; triage (rules + templates) works fully offline on the Node + Python stack.

---

## Observability & Metrics (Judge-Friendly)

- **Node endpoint: `GET /metrics`**
  - Implemented in `backend/metrics.js` and exposed via Express.
  - Returns JSON with the following fields aggregated from SQLite:
    - `total_sessions`
    - `low_count`
    - `medium_count`
    - `high_count`
    - `llm_used_count` (number of sessions where LLM was actually called)
- **SQLite logging (anonymized, no PII):**
  - Each triage session writes one row into a `session_logs` table.
  - **Fields (minimal logging schema):**
    - `timestamp` — ISO string
    - `language` — `"hi"` / `"en"` (or similar)
    - `urgency` — `"LOW" | "MEDIUM" | "HIGH"`
    - `facility` — `"HOME" | "PHC" | "CHC" | "DISTRICT_HOSPITAL" | "EMERGENCY"`
    - `llm_used` — boolean (or 0/1)
    - `latency_ms` — optional, request duration as number
    - `source` — `"voice"` or `"text"` (optional, for demo insights)
  - **No PII stored**:
    - No names, phone numbers, locations, or free-form text; only anonymized, aggregated fields.
- **Demo usage:**
  - During the demo, `/metrics` is opened in Postman or browser to show:
    - Number of sessions run.
    - Distribution across LOW/MEDIUM/HIGH.
    - How often LLM was required vs. fallback.

---

## Edge / Low-Resource & Deployment Framing

- **Low-resource friendly:**
  - Frontend is static HTML/CSS/JS with minimal JS.
  - Node.js backend is a lightweight Express server.
  - Python AI microservice runs a small Flask app with rule-based logic.
  - No GPU, no heavy ML models; keyword extraction and rule evaluation are CPU-cheap.
- **Minimal cloud dependency:**
  - Prototype can run entirely on a single low-cost VM or laptop (Node + Python + SQLite file).
  - Designed to run fully on a single low-cost CPU machine without GPU acceleration.
  - LLM calls are optional; when disabled, the app still functions via fallback mode.
- **Flexible deployment:**
  - **Preferred:** Deploy Node and Python services separately on Render.com / Railway / similar.
  - **Backup:** Run both services locally (localhost ports) and present the demo from a laptop if cloud deployment is delayed.

---

## Implementation Plan — Day by Day (5-Day Prototype Sprint)

### Day 1 — Foundation (Web + AI Skeleton)

**Teammate (Web/Node):**
- [ ] Create GitHub repo, invite you.
- [ ] Setup Node.js + Express skeleton (`server.js`, basic health route).
- [ ] Setup SQLite helper in `db/sqlite.js` and initialize `session_logs` table in a local `session_logs.db` file.
- [ ] Build `index.html` — language selector (Hindi / English) + one-line pitch.
- [ ] Build `record.html` — large mic button, clear instructions.

**You (Python/AI):**
- [ ] Setup Python Flask app (`ai_engine/app.py`) with 3 endpoints:
  - `POST /extract` — takes text, returns structured symptoms.
  - `POST /classify` — takes structured symptoms, returns urgency + facility.
  - `POST /explain` — takes triage result, returns explanation text.
- [ ] Write initial `triage_rules.json` (20 core rules: red flags + common cases).
- [ ] Draft extraction and explanation prompt templates (Hindi + English).

---

### Day 2 — Core AI Pipeline (Deterministic + LLM-safe)

**You (Python/AI):**
- [ ] Implement `nlp_extractor.py`:
  - Keyword-based extraction first.
  - Optional LLM call with strict extraction prompt.
  - Always normalize to a deterministic schema.
- [ ] Implement `triage_rules.py` rule engine:
  - Load `triage_rules.json`.
  - Classify into LOW/MEDIUM/HIGH with mapped facility.
  - Apply **conservative default** (MEDIUM + PHC) when uncertain.
- [ ] Implement `explainer.py`:
  - Prompt-engineered LLM call for simple Hindi/English text.
  - Add output validation — block words like "diagnosis", "medicine", "दवाई", and disease names.
- [ ] Wire these into Flask endpoints `/extract`, `/classify`, `/explain`.

**Teammate (Web/Node):**
- [ ] Wire Web Speech API in `voice.js` — start/stop recording, get transcript.
- [ ] Build `confirm.html` — show transcript, allow edit, confirm button.
- [ ] Implement `POST /symptoms/process` in Node:
  - Forward text to Python `/extract`.
  - Handle errors and fallback gracefully.

---

### Day 3 — Triage + Results + Basic Metrics

**Teammate (Web/Node):**
- [ ] Implement `POST /triage/classify` in Node:
  - Call Python `/classify` + `/explain`.
  - Apply conservative default (MEDIUM + PHC) if AI service fails.
- [ ] Build `results.html`:
  - Color-coded urgency badge (Bootstrap: danger/warning/success).
  - Care level card (Home / PHC / CHC / District Hospital / Emergency).
  - Simple explanation text + bold disclaimer.
  - 108 emergency banner (always visible for HIGH urgency).
  - "Copy Summary" button for sharing.
- [ ] Store anonymized session log in SQLite (`session_logs` table):
  - Fields: `timestamp`, `language`, `urgency`, `facility`, `llm_used`, optional `latency_ms`.

**You (Python/AI):**
- [ ] Test full AI pipeline with 10–15 sample inputs (Hindi + English).
- [ ] Tune rules and prompts for clarity and conservative behaviour.
- [ ] Ensure that **LLM never changes urgency/facility** (only text around them).

---

### Day 4 — /metrics + Fallback Mode + Polish

**Teammate (Web/Node):**
- [ ] Implement `GET /metrics` in Node:
  - Aggregate `total_sessions`, `low_count`, `medium_count`, `high_count`, `llm_used_count` from the SQLite `session_logs` table.
- [ ] Add offline fallback page (static HTML) showing 108/102/104 numbers.
- [ ] Add disclaimer component to all result views.

**You (Python/AI):**
- [ ] Implement fallback mode in Flask:
  - If LLM not available, run keyword-only extraction + rules + template explanation.
  - Ensure same response shape to Node in both modes.
- [ ] Add health-check route in Flask (for Node to verify connectivity).

**Both:**
- [ ] Test end-to-end flow:
  1. Open app → select Hindi.
  2. Tap mic → say "2 din se tez bukhar, saas lene mein takleef".
  3. Confirm transcript.
  4. See RED urgency + "District Hospital / Call 108".
  5. Show `/metrics` in Postman/browser.
- [ ] Mobile responsive tuning using Bootstrap grid.

---

### Day 5 — Deploy + Demo Video + Submission

- [ ] Deploy Node backend on Render.com (free tier).
- [ ] Deploy Python Flask on Render.com (free tier) or Railway.app.
- [ ] Host frontend on GitHub Pages or Netlify (static).
- [ ] If deployment is difficult, prepare local demo (Node + Flask running on a laptop).
- [ ] Record 2–3 minute demo video:
  - Show Hindi voice input (HIGH urgency case).
  - Show LOW urgency case (home care).
  - Show `/metrics` endpoint with some sample data.
- [ ] Final README with architecture diagram, safety architecture, metrics, and link to video.
- [ ] Finalize AMD Slingshot submission form with one-line pitch, USP, safety story, and edge framing.

---

## What’s Different (USP)

- **Voice-first + Hindi-first:** Designed around voice input and simple Hindi/English phrases for rural India.
- **Deterministic-first safety:** Urgency and facility are always decided by transparent rules; LLM is never trusted with medical decisions.
- **LLM optional for extraction/explanation only:** AI helps understand and explain, not to diagnose or prescribe.
- **Offline-friendly + low-cost:** Works on low-resource CPUs with optional cloud LLM; has a fallback mode when offline or when LLM is unavailable.

---

## The 3 Demo Scenarios to Prepare

### Scenario 1 — HIGH Urgency (Most Impressive)
> Input: "Meri chati mein dard ho raha hai aur saas lene mein bahut takleef hai"  
> Output: RED badge, "Emergency — Call 108 immediately", District Hospital

### Scenario 2 — MEDIUM Urgency
> Input: "2 din se bukhar hai, thoda sir dard bhi hai"  
> Output: YELLOW badge, "Visit PHC within 24 hours"

### Scenario 3 — LOW Urgency
> Input: "Halki khansi hai, 1 din se, koi aur takleef nahi"  
> Output: GREEN badge, "Home care, rest and fluids. Visit PHC if it worsens."

---

## Triage Rules (Core 20 — You implement these)

```json
[
  { "id": "RF-001", "symptoms": ["chest_pain", "breathlessness"], "urgency": "HIGH", "care": "EMERGENCY" },
  { "id": "RF-002", "symptoms": ["loss_of_consciousness"], "urgency": "HIGH", "care": "EMERGENCY" },
  { "id": "RF-003", "symptoms": ["seizures"], "urgency": "HIGH", "care": "EMERGENCY" },
  { "id": "RF-004", "symptoms": ["severe_bleeding"], "urgency": "HIGH", "care": "EMERGENCY" },
  { "id": "RF-005", "symptoms": ["stroke_signs"], "urgency": "HIGH", "care": "EMERGENCY" },
  { "id": "RF-006", "symptoms": ["high_fever_infant"], "urgency": "HIGH", "care": "DISTRICT_HOSPITAL" },
  { "id": "RF-007", "symptoms": ["pregnancy_danger_signs"], "urgency": "HIGH", "care": "EMERGENCY" },
  { "id": "RF-008", "symptoms": ["snake_bite"], "urgency": "HIGH", "care": "EMERGENCY" },
  { "id": "GEN-001", "symptoms": ["fever"], "duration_gt_days": 3, "urgency": "MEDIUM", "care": "PHC" },
  { "id": "GEN-002", "symptoms": ["fever", "cough"], "urgency": "MEDIUM", "care": "PHC" },
  { "id": "GEN-003", "symptoms": ["severe_abdominal_pain"], "urgency": "HIGH", "care": "CHC" },
  { "id": "GEN-004", "symptoms": ["vomiting", "diarrhea"], "duration_gt_days": 1, "urgency": "MEDIUM", "care": "PHC" },
  { "id": "GEN-005", "symptoms": ["headache", "fever", "stiff_neck"], "urgency": "HIGH", "care": "EMERGENCY" },
  { "id": "GEN-006", "symptoms": ["cough"], "duration_gt_days": 14, "urgency": "MEDIUM", "care": "PHC" },
  { "id": "GEN-007", "symptoms": ["chest_pain"], "urgency": "HIGH", "care": "EMERGENCY" },
  { "id": "GEN-008", "symptoms": ["difficulty_breathing"], "urgency": "HIGH", "care": "EMERGENCY" },
  { "id": "GEN-009", "symptoms": ["mild_fever"], "duration_lt_days": 2, "urgency": "LOW", "care": "HOME" },
  { "id": "GEN-010", "symptoms": ["cough", "cold"], "duration_lt_days": 3, "urgency": "LOW", "care": "HOME" },
  { "id": "GEN-011", "symptoms": ["body_ache"], "urgency": "LOW", "care": "HOME" },
  { "id": "DEFAULT", "symptoms": ["unknown"], "urgency": "MEDIUM", "care": "PHC" }
]
```

---

## LLM Prompt Templates (You own these)

### Extraction Prompt
```
You are a medical entity extractor for a rural healthcare app in India.
Extract ONLY what is explicitly mentioned. Do NOT infer or diagnose.

From this patient description: "{text}"

Return ONLY this JSON:
{
  "primary_symptom": "",
  "duration_value": null,
  "duration_unit": "",
  "severity": "mild|moderate|severe",
  "associated_symptoms": [],
  "red_flag_keywords": []
}

If something is not mentioned, use null. Never add symptoms not stated.
```

### Explanation Prompt (Hindi)
```
You are a healthcare communication assistant for rural India.
Explain this triage result in simple Hindi. Max 60 words.

Urgency: {urgency}
Recommended care: {care_level}
Reason: {reasoning}

Rules:
- Use simple Hindi words
- Do NOT name any disease
- Do NOT suggest any medicine
- Be calm and clear
- End with: "Yeh diagnosis nahi hai. Gambhir sthiti mein 108 par call karein."
```

---

## Submission Form — Copy-Paste Ready

### What is your idea about?
ArogyaSaarthi AI is a voice-first web app that helps rural Indians navigate the healthcare system. Users speak their symptoms in Hindi or English, and the app uses AI to structure those symptoms, then applies deterministic rule-based triage logic to classify urgency (Low / Medium / High) and guide them to the right care level — home care, PHC, CHC, District Hospital, or emergency (108). No diagnosis. No prescriptions. Just clear, safe navigation in simple language for people who need it most.

### What problem are you trying to solve?
65% of India lives in rural areas but only about a quarter of healthcare infrastructure is there. Patients don't know when symptoms are serious — they either delay care for real emergencies or travel 20+ km unnecessarily for minor issues. ASHA workers lack tools to explain referral urgency. District hospitals are overwhelmed with cases PHCs could handle. ArogyaSaarthi solves the information gap — not by diagnosing, but by helping people understand where to go and when, in their own language, on any basic smartphone.

### Technology Stack
HTML5, CSS3, Bootstrap 5, Vanilla JavaScript, Web Speech API, Node.js, Express.js, SQLite (file-based anonymized session logs only), Python, Flask, Optional OpenAI / Gemini API (explanation/extraction only), **deterministic rule-based triage (rules decide urgency and facility)**, Git/GitHub, Postman/Swagger, Render.com or similar (deployment)

### Impact
Targets hundreds of millions of rural Indians with limited healthcare access. Aims to reduce unnecessary District Hospital visits and improve early referral for emergencies by making urgency understandable in plain language. Supports ASHA workers and frontline staff with structured triage support. Compliant with India's DPDP Act 2023 — **no PII stored; anonymized session logs only**. Designed for 2G connectivity and low-resource CPU devices. Safety-first: urgency classification is always deterministic rule-based logic, never AI-driven; optional LLMs are used only to extract and explain.

---

## Why This Wins

| Judge Criteria | How ArogyaSaarthi Delivers |
|----------------|---------------------------|
| Real-world impact | Rural India, real referral confusion, supports ASHA workers |
| Responsible AI | Rules decide urgency; LLM only extracts/ explains — no hallucinated decisions |
| Technical depth | Clean separation: Node gateway + Python AI + deterministic rules + metrics |
| Innovation | Voice-first, Hindi-first, low-bandwidth PWA with offline-friendly fallback |
| Feasibility | Uses well-known stacks (Node, Flask, SQLite) and can run on a single low-cost VM or laptop |
| Social good | Aligns with NHA, ASHA program, PHC referral system |
| Safety | Output validation, blocked terms, conservative MEDIUM + PHC defaults when uncertain |

---

## GitHub Repo Checklist

- [ ] Clean README with architecture diagram and one-line pitch
- [ ] Live demo link (or clear local demo instructions)
- [ ] Demo video link (2–3 min)
- [ ] All 3 demo scenarios documented
- [ ] `.env.example` (no real keys committed)
- [ ] Requirements files (`package.json`, Python requirements, basic deployment notes)

---

## Emergency Contacts Always Shown in App

| Service | Number |
|---------|--------|
| Ambulance | 108 |
| Medical Helpline | 104 |
| Women Helpline | 181 |

---

Built with safety, transparency, and accessibility at the core.

*Built for India. Designed for Bharat.*


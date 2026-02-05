# ArogyaSaarthi AI – System Design Document

## Voice-First Rural Healthcare Navigator
---

## 1. High-Level System Architecture

### 1.1 Architecture Overview

ArogyaSaarthi AI is designed as a serverless, event-driven web application optimized for low-bandwidth environments and safety-critical healthcare navigation. The architecture enforces strict separation between AI-assisted processing and rule-based medical decision logic.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER LAYER                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Progressive Web App (PWA)                         │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐    │    │
│  │  │ Voice Input  │  │ Text Fallback│  │ Results Display        │    │    │
│  │  │ (Microphone) │  │              │  │ (Urgency + Guidance)   │    │    │
│  │  └──────────────┘  └──────────────┘  └────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Amazon API Gateway                                │    │
│  │                    (REST API + WebSocket for streaming)              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PROCESSING LAYER                                   │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────────┐    │
│  │ Speech-to-Text │  │ NLP Symptom    │  │ Rule-Based Triage Engine  │    │
│  │ (Transcribe)   │──▶│ Extraction     │──▶│ (Deterministic Logic)     │    │
│  │                │  │ (Lambda)       │  │ (Lambda)                  │    │
│  └────────────────┘  └────────────────┘  └─────────────┬──────────────┘    │
│                                                        │                    │
│                                                        ▼                    │
│                              ┌────────────────────────────────────────┐    │
│                              │ Explanation Generator (Bedrock LLM)    │    │
│                              │ - Templated prompts only               │    │
│                              │ - Output validation enforced           │    │
│                              └────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DATA LAYER                                        │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────────┐    │
│  │ Session Cache  │  │ Triage Rules   │  │ Audit Logs                │    │
│  │ (ElastiCache)  │  │ (DynamoDB)     │  │ (CloudWatch + S3)         │    │
│  └────────────────┘  └────────────────┘  └────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```


### 1.2 Core Design Principles

| Principle | Implementation |
|-----------|----------------|
| Safety-First | Rule-based triage; LLM never makes medical decisions |
| Stateless Processing | No persistent user data; session-scoped only |
| Graceful Degradation | Text fallback if voice fails; template fallback if LLM fails |
| Low-Bandwidth Optimized | PWA caching; compressed payloads; minimal round trips |
| Audit Trail | All AI interactions logged for safety review |

### 1.3 User Interaction Flow

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  User   │    │  Voice  │    │ Symptom │    │ Triage  │    │Guidance │
│ Speaks  │───▶│Transcribed───▶│Structured───▶│ Rules   │───▶│Displayed│
│         │    │         │    │         │    │ Applied │    │         │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
     │              │              │              │              │
     │              │              │              │              │
   [User]        [AI:STT]      [AI:NLP]      [RULES]      [AI:LLM]
                                                          (explain only)
```

**Key Boundary:** AI assists with understanding (STT, NLP) and explaining (LLM). Medical urgency classification is strictly rule-based.

---

## 2. Component-Level Design

### 2.1 Frontend – Progressive Web App

**Technology Stack:**
- Framework: React 18 with TypeScript
- State Management: Zustand (lightweight)
- Styling: Tailwind CSS (utility-first, small bundle)
- Voice: Web Speech API + MediaRecorder API
- PWA: Workbox for service worker management

**Key Components:**

```
src/
├── components/
│   ├── VoiceRecorder/
│   │   ├── RecordButton.tsx       # Large, accessible record button
│   │   ├── WaveformVisualizer.tsx # Recording feedback
│   │   └── TranscriptConfirm.tsx  # User confirms transcription
│   ├── SymptomFlow/
│   │   ├── ClarifyingQuestion.tsx # Follow-up questions (max 3)
│   │   └── SymptomSummary.tsx     # Structured symptom display
│   ├── Results/
│   │   ├── UrgencyBadge.tsx       # Color-coded urgency (G/Y/R)
│   │   ├── GuidanceCard.tsx       # Care level recommendation
│   │   ├── ExplanationPanel.tsx   # Simple language reasoning
│   │   └── ShareSummary.tsx       # Exportable summary
│   └── Common/
│       ├── LanguageSelector.tsx   # Language picker
│       ├── Disclaimer.tsx         # Always-visible disclaimer
│       └── EmergencyBanner.tsx    # 108 prominent display
├── hooks/
│   ├── useVoiceRecording.ts       # Microphone handling
│   ├── useSession.ts              # Session state management
│   └── useOfflineStatus.ts        # Connectivity detection
├── services/
│   ├── api.ts                     # Backend communication
│   └── audioProcessor.ts          # Audio compression
└── i18n/
    ├── hi.json                    # Hindi translations
    └── en.json                    # English translations
```


**Accessibility Requirements:**
- Minimum touch target: 48x48 dp
- Color contrast ratio: 4.5:1 minimum
- Font size: 16px minimum, scalable
- Voice feedback for all actions
- No time-limited interactions

**Offline Capabilities:**
- UI shell cached via service worker
- Language files cached locally
- Graceful error when API unavailable
- Queue voice recordings for retry (optional, Phase 2)

### 2.2 Backend Services

**Service Architecture:** Serverless, Lambda-based microservices

```
┌─────────────────────────────────────────────────────────────────┐
│                    API Gateway (REST)                            │
│  POST /session/start      - Initialize session                   │
│  POST /voice/transcribe   - Submit audio for STT                 │
│  POST /symptoms/process   - Process transcribed symptoms         │
│  POST /triage/classify    - Get urgency classification           │
│  GET  /session/{id}       - Retrieve session state               │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ Transcription │    │   Symptom     │    │    Triage     │
│   Service     │    │   Processor   │    │    Engine     │
│   (Lambda)    │    │   (Lambda)    │    │   (Lambda)    │
└───────────────┘    └───────────────┘    └───────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│    Amazon     │    │    Amazon     │    │   DynamoDB    │
│  Transcribe   │    │    Bedrock    │    │  (Rules DB)   │
└───────────────┘    └───────────────┘    └───────────────┘
```

**Lambda Functions:**

| Function | Purpose | Timeout | Memory |
|----------|---------|---------|--------|
| `transcription-handler` | Orchestrates STT via Transcribe | 30s | 512 MB |
| `symptom-processor` | NLP entity extraction | 15s | 1024 MB |
| `triage-engine` | Rule-based classification | 5s | 256 MB |
| `explanation-generator` | LLM-based explanation | 20s | 512 MB |
| `session-manager` | Session state handling | 5s | 256 MB |

### 2.3 AI Processing Layer

**Separation of Concerns:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI-ASSISTED (Flexible)                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Speech-to-Text: Convert voice to text                   │    │
│  │ NLP Extraction: Identify symptom entities               │    │
│  │ Explanation: Generate simple language guidance          │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    RULE-BASED (Deterministic)                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Urgency Classification: Low / Medium / High             │    │
│  │ Care Level Mapping: Home → PHC → CHC → DH → Emergency   │    │
│  │ Red-Flag Detection: Predefined symptom patterns         │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 2.4 Rule-Based Triage Engine

**Design Philosophy:** The triage engine is intentionally simple, auditable, and deterministic. No machine learning is used for classification.

**Rule Structure:**
```json
{
  "ruleId": "RF-001",
  "name": "Chest Pain with Breathlessness",
  "version": "1.0",
  "conditions": {
    "symptoms": ["chest_pain", "breathlessness"],
    "operator": "AND"
  },
  "output": {
    "urgency": "HIGH",
    "careLevel": "EMERGENCY",
    "action": "CALL_108"
  },
  "metadata": {
    "source": "WHO Emergency Triage Guidelines",
    "approvedBy": "Dr. [Clinical Reviewer]",
    "approvedDate": "2026-01-15"
  }
}
```


**Rule Categories:**

| Category | Rule Count | Examples |
|----------|------------|----------|
| Red-Flag (Auto-High) | ~25 | Chest pain, stroke signs, severe bleeding |
| Pediatric | ~30 | High fever in infants, dehydration signs |
| Maternal | ~20 | Pregnancy danger signs, postpartum bleeding |
| General | ~50 | Fever duration, pain severity thresholds |
| Default | 1 | Unknown symptoms → Medium (seek PHC) |

**Classification Logic:**
```python
def classify_urgency(structured_symptoms: dict) -> TriageResult:
    # Step 1: Check red-flag symptoms (highest priority)
    for symptom in structured_symptoms.get("symptoms", []):
        if symptom in RED_FLAG_SYMPTOMS:
            return TriageResult(urgency="HIGH", care_level="EMERGENCY")
    
    # Step 2: Apply rule matching
    matched_rules = match_rules(structured_symptoms)
    
    if not matched_rules:
        # Default: recommend PHC visit for unknown patterns
        return TriageResult(urgency="MEDIUM", care_level="PHC")
    
    # Step 3: Return highest urgency from matched rules
    return max(matched_rules, key=lambda r: r.urgency_score)
```

### 2.5 Notification & Guidance System

**Guidance Output Structure:**
```json
{
  "sessionId": "uuid",
  "timestamp": "2026-02-05T10:30:00Z",
  "urgency": {
    "level": "MEDIUM",
    "color": "YELLOW",
    "label": "जल्द डॉक्टर से मिलें"
  },
  "careLevel": {
    "recommended": "PHC",
    "displayName": "प्राथमिक स्वास्थ्य केंद्र",
    "timeframe": "24 घंटे के भीतर"
  },
  "explanation": {
    "text": "आपके लक्षण गंभीर नहीं लगते, लेकिन डॉक्टर से जांच करवाना अच्छा रहेगा।",
    "reasoning": ["बुखार 2 दिन से है", "खांसी के साथ"]
  },
  "actions": [
    {"type": "PRIMARY", "label": "नजदीकी PHC खोजें", "action": "FIND_PHC"},
    {"type": "SECONDARY", "label": "सारांश साझा करें", "action": "SHARE"}
  ],
  "disclaimer": "यह चिकित्सा निदान नहीं है। गंभीर स्थिति में 108 पर कॉल करें।"
}
```

---

## 3. AI Architecture

### 3.1 Speech-to-Text Pipeline

**Service:** Amazon Transcribe with Indian language models

**Supported Languages (Phase 1):**
- Hindi (hi-IN)
- English (en-IN)

**Audio Processing Flow:**
```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Record  │    │ Compress │    │  Upload  │    │Transcribe│
│  Audio   │───▶│  (Opus)  │───▶│  to S3   │───▶│  (Async) │
│          │    │          │    │          │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                     │
                                                     ▼
                                              ┌──────────┐
                                              │  Return  │
                                              │  Text +  │
                                              │Confidence│
                                              └──────────┘
```

**Configuration:**
```json
{
  "TranscriptionJobName": "arogyasaarthi-{sessionId}",
  "LanguageCode": "hi-IN",
  "MediaFormat": "ogg",
  "Settings": {
    "ShowSpeakerLabels": false,
    "MaxSpeakerLabels": 1,
    "VocabularyName": "arogyasaarthi-medical-vocab"
  }
}
```

**Custom Vocabulary:** Medical terms in Hindi/English for improved accuracy
- Common symptoms: बुखार (fever), सिरदर्द (headache), खांसी (cough)
- Body parts: छाती (chest), पेट (stomach), सिर (head)
- Severity terms: तेज़ (severe), हल्का (mild), बहुत (very)


### 3.2 NLP Symptom Structuring

**Approach:** Entity extraction using Amazon Bedrock (Claude) with strict prompting

**Entity Schema:**
```json
{
  "primaryComplaint": {
    "symptom": "fever",
    "localTerm": "बुखार",
    "confidence": 0.95
  },
  "duration": {
    "value": 2,
    "unit": "days",
    "confidence": 0.88
  },
  "severity": {
    "level": "moderate",
    "selfReported": "तेज़ बुखार",
    "confidence": 0.82
  },
  "associatedSymptoms": [
    {"symptom": "cough", "confidence": 0.90},
    {"symptom": "body_ache", "confidence": 0.75}
  ],
  "redFlagsDetected": [],
  "extractionConfidence": 0.85
}
```

**NLP Prompt Template:**
```
You are a medical entity extractor. Extract ONLY the following from the patient's description:
- Primary symptom
- Duration (if mentioned)
- Severity (if mentioned)
- Associated symptoms

DO NOT:
- Suggest any diagnosis
- Infer symptoms not explicitly mentioned
- Add medical interpretations

Input: "{transcribed_text}"

Output JSON only. If information is not present, use null.
```

### 3.3 Rule-Based Urgency Classification

**Classification Matrix:**

| Urgency | Criteria | Care Level | Response Time |
|---------|----------|------------|---------------|
| HIGH | Red-flag symptoms present OR multiple severe symptoms | Emergency / District Hospital | Immediate |
| MEDIUM | Moderate symptoms OR duration > threshold OR uncertain | PHC / CHC | Within 24 hours |
| LOW | Mild symptoms, short duration, no red flags | Home care / Routine PHC | 2-3 days |

**Red-Flag Symptom List (Partial):**
```python
RED_FLAG_SYMPTOMS = {
    "chest_pain_with_breathlessness",
    "sudden_severe_headache",
    "loss_of_consciousness",
    "difficulty_breathing",
    "high_fever_infant",  # >103°F in <5 years
    "seizures",
    "severe_bleeding",
    "stroke_signs",  # FAST criteria
    "severe_abdominal_pain",
    "pregnancy_danger_signs",
    "snake_bite",
    "poisoning",
    "severe_burns"
}
```

### 3.4 LLM Usage Boundaries

**Permitted Uses:**

| Use Case | Input | Output | Guardrails |
|----------|-------|--------|------------|
| Explanation Generation | Structured triage result | Simple language explanation | Template-constrained |
| Translation | English guidance | Regional language | Vocabulary-limited |
| Clarifying Questions | Missing entities | Follow-up question | Max 3 questions |

**Prohibited Uses:**
- ❌ Symptom interpretation beyond extraction
- ❌ Urgency level determination
- ❌ Treatment or medication suggestions
- ❌ Diagnosis inference
- ❌ Prognosis statements

**LLM Prompt for Explanation:**
```
You are a healthcare communication assistant. Your ONLY job is to explain the following triage result in simple, non-medical language.

Triage Result:
- Urgency: {urgency_level}
- Recommended Care: {care_level}
- Reasoning: {rule_based_reasoning}

Rules:
1. Use simple words a person with basic education can understand
2. Do NOT mention any disease names or diagnoses
3. Do NOT suggest any medications
4. Do NOT change the urgency level or care recommendation
5. Be reassuring but clear about the need for care
6. Keep response under 100 words

Language: {target_language}
```

### 3.5 Safety Guardrails

**Multi-Layer Safety Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 1: Input Validation                     │
│  - Audio length limits (60s max)                                │
│  - Language detection                                           │
│  - Profanity/abuse filtering                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 2: NLP Constraints                      │
│  - Entity extraction only (no inference)                        │
│  - Confidence thresholds (reject <0.6)                          │
│  - Unknown symptom handling → default to MEDIUM                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 3: Triage Rules                         │
│  - Deterministic rule matching                                  │
│  - Red-flag override (always HIGH)                              │
│  - Conservative default (when uncertain → escalate)             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 4: Output Validation                    │
│  - LLM output filtering (block diagnosis terms)                 │
│  - Response template enforcement                                │
│  - Disclaimer injection (always present)                        │
└─────────────────────────────────────────────────────────────────┘
```


**Output Validation Rules:**
```python
BLOCKED_TERMS = [
    "diagnosis", "diagnosed", "disease", "condition",
    "medicine", "medication", "tablet", "prescription",
    "treatment", "cure", "therapy",
    # Hindi equivalents
    "बीमारी", "दवाई", "गोली", "इलाज"
]

def validate_llm_output(response: str) -> tuple[bool, str]:
    # Check for blocked terms
    for term in BLOCKED_TERMS:
        if term.lower() in response.lower():
            return False, f"Blocked term detected: {term}"
    
    # Check response length
    if len(response.split()) > 150:
        return False, "Response too long"
    
    # Ensure disclaimer placeholder exists
    if "{disclaimer}" not in response and "disclaimer" not in response.lower():
        return False, "Missing disclaimer"
    
    return True, "Valid"
```

---

## 4. AWS Services Mapping

### 4.1 Complete AWS Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AWS Cloud (ap-south-1)                          │
│                                                                              │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────────────────┐   │
│  │ CloudFront  │────▶│     S3      │     │      Route 53               │   │
│  │   (CDN)     │     │ (Static PWA)│     │   (DNS Management)          │   │
│  └─────────────┘     └─────────────┘     └─────────────────────────────┘   │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        API Gateway                                   │   │
│  │                    (REST + WebSocket)                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         AWS Lambda                                   │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │ Transcription│  │   Symptom    │  │      Triage Engine       │  │   │
│  │  │   Handler    │  │  Processor   │  │   (Rule Evaluation)      │  │   │
│  │  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘  │   │
│  │         │                 │                       │                 │   │
│  └─────────┼─────────────────┼───────────────────────┼─────────────────┘   │
│            │                 │                       │                      │
│            ▼                 ▼                       ▼                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────────┐ │
│  │   Amazon     │  │   Amazon     │  │          DynamoDB                │ │
│  │  Transcribe  │  │   Bedrock    │  │  ┌────────────┐ ┌─────────────┐ │ │
│  │  (STT)       │  │  (Claude)    │  │  │Triage Rules│ │Session State│ │ │
│  └──────────────┘  └──────────────┘  │  └────────────┘ └─────────────┘ │ │
│                                       └──────────────────────────────────┘ │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────────┐ │
│  │ ElastiCache  │  │  CloudWatch  │  │           S3                     │ │
│  │  (Redis)     │  │  (Logging)   │  │  (Audio temp storage)            │ │
│  │ Session Cache│  │              │  │  (Audit logs archive)            │ │
│  └──────────────┘  └──────────────┘  └──────────────────────────────────┘ │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐                                        │
│  │   Cognito    │  │     WAF      │                                        │
│  │ (ASHA/ANM    │  │  (Security)  │                                        │
│  │  Auth - P2)  │  │              │                                        │
│  └──────────────┘  └──────────────┘                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Service Configuration

| Service | Purpose | Configuration |
|---------|---------|---------------|
| **CloudFront** | CDN for PWA | Edge locations in India; HTTPS only |
| **S3** | Static hosting + audio temp | Lifecycle: delete audio after 1 hour |
| **API Gateway** | REST API | Throttling: 1000 req/sec; 10 MB payload |
| **Lambda** | Compute | ARM64; ap-south-1; VPC for Bedrock |
| **Transcribe** | Speech-to-text | hi-IN, en-IN; custom vocabulary |
| **Bedrock** | LLM (Claude 3 Haiku) | Explanation generation only |
| **DynamoDB** | Rules + sessions | On-demand capacity; TTL for sessions |
| **ElastiCache** | Session caching | Redis; single node (dev); cluster (prod) |
| **CloudWatch** | Monitoring + logs | 30-day retention; custom metrics |
| **Cognito** | Auth (Phase 2) | ASHA/ANM user pools |
| **WAF** | Security | Rate limiting; geo-restriction (India) |


### 4.3 Amazon Bedrock Configuration

**Model Selection:** Claude 3 Haiku (anthropic.claude-3-haiku-20240307-v1:0)
- Rationale: Fast inference, cost-effective, sufficient for explanation generation
- Region: ap-south-1 (Mumbai)

**Guardrails Configuration:**
```json
{
  "guardrailIdentifier": "arogyasaarthi-safety",
  "guardrailVersion": "1",
  "contentPolicyConfig": {
    "filtersConfig": [
      {"type": "HATE", "inputStrength": "HIGH", "outputStrength": "HIGH"},
      {"type": "INSULTS", "inputStrength": "HIGH", "outputStrength": "HIGH"},
      {"type": "SEXUAL", "inputStrength": "HIGH", "outputStrength": "HIGH"},
      {"type": "VIOLENCE", "inputStrength": "MEDIUM", "outputStrength": "HIGH"}
    ]
  },
  "wordPolicyConfig": {
    "wordsConfig": [
      {"text": "diagnosis"},
      {"text": "prescription"},
      {"text": "medication"}
    ]
  },
  "topicPolicyConfig": {
    "topicsConfig": [
      {
        "name": "MedicalDiagnosis",
        "definition": "Any attempt to diagnose medical conditions",
        "type": "DENY"
      },
      {
        "name": "TreatmentAdvice",
        "definition": "Any specific treatment or medication recommendations",
        "type": "DENY"
      }
    ]
  }
}
```

---

## 5. Data Flow Explanation

### 5.1 Complete Request Lifecycle

```
Step 1: User Records Voice
────────────────────────────────────────────────────────────────
User taps record button → Browser captures audio via MediaRecorder
→ Audio compressed (Opus codec) → Sent to API Gateway

Step 2: Speech-to-Text
────────────────────────────────────────────────────────────────
API Gateway → Lambda (transcription-handler)
→ Audio uploaded to S3 (temp bucket, 1-hour TTL)
→ Amazon Transcribe job started (async)
→ Poll for completion (max 30s)
→ Return transcribed text + confidence score

Step 3: User Confirms Transcription
────────────────────────────────────────────────────────────────
Frontend displays transcription → User confirms or re-records
→ Confirmed text sent to symptom processor

Step 4: NLP Symptom Extraction
────────────────────────────────────────────────────────────────
Lambda (symptom-processor) → Amazon Bedrock (Claude)
→ Structured entity extraction (symptoms, duration, severity)
→ Confidence scores attached
→ Red-flag keyword scan

Step 5: Rule-Based Triage [NO AI]
────────────────────────────────────────────────────────────────
Lambda (triage-engine) → DynamoDB (rules lookup)
→ Match symptoms against rule conditions
→ Determine urgency level (deterministic)
→ Map to care level

Step 6: Explanation Generation
────────────────────────────────────────────────────────────────
Lambda (explanation-generator) → Amazon Bedrock (Claude)
→ Input: Structured triage result (NOT raw symptoms)
→ Output: Simple language explanation
→ Output validation (block diagnosis terms)
→ Fallback to template if validation fails

Step 7: Response Assembly
────────────────────────────────────────────────────────────────
Combine: Urgency + Care Level + Explanation + Disclaimer
→ Return to frontend
→ Display results with color-coded urgency
→ Log session for audit (anonymized)
```

### 5.2 Data Flow Diagram

```
┌─────────┐
│  User   │
│  Voice  │
└────┬────┘
     │ Audio (Opus, <1MB)
     ▼
┌─────────────────┐
│   API Gateway   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Transcription  │────▶│     Amazon      │
│    Lambda       │     │   Transcribe    │
└────────┬────────┘     └─────────────────┘
         │
         │ Text + Confidence
         ▼
┌─────────────────┐     ┌─────────────────┐
│    Symptom      │────▶│     Amazon      │
│   Processor     │     │    Bedrock      │
│    Lambda       │◀────│   (Extract)     │
└────────┬────────┘     └─────────────────┘
         │
         │ Structured Symptoms
         ▼
┌─────────────────┐     ┌─────────────────┐
│    Triage       │────▶│    DynamoDB     │
│    Engine       │     │    (Rules)      │
│    Lambda       │◀────│                 │
└────────┬────────┘     └─────────────────┘
         │                    ▲
         │ Urgency + Care     │ NO AI HERE
         │ Level              │ (Deterministic)
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Explanation    │────▶│     Amazon      │
│   Generator     │     │    Bedrock      │
│    Lambda       │◀────│   (Explain)     │
└────────┬────────┘     └─────────────────┘
         │
         │ Final Response
         ▼
┌─────────────────┐
│    Frontend     │
│   (Results)     │
└─────────────────┘
```


### 5.3 AI vs Rules Boundary

| Step | Component | AI Used? | Rationale |
|------|-----------|----------|-----------|
| Voice → Text | Transcribe | ✅ Yes | STT requires ML; no medical decision |
| Text → Entities | Bedrock NLP | ✅ Yes | Entity extraction; no inference |
| Entities → Urgency | Triage Engine | ❌ No | Safety-critical; must be deterministic |
| Urgency → Care Level | Triage Engine | ❌ No | Direct mapping; no interpretation |
| Result → Explanation | Bedrock LLM | ✅ Yes | Communication only; decision already made |

---

## 6. Security & Privacy Design

### 6.1 Data Classification

| Data Type | Classification | Retention | Encryption |
|-----------|---------------|-----------|------------|
| Voice audio | Sensitive | 1 hour (processing only) | AES-256 (S3 SSE) |
| Transcribed text | Sensitive | Session only (in-memory) | TLS in transit |
| Structured symptoms | Sensitive | Session only | TLS in transit |
| Triage result | Non-PII | Session only | TLS in transit |
| Audit logs | Anonymized | 90 days | AES-256 (S3 SSE) |
| Triage rules | Non-sensitive | Permanent | N/A |

### 6.2 Encryption Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    IN TRANSIT                                    │
│  - TLS 1.3 enforced on all endpoints                            │
│  - CloudFront HTTPS-only                                        │
│  - API Gateway with TLS termination                             │
│  - VPC endpoints for internal AWS service communication         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    AT REST                                       │
│  - S3: SSE-S3 (AES-256) for audio files                         │
│  - DynamoDB: AWS-managed encryption                             │
│  - CloudWatch Logs: Encrypted by default                        │
│  - ElastiCache: Encryption at rest enabled                      │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 Minimal Data Storage Policy

**Principle:** Collect nothing; store nothing; process and discard.

```python
# Session lifecycle
SESSION_TTL = 3600  # 1 hour max session duration

class SessionManager:
    def create_session(self) -> str:
        session_id = str(uuid.uuid4())
        # Store only session_id and timestamp
        # NO user identifiers, NO device info, NO location
        self.cache.set(
            session_id,
            {"created_at": datetime.utcnow().isoformat()},
            ex=SESSION_TTL
        )
        return session_id
    
    def end_session(self, session_id: str):
        # Explicit cleanup
        self.cache.delete(session_id)
        # Audio already deleted by S3 lifecycle
```

### 6.4 Role-Based Access Control (Phase 2)

| Role | Access Level | Authentication |
|------|--------------|----------------|
| Anonymous User | Basic triage flow | None required |
| ASHA Worker | + Session history (local) | Cognito (phone OTP) |
| ANM | + Patient-on-behalf flow | Cognito (phone OTP) |
| PHC Doctor | + Aggregate view | Cognito (email + MFA) |
| Admin | + Rule management | Cognito (email + MFA) + IAM |

### 6.5 Compliance Readiness

**Digital Personal Data Protection Act, 2023:**
- ✅ Data minimization: No PII collected
- ✅ Purpose limitation: Healthcare navigation only
- ✅ Storage limitation: Session-scoped, auto-deleted
- ✅ Consent: Implicit (user initiates interaction)
- ✅ Data localization: ap-south-1 (Mumbai) only

**Audit Trail:**
```json
{
  "auditLog": {
    "sessionId": "uuid (anonymized)",
    "timestamp": "ISO8601",
    "language": "hi-IN",
    "urgencyClassified": "MEDIUM",
    "careLevelRecommended": "PHC",
    "rulesTriggered": ["GEN-015", "GEN-022"],
    "llmUsed": true,
    "llmValidationPassed": true,
    "responseTimeMs": 4500
  }
}
```

---

## 7. Scalability & Reliability

### 7.1 Stateless Design

**Principles:**
- No server-side session affinity
- All state in ElastiCache (Redis) with TTL
- Lambda functions are stateless and horizontally scalable
- DynamoDB on-demand scaling

**Request Independence:**
```
Request 1 → Lambda Instance A → Response
Request 2 → Lambda Instance B → Response  (different instance, same result)
Request 3 → Lambda Instance A → Response  (same instance, no state dependency)
```


### 7.2 Scaling Strategy

| Component | Scaling Mechanism | Limits |
|-----------|-------------------|--------|
| CloudFront | Auto (edge network) | Unlimited |
| API Gateway | Auto | 10,000 req/sec (soft limit) |
| Lambda | Concurrent executions | 1,000 default → 10,000 (request increase) |
| Transcribe | Concurrent jobs | 250 default → 500 (request increase) |
| Bedrock | Tokens per minute | Model-specific; request quota increase |
| DynamoDB | On-demand | Unlimited (auto-scaling) |
| ElastiCache | Cluster mode | Scale nodes as needed |

**Projected Capacity:**

| Phase | Concurrent Users | Daily Sessions | Infrastructure |
|-------|------------------|----------------|----------------|
| Pilot | 100 | 1,000 | Single region, minimal |
| Launch | 10,000 | 50,000 | Single region, scaled |
| Scale | 100,000 | 500,000 | Multi-AZ, reserved capacity |

### 7.3 Regional Language Scaling

**Phase 1 (Launch):**
- Hindi (hi-IN)
- English (en-IN)

**Phase 2 (6 months):**
- Tamil (ta-IN)
- Telugu (te-IN)
- Marathi (mr-IN)
- Bengali (bn-IN)

**Implementation:**
```python
LANGUAGE_CONFIG = {
    "hi-IN": {
        "transcribe_model": "hi-IN",
        "bedrock_prompt_template": "prompts/hi-IN.txt",
        "ui_translations": "i18n/hi.json",
        "custom_vocabulary": "vocab/hi-medical.txt"
    },
    "en-IN": {
        "transcribe_model": "en-IN",
        "bedrock_prompt_template": "prompts/en-IN.txt",
        "ui_translations": "i18n/en.json",
        "custom_vocabulary": "vocab/en-medical.txt"
    }
    # Add new languages without code changes
}
```

### 7.4 Fault Tolerance

**Multi-AZ Deployment:**
```
┌─────────────────────────────────────────────────────────────────┐
│                    ap-south-1 (Mumbai)                           │
│  ┌─────────────────────┐    ┌─────────────────────┐             │
│  │        AZ-1         │    │        AZ-2         │             │
│  │  ┌───────────────┐  │    │  ┌───────────────┐  │             │
│  │  │    Lambda     │  │    │  │    Lambda     │  │             │
│  │  │   (Active)    │  │    │  │   (Active)    │  │             │
│  │  └───────────────┘  │    │  └───────────────┘  │             │
│  │  ┌───────────────┐  │    │  ┌───────────────┐  │             │
│  │  │  ElastiCache  │  │    │  │  ElastiCache  │  │             │
│  │  │   (Primary)   │◀─┼────┼─▶│   (Replica)   │  │             │
│  │  └───────────────┘  │    │  └───────────────┘  │             │
│  └─────────────────────┘    └─────────────────────┘             │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              DynamoDB (Global Tables - Future)              ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

**Fallback Chain:**
```
Voice Input Failed?
    └─▶ Offer text input fallback

Transcribe Failed?
    └─▶ Retry (3x) → Text input fallback

NLP Extraction Failed?
    └─▶ Ask clarifying questions → Manual symptom selection

Triage Rules Failed?
    └─▶ Default to MEDIUM urgency (conservative)

LLM Explanation Failed?
    └─▶ Use pre-written template explanation

Complete System Failure?
    └─▶ Display emergency numbers (108, 102) + offline guidance
```

---

## 8. Failure & Risk Handling

### 8.1 AI Confidence Thresholds

| Component | Confidence Threshold | Action if Below |
|-----------|---------------------|-----------------|
| Speech-to-Text | 0.70 | Show transcription for user correction |
| Entity Extraction | 0.60 | Ask clarifying question |
| Symptom Mapping | 0.50 | Use "unknown symptom" pathway |
| Overall Session | 0.50 | Recommend PHC visit (conservative) |

**Confidence Handling Logic:**
```python
def handle_low_confidence(extraction_result: dict) -> Action:
    confidence = extraction_result.get("confidence", 0)
    
    if confidence < 0.50:
        # Very low confidence - cannot proceed safely
        return Action(
            type="FALLBACK",
            message="हम आपकी बात समझ नहीं पाए। कृपया PHC जाएं।",
            urgency="MEDIUM"  # Conservative default
        )
    
    if confidence < 0.70:
        # Low confidence - ask for clarification
        return Action(
            type="CLARIFY",
            question=generate_clarifying_question(extraction_result)
        )
    
    # Sufficient confidence - proceed
    return Action(type="PROCEED")
```


### 8.2 Fallback to Human Guidance

**Escalation Triggers:**
- 3 consecutive low-confidence extractions
- User explicitly requests human help
- System detects potential emergency but cannot classify
- Technical failure in critical path

**Fallback Response:**
```json
{
  "fallbackTriggered": true,
  "reason": "low_confidence_repeated",
  "guidance": {
    "primary": "कृपया अपने नजदीकी स्वास्थ्य केंद्र से संपर्क करें",
    "emergency": "आपातकाल में 108 पर कॉल करें",
    "asha": "अपने गांव की आशा कार्यकर्ता से मिलें"
  },
  "contacts": {
    "emergency": "108",
    "ambulance": "102",
    "healthHelpline": "104"
  }
}
```

### 8.3 Error Handling for Low-Quality Input

| Input Issue | Detection | Handling |
|-------------|-----------|----------|
| Background noise | Transcribe confidence <0.5 | Request re-recording in quieter environment |
| Too short (<3 sec) | Audio duration check | Prompt for more detail |
| Too long (>60 sec) | Audio duration check | Truncate + warn user |
| Non-speech audio | Transcribe returns empty | Request voice input |
| Unsupported language | Language detection | Offer supported language options |
| Unintelligible speech | Low entity extraction | Offer text input alternative |

**Error Messages (User-Friendly):**
```json
{
  "errors": {
    "audio_too_short": {
      "hi": "कृपया अपनी तकलीफ के बारे में थोड़ा और बताएं",
      "en": "Please tell us a bit more about your problem"
    },
    "audio_noisy": {
      "hi": "आवाज़ साफ नहीं आई। कृपया शांत जगह पर दोबारा बोलें",
      "en": "We couldn't hear clearly. Please try again in a quieter place"
    },
    "cannot_understand": {
      "hi": "हम समझ नहीं पाए। आप टाइप करके भी बता सकते हैं",
      "en": "We couldn't understand. You can also type your symptoms"
    }
  }
}
```

### 8.4 Risk Mitigation Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| LLM generates diagnosis | Medium | Critical | Output validation + blocked terms |
| False negative (miss emergency) | Low | Critical | Red-flag override + conservative defaults |
| False positive (over-escalate) | Medium | Low | Acceptable; safety > efficiency |
| Transcription error | Medium | Medium | User confirmation step |
| System downtime | Low | High | Multi-AZ + fallback to static guidance |
| Data breach | Low | Critical | No PII stored; encryption everywhere |
| Adversarial input | Low | Medium | Input validation + rate limiting |

---

## 9. Future Enhancements

### 9.1 Government Health System Integration (Phase 3)

**Potential Integrations:**
- **ABHA (Ayushman Bharat Health Account):** Optional health ID linking
- **CoWIN Infrastructure:** Leverage existing API patterns
- **e-Sanjeevani:** Referral handoff to telemedicine
- **HMIS:** Aggregate data reporting (anonymized)

**Integration Architecture:**
```
┌─────────────────────────────────────────────────────────────────┐
│                    ArogyaSaarthi AI                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Integration Layer                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ ABHA Adapter│  │e-Sanjeevani │  │    HMIS Reporter        │ │
│  │ (Optional)  │  │  Handoff    │  │    (Anonymized)         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Government Systems                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │    ABHA     │  │ e-Sanjeevani│  │         HMIS            │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 Analytics Dashboard (Phase 2)

**Metrics for Health Administrators:**
- Symptom pattern trends by region
- Urgency distribution over time
- Referral appropriateness (feedback loop)
- Language usage patterns
- Peak usage times

**Privacy-Preserving Analytics:**
```python
# All analytics are aggregated and anonymized
ANALYTICS_SCHEMA = {
    "date": "2026-02-05",
    "region": "district_code",  # Not village-level
    "symptom_category": "respiratory",  # Category, not specific
    "urgency_distribution": {
        "LOW": 450,
        "MEDIUM": 320,
        "HIGH": 30
    },
    "language_usage": {
        "hi-IN": 650,
        "en-IN": 150
    }
}
```


### 9.3 Offline-First Support (Phase 3)

**Approach:** Progressive enhancement with local-first capabilities

**Offline Capabilities:**
- UI fully cached and functional
- Basic symptom checklist (non-AI)
- Emergency contact information
- Pre-downloaded guidance for common symptoms
- Queue voice recordings for sync when online

**Architecture:**
```
┌─────────────────────────────────────────────────────────────────┐
│                    Offline Mode                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                 Service Worker                           │    │
│  │  - Cache UI shell                                       │    │
│  │  - Cache language files                                 │    │
│  │  - Cache common symptom guidance                        │    │
│  │  - Queue recordings for sync                            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              IndexedDB (Local Storage)                   │    │
│  │  - Symptom checklist data                               │    │
│  │  - Emergency contacts                                   │    │
│  │  - Pending sync queue                                   │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 9.4 ASHA Worker Mobile App (Phase 3)

**Features:**
- Dedicated interface for health workers
- Batch patient symptom recording
- Offline sync for village visits
- Integration with existing ASHA tools
- Simplified reporting

---

## 10. Implementation Roadmap

### Phase 1: MVP (Months 1-3)
- [ ] Core voice-to-triage flow
- [ ] Hindi + English support
- [ ] Basic PWA with offline UI
- [ ] Rule-based triage engine (50 rules)
- [ ] Safety guardrails implementation
- [ ] Pilot deployment (1 district)

### Phase 2: Scale (Months 4-6)
- [ ] 4 additional languages
- [ ] ASHA/ANM authentication
- [ ] Analytics dashboard (basic)
- [ ] Performance optimization
- [ ] Expanded rule set (100+ rules)
- [ ] Multi-district deployment

### Phase 3: Integration (Months 7-12)
- [ ] Government system integration
- [ ] Offline-first capabilities
- [ ] Advanced analytics
- [ ] Feedback loop implementation
- [ ] State-level deployment

---

## 11. Appendix

### A. Technology Stack Summary

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | React 18 + TypeScript | Type safety, ecosystem |
| Styling | Tailwind CSS | Small bundle, utility-first |
| PWA | Workbox | Reliable service worker |
| API | API Gateway + Lambda | Serverless, scalable |
| STT | Amazon Transcribe | Indian language support |
| LLM | Amazon Bedrock (Claude) | Managed, guardrails |
| Database | DynamoDB | Serverless, fast |
| Cache | ElastiCache (Redis) | Session management |
| CDN | CloudFront | Low latency in India |
| Monitoring | CloudWatch | Native integration |

### B. Cost Estimation (Monthly)

| Service | Usage Assumption | Estimated Cost |
|---------|------------------|----------------|
| Lambda | 100K invocations | $20 |
| Transcribe | 50K minutes | $600 |
| Bedrock | 10M tokens | $150 |
| DynamoDB | On-demand | $50 |
| ElastiCache | t3.micro | $25 |
| CloudFront | 100 GB transfer | $15 |
| S3 | 50 GB storage | $5 |
| **Total** | | **~$865/month** |

*Note: Costs scale with usage. Reserved capacity and Savings Plans can reduce costs at scale.*

### C. Security Checklist

- [ ] TLS 1.3 enforced on all endpoints
- [ ] WAF rules configured
- [ ] API rate limiting enabled
- [ ] S3 bucket policies (no public access)
- [ ] Lambda VPC configuration
- [ ] CloudWatch alarms for anomalies
- [ ] Bedrock guardrails active
- [ ] Output validation layer tested
- [ ] Penetration testing completed
- [ ] DPDP compliance review

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | February 5, 2026 | Architecture Team | Initial design |

---


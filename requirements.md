# ArogyaSaarthi AI – Voice-First Rural Healthcare Navigator

## 1. Project Overview

### 1.1 Problem Definition

India's rural healthcare system faces a critical access gap. With over 65% of the population residing in rural areas and only 25% of healthcare infrastructure located there, millions struggle to access timely, appropriate care. Key challenges include:

- **Geographic barriers:** PHCs and CHCs are often 10-30 km away from villages
- **Information asymmetry:** Patients lack knowledge about symptom severity and appropriate care levels
- **Overcrowded facilities:** District hospitals are overwhelmed with cases that could be managed at PHC level
- **Language barriers:** Medical information is rarely available in local languages
- **Low health literacy:** Difficulty understanding when and where to seek care

The result: delayed care for serious conditions, unnecessary travel for minor issues, and an overburdened public health system.

### 1.2 Solution Overview

ArogyaSaarthi AI is a voice-first web application that serves as a healthcare navigation assistant for rural and semi-urban India. It helps users understand their symptoms in simple language and guides them to the appropriate level of care within the government healthcare ecosystem (PHC → CHC → District Hospital).

### 1.3 Objectives

1. **Reduce healthcare navigation friction** for low-literacy populations through voice-based interaction
2. **Enable informed decision-making** about when and where to seek care
3. **Support frontline health workers** (ASHA/ANM) with structured symptom information
4. **Decrease unnecessary burden** on higher-level facilities by appropriate triage guidance
5. **Improve early referral rates** for conditions requiring urgent attention

### 1.4 Scope Boundaries

#### What ArogyaSaarthi AI DOES:
- Accepts voice input describing health concerns in Indian languages
- Structures symptoms into a standardized, shareable format
- Classifies urgency level (Low / Medium / High) using rule-based logic
- Provides guidance on appropriate care level (home care / PHC / CHC / District Hospital / Emergency)
- Explains reasoning in simple, non-medical language
- Generates a summary that can be shared with healthcare providers

#### What ArogyaSaarthi AI does NOT do:
- ❌ Provide medical diagnosis
- ❌ Prescribe medications or treatments
- ❌ Replace emergency services (108/102)
- ❌ Store long-term patient health records
- ❌ Make definitive clinical decisions
- ❌ Operate as a telemedicine platform

---

## 2. Stakeholders & User Personas

### 2.1 Primary Users

#### Persona 1: Rural Patient (Ramesh, 45, Farmer)
- **Location:** Village in Madhya Pradesh, 18 km from nearest PHC
- **Literacy:** Can read Hindi slowly, prefers voice interaction
- **Tech access:** Basic smartphone, intermittent 2G/3G connectivity
- **Healthcare behavior:** Delays seeking care due to travel cost/time; unsure when symptoms are serious
- **Needs:** Understand if symptoms need immediate attention; know which facility to visit
- **Language:** Hindi, Bundeli dialect influence

#### Persona 2: ASHA Worker (Sunita, 32)
- **Role:** Accredited Social Health Activist covering 3 villages (~1,200 population)
- **Literacy:** Class 10 education, comfortable with Hindi text
- **Tech access:** Government-provided smartphone, familiar with basic apps
- **Challenges:** Difficulty explaining referral urgency to patients; limited medical training
- **Needs:** Tool to support home visits; structured information to share with PHC
- **Language:** Hindi

#### Persona 3: ANM (Priya, 28)
- **Role:** Auxiliary Nurse Midwife at Sub-Centre
- **Education:** ANM diploma, basic clinical training
- **Tech access:** Personal smartphone, Sub-Centre has intermittent connectivity
- **Challenges:** High patient load; needs quick triage support
- **Needs:** Pre-structured symptom summaries from patients/ASHAs; decision support for referrals
- **Language:** Hindi, English (medical terms)

### 2.2 Secondary Users

#### Persona 4: PHC Medical Officer (Dr. Sharma, 35)
- **Role:** Solo doctor at PHC covering 30,000 population
- **Challenges:** 80+ OPD patients daily; limited time per patient; many unnecessary visits
- **Needs:** Pre-visit symptom summaries; appropriate referral filtering
- **Language:** Hindi, English

#### Persona 5: Health Administrator (District Health Officer)
- **Role:** Oversees healthcare delivery across district
- **Needs:** Aggregate data on symptom patterns; referral appropriateness metrics
- **Language:** English, Hindi

---

## 3. Functional Requirements

### 3.1 Voice-Based Symptom Input

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-V01 | System shall accept voice input as the primary interaction mode | P0 |
| FR-V02 | Voice recording shall be initiated by a single, clearly visible button | P0 |
| FR-V03 | System shall provide visual feedback during recording (waveform/indicator) | P0 |
| FR-V04 | Maximum single recording duration: 60 seconds | P1 |
| FR-V05 | System shall allow multiple voice inputs in a single session | P1 |
| FR-V06 | Text input shall be available as fallback option | P1 |
| FR-V07 | System shall confirm transcription with user before processing | P0 |

### 3.2 Language Support

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-L01 | Phase 1 languages: Hindi, English | P0 |
| FR-L02 | Phase 2 languages: Tamil, Telugu, Marathi, Bengali, Kannada, Gujarati | P1 |
| FR-L03 | Language selection shall be available at session start | P0 |
| FR-L04 | System shall handle code-mixing (Hindi-English) in voice input | P1 |
| FR-L05 | All UI text and responses shall be in selected language | P0 |
| FR-L06 | Audio playback of responses shall be available | P2 |

### 3.3 Symptom Structuring

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-S01 | System shall extract key symptom information from voice input | P0 |
| FR-S02 | Structured output shall include: primary complaint, duration, severity (self-reported), associated symptoms | P0 |
| FR-S03 | System shall ask clarifying questions if critical information is missing | P0 |
| FR-S04 | Clarifying questions shall be limited to maximum 3 per session | P1 |
| FR-S05 | System shall identify and flag red-flag symptoms from predefined list | P0 |
| FR-S06 | Structured summary shall be displayed for user confirmation | P0 |

### 3.4 Urgency Classification

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-U01 | System shall classify urgency into three levels: Low, Medium, High | P0 |
| FR-U02 | Classification shall be based on rule-based logic, not ML prediction | P0 |
| FR-U03 | Red-flag symptoms shall automatically trigger High urgency | P0 |
| FR-U04 | Urgency level shall be clearly displayed with color coding (Green/Yellow/Red) | P0 |
| FR-U05 | System shall err on the side of higher urgency when uncertain | P0 |

**Urgency Definitions:**
- **Low (Green):** Symptoms manageable with home care or routine PHC visit within 2-3 days
- **Medium (Yellow):** Requires PHC/CHC visit within 24 hours
- **High (Red):** Requires immediate attention; proceed to nearest facility or call emergency services

### 3.5 Triage Guidance

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-T01 | System shall recommend appropriate care level based on urgency | P0 |
| FR-T02 | Care levels: Home Care → PHC → CHC → District Hospital → Emergency (108) | P0 |
| FR-T03 | For High urgency, system shall prominently display emergency number (108) | P0 |
| FR-T04 | System shall provide general guidance, not specific medical advice | P0 |
| FR-T05 | Guidance shall include what to communicate to healthcare provider | P1 |

### 3.6 Explanation & Communication

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-E01 | System shall explain urgency classification reasoning in simple language | P0 |
| FR-E02 | Explanations shall avoid medical jargon; use everyday terms | P0 |
| FR-E03 | System shall explicitly state it is not providing diagnosis | P0 |
| FR-E04 | Disclaimer shall be visible on every result screen | P0 |
| FR-E05 | System shall provide a shareable summary (text/screenshot) for healthcare provider | P1 |

### 3.7 Accessibility Features

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-A01 | UI shall use large, high-contrast buttons and text | P0 |
| FR-A02 | Minimum touch target size: 48x48 dp | P0 |
| FR-A03 | System shall support screen readers | P1 |
| FR-A04 | Visual indicators shall be accompanied by text labels | P0 |
| FR-A05 | System shall function without requiring user registration | P0 |
| FR-A06 | Core flow shall be completable in under 5 minutes | P1 |

### 3.8 Healthcare Worker Support View (Phase 2)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-W01 | ASHA/ANM login with basic authentication | P2 |
| FR-W02 | Ability to record symptoms on behalf of patient | P2 |
| FR-W03 | View history of sessions conducted (local device only) | P2 |
| FR-W04 | Export session summary for PHC reporting | P2 |

---

## 4. Non-Functional Requirements

### 4.1 Safety & Ethical Constraints

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-S01 | System shall never provide specific diagnosis | P0 |
| NFR-S02 | System shall never recommend specific medications | P0 |
| NFR-S03 | System shall always recommend professional consultation for any uncertainty | P0 |
| NFR-S04 | Emergency guidance shall be prioritized over all other outputs | P0 |
| NFR-S05 | System shall undergo clinical safety review before deployment | P0 |
| NFR-S06 | False negative rate for high-urgency conditions shall be minimized (target: <5%) | P0 |

### 4.2 Data Privacy & Compliance

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-P01 | System shall comply with Digital Personal Data Protection Act, 2023 | P0 |
| NFR-P02 | Voice recordings shall not be stored beyond session completion | P0 |
| NFR-P03 | No personally identifiable information (PII) shall be collected by default | P0 |
| NFR-P04 | Session data shall be processed in-memory and discarded | P0 |
| NFR-P05 | If analytics are collected, data shall be anonymized and aggregated | P1 |
| NFR-P06 | Clear privacy notice shall be displayed at session start | P0 |
| NFR-P07 | Data processing shall occur within Indian jurisdiction | P0 |

### 4.3 Performance & Scalability

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-PF01 | Voice-to-text transcription: <5 seconds for 30-second audio | P0 |
| NFR-PF02 | Symptom processing and response: <10 seconds | P0 |
| NFR-PF03 | Initial page load: <3 seconds on 3G connection | P0 |
| NFR-PF04 | System shall support 10,000 concurrent sessions at launch | P1 |
| NFR-PF05 | System shall scale to 100,000 concurrent sessions within 6 months | P2 |

### 4.4 Reliability & Low-Bandwidth Operation

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-R01 | Core UI shall load and function on 2G connections (256 kbps) | P0 |
| NFR-R02 | Application shall be a Progressive Web App (PWA) with offline UI caching | P0 |
| NFR-R03 | Graceful degradation: text input fallback if voice fails | P0 |
| NFR-R04 | System shall retry failed API calls automatically (max 3 attempts) | P1 |
| NFR-R05 | Clear error messages in local language when connectivity fails | P0 |
| NFR-R06 | Target uptime: 99.5% | P1 |

### 4.5 Explainability & Transparency

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-X01 | Every urgency classification shall include human-readable reasoning | P0 |
| NFR-X02 | System shall clearly identify itself as an AI assistant, not a doctor | P0 |
| NFR-X03 | Limitations shall be clearly communicated to users | P0 |
| NFR-X04 | Source of triage rules shall be documented and available for audit | P0 |

---

## 5. AI-Specific Requirements

### 5.1 Speech-to-Text (STT)

| ID | Requirement | Priority |
|----|-------------|----------|
| AI-STT01 | STT shall support Indian English and Hindi accents | P0 |
| AI-STT02 | STT shall handle background noise typical of rural environments | P1 |
| AI-STT03 | Word Error Rate (WER) target: <15% for supported languages | P0 |
| AI-STT04 | STT shall handle medical symptom vocabulary in local languages | P0 |
| AI-STT05 | Fallback to manual text entry if STT confidence is low | P0 |
| AI-STT06 | User shall be able to correct transcription errors | P0 |

**Recommended Services:** Amazon Transcribe (with Indian language models), Azure Speech Services, or Google Cloud Speech-to-Text

### 5.2 Natural Language Processing (NLP)

| ID | Requirement | Priority |
|----|-------------|----------|
| AI-NLP01 | NLP shall extract structured symptom entities from free-text input | P0 |
| AI-NLP02 | Entity extraction shall include: body part, symptom type, duration, intensity | P0 |
| AI-NLP03 | NLP shall map colloquial symptom descriptions to standardized terms | P0 |
| AI-NLP04 | NLP shall NOT attempt to infer diagnosis from symptoms | P0 |
| AI-NLP05 | Confidence scores shall be generated for extracted entities | P1 |
| AI-NLP06 | Low-confidence extractions shall trigger clarifying questions | P0 |

### 5.3 Rule-Based Triage Engine

| ID | Requirement | Priority |
|----|-------------|----------|
| AI-RB01 | Urgency classification shall use deterministic rule-based logic | P0 |
| AI-RB02 | Rules shall be based on established clinical triage protocols (e.g., WHO IMNCI, ASHA training modules) | P0 |
| AI-RB03 | Rule set shall be version-controlled and auditable | P0 |
| AI-RB04 | Rules shall be reviewed and approved by qualified medical professionals | P0 |
| AI-RB05 | Rule updates shall require clinical sign-off before deployment | P0 |
| AI-RB06 | System shall log which rules triggered each classification | P1 |

**Red-Flag Symptoms (Automatic High Urgency):**
- Chest pain with breathlessness
- Sudden severe headache
- Loss of consciousness
- Difficulty breathing
- High fever (>103°F) in children under 5
- Seizures
- Severe bleeding
- Signs of stroke (facial drooping, arm weakness, speech difficulty)
- Severe abdominal pain
- Pregnancy-related danger signs

### 5.4 Controlled LLM Usage

| ID | Requirement | Priority |
|----|-------------|----------|
| AI-LLM01 | LLM shall be used ONLY for natural language generation (explanations) | P0 |
| AI-LLM02 | LLM shall NOT be used for urgency classification or triage decisions | P0 |
| AI-LLM03 | LLM prompts shall be strictly templated with guardrails | P0 |
| AI-LLM04 | LLM output shall be constrained to predefined response patterns | P0 |
| AI-LLM05 | LLM shall receive structured input from rule engine, not raw symptoms | P0 |
| AI-LLM06 | System prompts shall explicitly prohibit diagnosis language | P0 |

**LLM Use Cases (Permitted):**
- Converting structured triage output to simple, empathetic language
- Generating culturally appropriate explanations
- Translating guidance across supported languages

**LLM Use Cases (Prohibited):**
- Symptom interpretation
- Urgency assessment
- Treatment suggestions
- Diagnosis inference

### 5.5 Hallucination Prevention

| ID | Requirement | Priority |
|----|-------------|----------|
| AI-HP01 | LLM responses shall be validated against allowed response templates | P0 |
| AI-HP02 | Any mention of specific diseases, medications, or treatments shall be filtered | P0 |
| AI-HP03 | Output validation layer shall reject non-compliant responses | P0 |
| AI-HP04 | Fallback to template-only response if LLM output fails validation | P0 |
| AI-HP05 | All LLM interactions shall be logged for audit | P1 |
| AI-HP06 | Regular adversarial testing shall be conducted | P1 |

---

## 6. Constraints & Assumptions

### 6.1 Technical Constraints

- **Web-only deployment:** No native mobile app; PWA for mobile experience
- **Zero hardware dependency:** Must work on any device with a browser and microphone
- **No persistent storage:** Session-based only; no user accounts required for basic flow
- **Indian cloud infrastructure:** Data processing within AWS Mumbai / Azure India regions

### 6.2 Operational Constraints

- **No diagnosis:** System is explicitly a navigation tool, not a diagnostic tool
- **No emergency replacement:** System supplements, does not replace, 108/102 services
- **Human oversight:** System recommendations are guidance only; final decisions rest with users and healthcare providers
- **Government alignment:** Triage levels map to existing PHC → CHC → DH referral pathways

### 6.3 Assumptions

- Users have access to a smartphone with a working microphone
- Users have intermittent internet connectivity (minimum 2G)
- Users can understand spoken/written content in at least one supported language
- Government healthcare facilities (PHC/CHC) are accessible within reasonable distance
- ASHA/ANM workers are available in target areas for assisted usage
- Clinical triage rules will be validated by qualified medical professionals before deployment

---

## 7. Success Metrics

### 7.1 Primary Metrics

| Metric | Definition | Target (6 months) |
|--------|------------|-------------------|
| Appropriate Referral Rate | % of High urgency cases that reached appropriate facility within recommended time | >80% |
| Unnecessary Visit Reduction | % reduction in non-urgent cases at District Hospitals (surveyed) | 15-20% reduction |
| User Task Completion | % of sessions that complete full flow (input → guidance) | >85% |
| Safety Compliance | % of red-flag symptoms correctly classified as High urgency | >98% |

### 7.2 Secondary Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| Session Duration | Average time from start to guidance | <5 minutes |
| Voice Input Success Rate | % of voice inputs successfully transcribed | >90% |
| Return Usage | % of users who use system more than once | >40% |
| ASHA/ANM Adoption | % of trained workers actively using system | >60% |
| Net Promoter Score (NPS) | User satisfaction and likelihood to recommend | >50 |

### 7.3 Safety Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| False Negative Rate (High Urgency) | % of actual emergencies classified as Low/Medium | <2% |
| Escalation Rate | % of sessions where user was advised to seek higher care | Monitored (no target) |
| Adverse Event Reports | Reported cases of harm potentially linked to system guidance | 0 |

---

## 8. Technical Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Device (Browser)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Voice Input │  │  Text Input │  │  PWA Shell (Cached UI)  │  │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────────┘  │
└─────────┼────────────────┼──────────────────────────────────────┘
          │                │
          ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway (AWS)                           │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend Services                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  STT Service│  │ NLP Service │  │  Rule-Based Triage      │  │
│  │  (Transcribe)│ │ (Entity     │  │  Engine                 │  │
│  │             │  │  Extraction)│  │  (Deterministic)        │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                     │                 │
│         ▼                ▼                     ▼                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              LLM Service (Explanation Generation)           ││
│  │              - Templated prompts only                       ││
│  │              - Output validation layer                      ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Response to User                              │
│  - Structured symptom summary                                    │
│  - Urgency level (Low/Medium/High)                              │
│  - Care level recommendation                                     │
│  - Simple language explanation                                   │
│  - Shareable summary                                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Compliance & Regulatory Considerations

### 9.1 Applicable Regulations

- **Digital Personal Data Protection Act, 2023 (India):** Data minimization, purpose limitation, consent requirements
- **IT Act, 2000 & IT Rules:** Data localization, reasonable security practices
- **Telemedicine Practice Guidelines, 2020:** System explicitly operates outside telemedicine scope (no consultation)
- **Medical Device Rules, 2017:** System is NOT a medical device; does not diagnose or treat

### 9.2 Ethical Guidelines

- Alignment with **NITI Aayog AI Ethics Principles**
- Transparency about AI limitations
- No exploitation of vulnerable populations
- Equitable access across languages and literacy levels

---

## 10. Glossary

| Term | Definition |
|------|------------|
| PHC | Primary Health Centre – First point of contact in rural public health system |
| CHC | Community Health Centre – Secondary level facility with specialist services |
| ASHA | Accredited Social Health Activist – Community health worker at village level |
| ANM | Auxiliary Nurse Midwife – Frontline health worker at Sub-Centre/PHC |
| Triage | Process of determining priority of care based on symptom severity |
| STT | Speech-to-Text – Converting spoken audio to written text |
| NLP | Natural Language Processing – AI techniques for understanding human language |
| LLM | Large Language Model – AI model for generating human-like text |
| PWA | Progressive Web App – Web application with native app-like capabilities |

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | February 5, 2026 | Product Team | Initial draft |

---


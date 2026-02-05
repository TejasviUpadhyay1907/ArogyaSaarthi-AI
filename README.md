# ArogyaSaarthi AI – Voice-First Rural Healthcare Navigator

A web-based AI healthcare navigation system designed for rural and semi-urban India, helping users understand their symptoms and find appropriate care within the government healthcare ecosystem.

## 📋 Documentation

- **[Requirements Document](requirements.md)** - Comprehensive requirements specification
- **[Design Document](design.md)** - Technical system architecture and design

## 🎯 Project Overview

ArogyaSaarthi AI is a voice-first Progressive Web App that:
- Accepts voice input in Indian languages (Hindi, English, and more)
- Structures symptoms using AI-assisted NLP
- Classifies urgency using rule-based logic (NOT AI-driven diagnosis)
- Provides guidance on appropriate care level (PHC → CHC → District Hospital)
- Explains reasoning in simple, non-medical language

## 🚫 What This System Does NOT Do

- ❌ Provide medical diagnosis
- ❌ Prescribe medications or treatments
- ❌ Replace emergency services (108/102)
- ❌ Store long-term patient health records

## 🏗️ Architecture Highlights

- **Frontend:** React PWA with voice recording
- **Backend:** AWS Lambda (serverless)
- **AI Services:** Amazon Transcribe (STT), Amazon Bedrock (LLM for explanations only)
- **Safety:** Rule-based triage engine with strict guardrails
- **Privacy:** No PII storage, session-scoped processing only

## 🔒 Safety-First Design

- Medical urgency classification is **deterministic and rule-based**
- LLMs are used ONLY for speech-to-text, entity extraction, and explanation generation
- Output validation prevents diagnosis language
- Conservative defaults when uncertain

## 📊 Target Impact

- Reduce unnecessary hospital visits by 15-20%
- Improve early referral rates for serious conditions
- Support frontline health workers (ASHA/ANM)
- Enable informed healthcare navigation for low-literacy populations

## 🌐 Supported Languages

**Phase 1:** Hindi, English  
**Phase 2:** Tamil, Telugu, Marathi, Bengali, Kannada, Gujarati

## 📄 License

This is a conceptual design for a healthcare navigation system. Implementation requires clinical validation and regulatory compliance.

---

**Version:** 1.0  
**Date:** February 5, 2026

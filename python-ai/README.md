# ArogyaSaarthi AI Backend - Milestone 1

A deterministic, offline-capable healthcare triage backend engine built with Flask.

## Features

- ✅ **Deterministic Rule-Based Classification** - No LLM usage, completely rule-based
- ✅ **Offline Capable** - Works without external APIs
- ✅ **Lightweight** - Minimal dependencies, SQLite storage
- ✅ **Modular Architecture** - Clean separation for future microservices
- ✅ **Production Ready** - Error handling, logging, health checks

## Project Structure

```
backend/
├── app.py                 # Flask application with REST endpoints
├── triage_engine.py       # Deterministic rule engine
├── database.py           # SQLite database operations
├── rules/
│   └── triage_rules.json # Classification rules
├── requirements.txt      # Python dependencies
└── README.md            # This file
```

## Installation & Setup

### Prerequisites
- Python 3.7+
- pip (Python package manager)

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Verify Rules File

Ensure `rules/triage_rules.json` exists with the deterministic rules:
- HIGH urgency: "chest pain" + "breathlessness" → EMERGENCY
- LOW urgency: "fever" without "chest pain" → HOME  
- MEDIUM urgency: All other cases → PHC

### 3. Run the Backend

```bash
python app.py
```

The server will start on `http://localhost:5000`

## API Endpoints

### 1. Health Check
```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "service": "ArogyaSaarthi AI Backend",
  "version": "1.0.0"
}
```

### 2. Classify Symptoms
```bash
POST /classify
Content-Type: application/json

{
  "text": "I have chest pain and breathlessness"
}
```

Response:
```json
{
  "urgency": "HIGH",
  "recommended_facility": "EMERGENCY",
  "reasoning": "Chest pain with breathlessness requires immediate emergency care"
}
```

### 3. Get Statistics
```bash
GET /stats
```

Response:
```json
{
  "total_classifications": 5,
  "urgency_distribution": {
    "HIGH": 2,
    "MEDIUM": 2,
    "LOW": 1
  },
  "facility_distribution": {
    "EMERGENCY": 2,
    "PHC": 2,
    "HOME": 1
  }
}
```

### 4. Get Rules Information
```bash
GET /rules
```

Returns the loaded rules and metadata.

## Testing the Backend

### Test with curl

1. **HIGH Urgency Test:**
```bash
curl -X POST http://localhost:5000/classify \
  -H "Content-Type: application/json" \
  -d '{"text": "I have chest pain and breathlessness"}'
```

2. **LOW Urgency Test:**
```bash
curl -X POST http://localhost:5000/classify \
  -H "Content-Type: application/json" \
  -d '{"text": "I have fever"}'
```

3. **MEDIUM Urgency Test:**
```bash
curl -X POST http://localhost:5000/classify \
  -H "Content-Type: application/json" \
  -d '{"text": "I have headache"}'
```

### Test with Python

```python
import requests
import json

# Test classification
response = requests.post(
    'http://localhost:5000/classify',
    json={'text': 'I have chest pain and breathlessness'}
)
print(response.json())
```

## Database

The backend uses SQLite for storing classification logs:
- **Database file:** `triage_logs.db` (auto-created)
- **Table:** `triage_logs`
- **Fields:** `id`, `input_text`, `urgency`, `recommended_facility`, `reasoning`, `timestamp`

## Deterministic Rules Logic

The classification follows these rules in order:

1. **HIGH Priority:** If text contains BOTH "chest pain" AND "breathlessness"
   - Urgency: HIGH
   - Facility: EMERGENCY

2. **LOW Priority:** If text contains "fever" AND does NOT contain "chest pain"
   - Urgency: LOW
   - Facility: HOME

3. **MEDIUM Priority:** All other cases
   - Urgency: MEDIUM
   - Facility: PHC

## Production Deployment

Set environment variable:
```bash
export FLASK_ENV=production
python app.py
```

This will:
- Disable debug mode
- Run on host 0.0.0.0 (accessible from external IPs)
- Use production-safe settings

## Future Extensibility

The modular architecture allows easy addition of:
- Additional classification rules
- New endpoints
- Microservice integration
- Advanced logging and monitoring
- Authentication and authorization

## Error Handling

The backend includes comprehensive error handling:
- Input validation
- JSON parsing errors
- Database connection issues
- Missing files
- Internal server errors

All errors return appropriate HTTP status codes and descriptive error messages.

---

**Milestone 1 Complete** ✅

This backend provides the core deterministic triage functionality for the ArogyaSaarthi AI platform, ready for frontend integration and future enhancements.

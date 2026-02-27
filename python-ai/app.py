from flask import Flask, request, jsonify
from flask_cors import CORS
import traceback
import os
import time
from datetime import datetime, timezone

from triage_engine import TriageEngine
from nlp_extractor import extract_symptoms
from database import init_db, log_session, get_analytics
from ai_engine.explainer import generate_explanation, get_disclaimer
from offline_engine import classify_offline
from response_builder import build_structured_response

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Initialize components
offline_mode = os.getenv('OFFLINE_MODE', 'false').lower() == 'true'

if offline_mode:
    print("🔄 Running in OFFLINE MODE")
else:
    print("🌐 Running in ONLINE MODE")

try:
    triage_engine = TriageEngine()
    print("✅ Triage engine initialized successfully")
except Exception as e:
    print(f"❌ Error initializing triage engine: {e}")
    triage_engine = None

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "service": "ArogyaSaarthi AI Backend",
        "version": "1.0.0"
    })

@app.route('/classify', methods=['POST'])
def classify_symptoms():
    """Classify symptoms using structured extraction and deterministic rules with performance logging."""
    if not triage_engine:
        return jsonify({
            "error": "Triage engine not properly initialized"
        }), 500
    
    try:
        # Start performance timer
        start_time = time.perf_counter()
        
        # Get JSON data from request
        data = request.get_json()
        
        # Validate input
        if not data:
            return jsonify({
                "error": "No JSON data provided"
            }), 400
        
        if 'text' not in data:
            return jsonify({
                "error": "Missing 'text' field in request"
            }), 400
        
        # Get language from request (default to 'en')
        language = data.get('language', 'en')
        
        symptoms_text = data['text'].strip()
        
        if not symptoms_text:
            return jsonify({
                "error": "Input text cannot be empty"
            }), 400
        
        # Step 1: Extract structured symptoms
        extracted_data = extract_symptoms(symptoms_text)
        print(f"🔍 Extracted symptoms: {extracted_data}")
        
        # Step 2: Classify with fallback logic
        result = None
        rule_id = None
        mode = "ONLINE"
        
        try:
            if offline_mode:
                # Always use offline engine in offline mode
                print("🔄 Using OFFLINE engine")
                result = classify_offline(symptoms_text)
                mode = "OFFLINE"
            else:
                # Try AI engine first
                print("🌐 Trying AI engine...")
                result = triage_engine.classify_structured(extracted_data)
                print("✅ AI engine successful")
                # Extract rule ID if available (for confidence calculation)
                rule_id = result.get('rule_id')
        except Exception as ai_error:
            if offline_mode:
                # If offline mode fails, re-raise the error
                raise ai_error
            else:
                # Fallback to offline engine if AI fails
                print(f"⚠️ AI engine failed: {ai_error}")
                print("🔄 Falling back to OFFLINE engine")
                result = classify_offline(symptoms_text)
                mode = "OFFLINE"
        
        # Step 3: Generate explanation with safety filter
        explanation = generate_explanation(
            urgency=result['urgency'],
            facility=result['recommended_facility'],
            reasoning=result['reasoning'],
            language=language
        )
        
        # Step 4: Build structured response
        structured_response = build_structured_response(
            urgency=result['urgency'],
            facility=result['recommended_facility'],
            reasoning=result['reasoning'],
            explanation=explanation,
            mode=mode,
            rule_id=rule_id
        )
        
        # Calculate response time in milliseconds
        end_time = time.perf_counter()
        latency_ms = int((end_time - start_time) * 1000)
        
        # Get current timestamp in ISO format
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Log session to database (non-blocking - continue even if DB fails)
        try:
            session_id = log_session(
                timestamp=timestamp,
                language=language,
                urgency=result['urgency'],
                facility=result['recommended_facility'],
                latency_ms=latency_ms
            )
        except Exception as db_error:
            print(f"⚠️  Session logging failed: {db_error}")
            # Continue with response even if DB fails
        
        # Return structured risk guidance response
        return jsonify(structured_response)
        
    except Exception as e:
        print(f"❌ Classification error: {e}")
        print(traceback.format_exc())
        
        # Safe fallback response
        fallback_response = build_structured_response(
            urgency="MEDIUM",
            facility="PHC",
            reasoning="System error - default classification applied",
            explanation="Please consult a healthcare professional for proper medical advice.",
            mode="OFFLINE"
        )
        return jsonify(fallback_response)

@app.route('/extract', methods=['POST'])
def extract_symptoms_endpoint():
    """Extract symptoms from text (for testing/extraction-only use)."""
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({
                "error": "Missing 'text' field in request"
            }), 400
        
        symptoms_text = data['text'].strip()
        
        if not symptoms_text:
            return jsonify({
                "error": "Input text cannot be empty"
            }), 400
        
        extracted_data = extract_symptoms(symptoms_text)
        return jsonify(extracted_data)
        
    except Exception as e:
        print(f"❌ Extraction error: {e}")
        return jsonify({
            "error": "Internal server error during extraction"
        }), 500

@app.route('/stats', methods=['GET'])
def get_stats():
    """Get analytics dashboard data from session logs."""
    try:
        analytics = get_analytics()
        return jsonify(analytics)
    except Exception as e:
        print(f"❌ Stats error: {e}")
        return jsonify({
            "error": "Failed to retrieve statistics"
        }), 500

@app.route('/rules', methods=['GET'])
def get_rules():
    """Get information about loaded rules."""
    if not triage_engine:
        return jsonify({
            "error": "Triage engine not available"
        }), 500
    
    try:
        rules_info = triage_engine.get_rules_info()
        return jsonify(rules_info)
    except Exception as e:
        print(f"❌ Rules info error: {e}")
        return jsonify({
            "error": "Failed to retrieve rules information"
        }), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        "error": "Endpoint not found"
    }), 404

@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({
        "error": "Method not allowed"
    }), 405

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        "error": "Internal server error"
    }), 500

if __name__ == '__main__':
    # Check if running in production mode
    if os.getenv('FLASK_ENV') == 'production':
        # Production settings
        app.run(host='0.0.0.0', port=5000, debug=False)
    else:
        # Development settings
        print("🚀 Starting ArogyaSaarthi AI Backend in development mode...")
        print("📍 Available endpoints:")
        print("   GET  /health        - Health check")
        print("   POST /classify      - Classify symptoms with extraction and performance logging")
        print("   POST /extract       - Extract symptoms from text (testing)")
        print("   GET  /stats         - Get triage statistics and metrics")
        print("   GET  /rules         - Get rules info")
        print("🔗 Test with: curl -X POST http://localhost:5000/classify \\")
        print("  -H \"Content-Type: application/json\" \\")
        print("  -d '{\"text\":\"Chest pain and breathing difficulty\",\"language\":\"en\"}'")
        app.run(host='0.0.0.0', port=5000, debug=True)

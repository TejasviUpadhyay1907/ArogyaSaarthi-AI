import sqlite3
from datetime import datetime, timezone
from typing import Optional

# Database configuration
DB_PATH = "triage.db"

def init_db():
    """Initialize SQLite database with required tables."""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Create session_logs table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS session_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT,
                    language TEXT,
                    urgency TEXT,
                    facility TEXT,
                    latency_ms INTEGER
                )
            """)
            
            conn.commit()
        print(f"✅ Database initialized: {DB_PATH}")
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        raise

def log_session(timestamp: str, language: str, urgency: str, facility: str, latency_ms: int) -> Optional[int]:
    """Log session to database."""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO session_logs 
                (timestamp, language, urgency, facility, latency_ms)
                VALUES (?, ?, ?, ?, ?)
            """, (timestamp, language, urgency, facility, latency_ms))
            conn.commit()
            session_id = cursor.lastrowid
            print("Session logged successfully")
            return session_id
    except Exception as e:
        print(f"❌ Failed to log session: {e}")
        return None

def get_analytics() -> dict:
    """Get aggregated analytics from session logs."""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Get total sessions
            cursor.execute("SELECT COUNT(*) FROM session_logs")
            total_sessions = cursor.fetchone()[0]
            
            # Get urgency distribution
            cursor.execute("""
                SELECT urgency, COUNT(*) 
                FROM session_logs 
                GROUP BY urgency
            """)
            urgency_stats = dict(cursor.fetchall())
            
            # Get average latency
            cursor.execute("SELECT AVG(latency_ms) FROM session_logs")
            avg_latency = cursor.fetchone()[0] or 0
            
            # Extract counts by urgency
            high_cases = urgency_stats.get('HIGH', 0)
            medium_cases = urgency_stats.get('MEDIUM', 0)
            low_cases = urgency_stats.get('LOW', 0)
            
            return {
                "total_sessions": total_sessions,
                "high_cases": high_cases,
                "medium_cases": medium_cases,
                "low_cases": low_cases,
                "avg_latency_ms": round(avg_latency, 2)
            }
    except Exception as e:
        print(f"❌ Failed to get analytics: {e}")
        return {"error": str(e)}

# Initialize database on import
init_db()

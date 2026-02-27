import re
from typing import Dict, Any

class OfflineTriageEngine:
    def __init__(self):
        # Define urgency keywords
        self.high_urgency_keywords = [
            "chest pain", "breathlessness", "unconscious", "seizure", 
            "stroke", "bleeding", "severe bleeding", "heart attack",
            "sine ka dard", "saans lene mein takleef", "behosh",
            "mirgi", "brain stroke", "khoon bah raha hai"
        ]
        
        self.medium_urgency_keywords = [
            "fever", "vomiting", "infection", "headache", "dizziness",
            "bukhar", "ulti", "infection", "sar dard", "chakkar"
        ]
        
        # Facility mapping by urgency
        self.facility_mapping = {
            "HIGH": "EMERGENCY",
            "MEDIUM": "PHC", 
            "LOW": "HOME"
        }
        
        # Reasoning templates
        self.reasoning_templates = {
            "HIGH": "Emergency symptoms detected - immediate medical attention required",
            "MEDIUM": "Moderate symptoms detected - medical evaluation recommended", 
            "LOW": "Mild symptoms detected - home care may be sufficient"
        }
    
    def normalize_text(self, text: str) -> str:
        """Normalize input text for processing."""
        if not text:
            return ""
        
        # Convert to lowercase
        text = text.lower()
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        return text
    
    def check_keywords(self, text: str, keywords: list) -> bool:
        """Check if any keyword exists in text."""
        normalized_text = self.normalize_text(text)
        
        for keyword in keywords:
            if keyword.lower() in normalized_text:
                return True
        
        return False
    
    def classify_offline(self, text: str) -> Dict[str, Any]:
        """Classify symptoms using offline rule-based system."""
        if not text or not text.strip():
            return {
                "urgency": "LOW",
                "recommended_facility": "HOME",
                "reasoning": "No symptoms provided - home care recommended",
                "mode": "OFFLINE"
            }
        
        # Check for HIGH urgency symptoms first
        if self.check_keywords(text, self.high_urgency_keywords):
            return {
                "urgency": "HIGH",
                "recommended_facility": self.facility_mapping["HIGH"],
                "reasoning": self.reasoning_templates["HIGH"],
                "mode": "OFFLINE"
            }
        
        # Check for MEDIUM urgency symptoms
        if self.check_keywords(text, self.medium_urgency_keywords):
            return {
                "urgency": "MEDIUM",
                "recommended_facility": self.facility_mapping["MEDIUM"],
                "reasoning": self.reasoning_templates["MEDIUM"],
                "mode": "OFFLINE"
            }
        
        # Default to LOW urgency
        return {
            "urgency": "LOW",
            "recommended_facility": self.facility_mapping["LOW"],
            "reasoning": self.reasoning_templates["LOW"],
            "mode": "OFFLINE"
        }

# Global offline engine instance
offline_engine = OfflineTriageEngine()

def classify_offline(text: str) -> Dict[str, Any]:
    """Convenience function for offline classification."""
    return offline_engine.classify_offline(text)

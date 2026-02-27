import re
from typing import Dict, List, Optional, Any

class SymptomExtractor:
    def __init__(self):
        # Define symptom keywords
        self.symptom_keywords = {
            "chest pain": ["chest pain", "chest dard", "sine ka dard", "chest mein dard"],
            "breathlessness": ["breathlessness", "saans lene mein takleef", "breathing problem", "saans phoolna", "shortness of breath"],
            "fever": ["fever", "bukhar", "temperature", "tez bukhar", "high temperature"],
            "cough": ["cough", "khansi", "khasi"],
            "severe bleeding": ["bleeding", "blood", "khoon", "jharana", "severe bleeding"],
            "unconsciousness": ["unconscious", "behosh", "fainted", "unconsciousness"],
            "seizures": ["seizures", "fits", "mirgi", "convulsions"]
        }
        
        # Duration patterns
        self.duration_patterns = [
            r'(\d+)\s*din',
            r'(\d+)\s*days?', 
            r'(\d+)\s*day',
            r'(\d+)\s*ghante',
            r'(\d+)\s*hours?',
            r'ek\s*din',
            r'do\s*din',
            r'teen\s*din',
            r'char\s*din',
            r'paanch\s*din',
        ]
        
        # Severity keywords
        self.severity_keywords = {
            "mild": ["mild", "halka", "kam", "light"],
            "moderate": ["moderate", "medium", "normal"],
            "severe": ["severe", "tez", "bahut", "kafi", "heavy", "intense", "zyada"]
        }
        
        # Red flag keywords (always high priority)
        self.red_flag_keywords = [
            "severe bleeding", "unconscious", "seizures", "fits", "behosh", 
            "mirgi", "chest pain", "breathlessness", "saans lene mein takleef"
        ]
    
    def extract_symptoms(self, text: str) -> Dict[str, Any]:
        """Extract structured symptoms from text."""
        if not text or not text.strip():
            return {
                "primary_symptoms": [],
                "duration_days": None,
                "severity": None,
                "red_flags": []
            }
        
        # Normalize text
        normalized_text = text.lower().strip()
        
        # Extract primary symptoms
        primary_symptoms = self._extract_primary_symptoms(normalized_text)
        
        # Extract duration
        duration_days = self._extract_duration(normalized_text)
        
        # Extract severity
        severity = self._extract_severity(normalized_text)
        
        # Extract red flags
        red_flags = self._extract_red_flags(normalized_text)
        
        return {
            "primary_symptoms": primary_symptoms,
            "duration_days": duration_days,
            "severity": severity,
            "red_flags": red_flags
        }
    
    def _extract_primary_symptoms(self, text: str) -> List[str]:
        """Extract primary symptoms from text."""
        found_symptoms = []
        
        for symptom, keywords in self.symptom_keywords.items():
            for keyword in keywords:
                if keyword in text:
                    found_symptoms.append(symptom)
                    break  # Only add each symptom once
        
        return found_symptoms
    
    def _extract_duration(self, text: str) -> Optional[int]:
        """Extract duration in days from text."""
        for pattern in self.duration_patterns:
            match = re.search(pattern, text)
            if match:
                duration_str = match.group(1)
                
                # Handle Hindi number words
                hindi_to_numbers = {
                    "ek": "1",
                    "do": "2", 
                    "teen": "3",
                    "char": "4",
                    "paanch": "5"
                }
                
                if duration_str in hindi_to_numbers:
                    duration_str = hindi_to_numbers[duration_str]
                
                try:
                    duration = int(duration_str)
                    
                    # Convert hours to days if less than 24
                    if "ghante" in pattern or "hour" in pattern:
                        duration = max(1, duration // 24)  # At least 1 day
                    
                    return duration
                except (ValueError, TypeError):
                    continue
        
        return None
    
    def _extract_severity(self, text: str) -> Optional[str]:
        """Extract severity level from text."""
        for severity_level, keywords in self.severity_keywords.items():
            for keyword in keywords:
                if keyword in text:
                    return severity_level
        
        return None
    
    def _extract_red_flags(self, text: str) -> List[str]:
        """Extract red flag symptoms from text."""
        found_red_flags = []
        
        for red_flag in self.red_flag_keywords:
            if red_flag in text:
                found_red_flags.append(red_flag)
        
        return found_red_flags

# Global extractor instance
extractor = SymptomExtractor()

def extract_symptoms(text: str) -> Dict[str, Any]:
    """Convenience function to extract symptoms from text."""
    return extractor.extract_symptoms(text)

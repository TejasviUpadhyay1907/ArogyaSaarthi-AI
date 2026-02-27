import json
import re
from typing import Dict, Any, List

class TriageEngine:
    def __init__(self, rules_path: str = "rules/triage_rules.json"):
        self.rules_path = rules_path
        self.rules = self.load_rules()
    
    def load_rules(self) -> Dict[str, Any]:
        """Load triage rules from JSON file."""
        try:
            with open(self.rules_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            raise FileNotFoundError(f"Rules file not found: {self.rules_path}")
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in rules file: {e}")
    
    def normalize_text(self, text: str) -> str:
        """Normalize input text for processing."""
        # Convert to lowercase
        text = text.lower()
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        return text
    
    def check_keywords(self, symptoms: List[str], required_keywords: List[str]) -> bool:
        """Check if ALL required keywords exist in extracted symptoms (case-insensitive)."""
        if not symptoms:
            return False if required_keywords else True
        
        # Convert both lists to lowercase for comparison
        symptoms_lower = [symptom.lower() for symptom in symptoms]
        keywords_lower = [keyword.lower() for keyword in required_keywords]
        
        for keyword in keywords_lower:
            if keyword not in symptoms_lower:
                return False
        
        return True
    
    def classify_structured(self, extracted_data: Dict[str, Any]) -> Dict[str, str]:
        """Classify using structured symptom data."""
        if not extracted_data or not extracted_data.get('primary_symptoms'):
            # Return default rule for empty symptoms
            default_rule = self.rules.get('default_rule', {
                "urgency": "MEDIUM",
                "facility": "PHC", 
                "reason": "No symptoms detected - requires general evaluation at Primary Health Center"
            })
            return {
                "urgency": default_rule["urgency"],
                "recommended_facility": default_rule["facility"],
                "reasoning": default_rule["reason"]
            }
        
        symptoms = extracted_data['primary_symptoms']
        
        # Iterate through rules in order
        for rule in self.rules['rules']:
            if self.check_keywords(symptoms, rule['required_keywords']):
                return {
                    "urgency": rule['urgency'],
                    "recommended_facility": rule['facility'],
                    "reasoning": rule['reason']
                }
        
        # If no rule matches, return default rule
        default_rule = self.rules.get('default_rule', {
            "urgency": "MEDIUM",
            "facility": "PHC",
            "reason": "General symptoms require evaluation at Primary Health Center"
        })
        return {
            "urgency": default_rule["urgency"],
            "recommended_facility": default_rule["facility"],
            "reasoning": default_rule["reason"]
        }
    
    def classify(self, input_text: str) -> Dict[str, str]:
        """Classify input text using deterministic rules from JSON (legacy method)."""
        if not input_text or not input_text.strip():
            # Return default rule for empty input
            default_rule = self.rules.get('default_rule', {
                "urgency": "MEDIUM",
                "facility": "PHC", 
                "reason": "Empty input requires general evaluation at Primary Health Center"
            })
            return {
                "urgency": default_rule["urgency"],
                "recommended_facility": default_rule["facility"],
                "reasoning": default_rule["reason"]
            }
        
        # Iterate through rules in order
        for rule in self.rules['rules']:
            if self.check_keywords([input_text], rule['required_keywords']):
                return {
                    "urgency": rule['urgency'],
                    "recommended_facility": rule['facility'],
                    "reasoning": rule['reason']
                }
        
        # If no rule matches, return default rule
        default_rule = self.rules.get('default_rule', {
            "urgency": "MEDIUM",
            "facility": "PHC",
            "reason": "General symptoms require evaluation at Primary Health Center"
        })
        return {
            "urgency": default_rule["urgency"],
            "recommended_facility": default_rule["facility"],
            "reasoning": default_rule["reason"]
        }
    
    def get_rules_info(self) -> Dict[str, Any]:
        """Get information about loaded rules."""
        return {
            "total_rules": len(self.rules['rules']),
            "rules": self.rules['rules'],
            "default_rule": self.rules.get('default_rule', {})
        }

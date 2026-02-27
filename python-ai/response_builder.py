from typing import Dict, Any, List

class ResponseBuilder:
    def __init__(self):
        # Risk level mapping
        self.risk_level_mapping = {
            "HIGH": "Immediate Care Needed",
            "MEDIUM": "Medical Evaluation Recommended", 
            "LOW": "Home Monitoring Suitable"
        }
        
        # Immediate actions by urgency
        self.immediate_actions = {
            "HIGH": [
                "Seek emergency medical care immediately",
                "Call emergency services (108) if available",
                "Go to nearest emergency department",
                "Do not drive yourself if feeling severe symptoms"
            ],
            "MEDIUM": [
                "Visit a healthcare facility within 24 hours",
                "Monitor symptoms closely",
                "Rest and avoid strenuous activity",
                "Contact a healthcare provider for guidance"
            ],
            "LOW": [
                "Monitor symptoms at home",
                "Get adequate rest",
                "Stay hydrated",
                "Seek medical care if symptoms worsen"
            ]
        }
        
        # Warning signs by urgency
        self.warning_signs = {
            "HIGH": [
                "Chest pain or pressure",
                "Difficulty breathing",
                "Sudden severe headache",
                "Loss of consciousness",
                "Uncontrolled bleeding"
            ],
            "MEDIUM": [
                "Persistent fever",
                "Worsening symptoms",
                "Difficulty performing daily activities",
                "New or unusual symptoms"
            ],
            "LOW": [
                "Symptoms lasting more than 3-4 days",
                "Mild fever that doesn't improve",
                "Gradual worsening of condition",
                "Concern about symptoms"
            ]
        }
        
        # Standard disclaimer
        self.disclaimer = "This is not a medical diagnosis."
    
    def determine_confidence(self, rule_id: str = None, urgency: str = "MEDIUM") -> str:
        """Determine confidence level based on rule ID or urgency."""
        if rule_id:
            if rule_id.startswith("RF-"):
                return "HIGH"
            elif rule_id.startswith("GEN-"):
                return "MODERATE"
            elif rule_id == "DEFAULT":
                return "LOW"
        
        # Fallback based on urgency
        if urgency == "HIGH":
            return "HIGH"
        elif urgency == "MEDIUM":
            return "MODERATE"
        else:
            return "LOW"
    
    def build_structured_response(self, 
                                 urgency: str, 
                                 facility: str, 
                                 reasoning: str, 
                                 explanation: str,
                                 mode: str = "ONLINE",
                                 rule_id: str = None) -> Dict[str, Any]:
        """Build structured risk guidance response."""
        try:
            # Map urgency to risk level
            risk_level = self.risk_level_mapping.get(urgency, "Medical Evaluation Recommended")
            
            # Determine confidence
            confidence = self.determine_confidence(rule_id, urgency)
            
            # Get appropriate actions and warnings
            actions = self.immediate_actions.get(urgency, self.immediate_actions["MEDIUM"])
            warnings = self.warning_signs.get(urgency, self.warning_signs["MEDIUM"])
            
            return {
                "risk_level": risk_level,
                "urgency_code": urgency,
                "recommended_facility": facility,
                "explanation": explanation,
                "immediate_actions": actions,
                "warning_signs": warnings,
                "confidence": confidence,
                "mode": mode,
                "disclaimer": self.disclaimer
            }
            
        except Exception as e:
            # Safe fallback response
            return {
                "risk_level": "Medical Evaluation Recommended",
                "urgency_code": "MEDIUM",
                "recommended_facility": "PHC",
                "explanation": "Please consult a healthcare professional for proper medical advice.",
                "immediate_actions": ["Visit a healthcare facility within 24 hours"],
                "warning_signs": ["Symptoms lasting more than 3-4 days"],
                "confidence": "LOW",
                "mode": mode,
                "disclaimer": self.disclaimer
            }

# Global response builder instance
response_builder = ResponseBuilder()

def build_structured_response(urgency: str, 
                             facility: str, 
                             reasoning: str, 
                             explanation: str,
                             mode: str = "ONLINE",
                             rule_id: str = None) -> Dict[str, Any]:
    """Convenience function to build structured response."""
    return response_builder.build_structured_response(
        urgency, facility, reasoning, explanation, mode, rule_id
    )

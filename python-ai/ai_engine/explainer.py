from typing import Dict, Optional

# Safety disclaimer constants
DISCLAIMER_TEXT = {
    "en": "This is not a medical diagnosis. In emergencies call 108 immediately.",
    "hi": "Yeh medical diagnosis nahi hai. Gambhir sthiti mein turant 108 par call karein."
}

# Blocked words for safety filtering
BLOCKED_WORDS = [
    "diagnosis", "medicine", "tablet", "drug", "disease", 
    "dawai", "ilaj", "bimari", "rog", "prescription"
]

# Explanation templates by urgency and language
EXPLANATION_TEMPLATES = {
    "LOW": {
        "en": "Your symptoms appear mild. Home care and rest may be enough. Visit a nearby health center if symptoms worsen.",
        "hi": "Aapke lakshan halke lag rahe hain. Ghar mein dekhbhal aur araam kaafi ho sakti hai. Agar lakshan kharab hain to paas ke swasthya kendr jaen."
    },
    "MEDIUM": {
        "en": "Your symptoms need medical attention soon. Please visit a Primary Health Center within 24 hours for evaluation.",
        "hi": "Aapke lakshanon ko jaldi medical attention chahiye. Kripya 24 ghante ke andar Primary Health Center mein jaakar checkup karayein."
    },
    "HIGH": {
        "en": "Your symptoms may indicate a serious condition. Please seek emergency medical care immediately or call 108.",
        "hi": "Aapke lakshan gambhir sthiti ki sanket de sakte hain. Kripya turant emergency medical care lein ya 108 par call karein."
    }
}

class SafetyExplainer:
    def __init__(self):
        self.templates = EXPLANATION_TEMPLATES
        self.disclaimers = DISCLAIMER_TEXT
        self.blocked_words = BLOCKED_WORDS
    
    def _detect_language(self, text: str) -> str:
        """Simple language detection based on common words."""
        text_lower = text.lower()
        
        # Common Hindi indicators
        hindi_indicators = ['hai', 'hain', 'aapke', 'mere', 'lakshan', 'dard', 'bukhar', 'karein', 'jaen']
        
        for indicator in hindi_indicators:
            if indicator in text_lower:
                return "hi"
        
        return "en"  # Default to English
    
    def _safety_filter(self, explanation: str) -> str:
        """Filter out blocked words from explanation."""
        explanation_lower = explanation.lower()
        
        for blocked_word in self.blocked_words:
            if blocked_word in explanation_lower:
                # Return safe fallback if any blocked word detected
                return "Please consult a healthcare professional for proper medical advice."
        
        return explanation
    
    def generate_explanation(self, urgency: str, facility: str, reasoning: str, language: str = "en") -> str:
        """Generate safe explanation based on urgency and language."""
        try:
            # Normalize urgency
            urgency = urgency.upper()
            
            # Get appropriate template
            if urgency in self.templates:
                template = self.templates[urgency].get(language, self.templates[urgency]["en"])
            else:
                # Fallback to MEDIUM if urgency not found
                template = self.templates["MEDIUM"].get(language, self.templates["MEDIUM"]["en"])
            
            # Apply safety filter
            safe_explanation = self._safety_filter(template)
            
            return safe_explanation
            
        except Exception as e:
            # Safe fallback on any error
            return "Please consult a healthcare professional for proper medical advice."
    
    def get_disclaimer(self, language: str = "en") -> str:
        """Get safety disclaimer in specified language."""
        return self.disclaimers.get(language, self.disclaimers["en"])

# Global explainer instance
explainer = SafetyExplainer()

def generate_explanation(urgency: str, facility: str, reasoning: str, language: str = "en") -> str:
    """Convenience function to generate explanation."""
    return explainer.generate_explanation(urgency, facility, reasoning, language)

def get_disclaimer(language: str = "en") -> str:
    """Convenience function to get disclaimer."""
    return explainer.get_disclaimer(language)

"""Deterministic rule-based triage engine. NO LLM involvement in urgency decisions."""

import json
import os
import logging

logger = logging.getLogger(__name__)

VALID_URGENCIES = {"LOW", "MEDIUM", "HIGH"}
VALID_CARE_LEVELS = {"HOME", "PHC", "CHC", "DISTRICT_HOSPITAL", "EMERGENCY"}

_rules_path = os.path.join(os.path.dirname(__file__), "rules", "triage_rules.json")
with open(_rules_path, "r", encoding="utf-8") as f:
    RULES = json.load(f)

SEVERITY_ORDER = {"mild": 1, "moderate": 2, "severe": 3, "unknown": 0}
URGENCY_ORDER = {"LOW": 1, "MEDIUM": 2, "HIGH": 3}
CARE_ORDER = {"HOME": 1, "PHC": 2, "CHC": 3, "DISTRICT_HOSPITAL": 4, "EMERGENCY": 5}


def classify(structured: dict) -> dict:
    """
    Deterministic triage classification.
    Input: structured extraction from nlp_extractor.
    Output: {urgency, careLevel, reasonCodes, matchedRules}
    """
    symptoms = structured.get("allDetectedSymptoms", [])
    if not symptoms and structured.get("primaryComplaint", "unknown") != "unknown":
        symptoms = [structured["primaryComplaint"]]

    duration_days = structured.get("duration", {}).get("value")
    severity = structured.get("severity", "unknown")
    red_flags = structured.get("redFlagsDetected", [])

    matched_rules = []

    # ── Step 1: Check red-flag rules (highest priority) ────────────────
    for rule in RULES.get("redFlagRules", []):
        cond = rule["conditions"]
        rule_symptoms = cond.get("symptoms", [])
        operator = cond.get("operator", "ANY")

        if operator == "AND":
            if all(s in symptoms for s in rule_symptoms):
                matched_rules.append(rule)
        else:  # ANY
            if any(s in symptoms for s in rule_symptoms):
                matched_rules.append(rule)

    # If any red flag rule matched, return highest
    if matched_rules:
        best = _pick_highest(matched_rules)
        urgency = best["output"].get("urgency", "MEDIUM")
        care_level = best["output"].get("careLevel", "PHC")
        if urgency not in VALID_URGENCIES:
            logger.warning(f"[TriageRules] Invalid urgency '{urgency}' from red-flag rule — forcing HIGH")
            urgency = "HIGH"
        if care_level not in VALID_CARE_LEVELS:
            care_level = "EMERGENCY"
        return {
            "urgency": urgency,
            "careLevel": care_level,
            "reasonCodes": [r["id"] for r in matched_rules],
            "matchedRules": [r["name"] for r in matched_rules],
        }

    # ── Step 2: Check general rules ────────────────────────────────────
    for rule in RULES.get("generalRules", []):
        cond = rule["conditions"]
        rule_symptoms = cond.get("symptoms", [])
        operator = cond.get("operator", "ANY")

        # Check symptom match
        if operator == "AND":
            symptom_match = all(s in symptoms for s in rule_symptoms)
        else:
            symptom_match = any(s in symptoms for s in rule_symptoms)

        if not symptom_match:
            continue

        # Check duration conditions
        if "durationDaysGte" in cond:
            if duration_days is None or duration_days < cond["durationDaysGte"]:
                continue
        if "durationDaysLt" in cond:
            if duration_days is not None and duration_days >= cond["durationDaysLt"]:
                continue

        # Check severity conditions
        if "severityGte" in cond:
            if SEVERITY_ORDER.get(severity, 0) < SEVERITY_ORDER.get(cond["severityGte"], 0):
                continue
        if "severityLte" in cond:
            if SEVERITY_ORDER.get(severity, 0) > SEVERITY_ORDER.get(cond["severityLte"], 0):
                # unknown severity doesn't block mild-only rules
                if severity != "unknown":
                    continue

        matched_rules.append(rule)

    if matched_rules:
        best = _pick_highest(matched_rules)
        urgency = best["output"].get("urgency", "MEDIUM")
        care_level = best["output"].get("careLevel", "PHC")
        if urgency not in VALID_URGENCIES:
            logger.warning(f"[TriageRules] Invalid urgency '{urgency}' from general rule — forcing MEDIUM")
            urgency = "MEDIUM"
        if care_level not in VALID_CARE_LEVELS:
            care_level = "PHC"
        return {
            "urgency": urgency,
            "careLevel": care_level,
            "reasonCodes": [r["id"] for r in matched_rules],
            "matchedRules": [r["name"] for r in matched_rules],
        }

    # ── Step 3: Default — conservative MEDIUM/PHC ──────────────────────
    default = RULES.get("defaultRule", {})
    urgency = default.get("output", {}).get("urgency", "MEDIUM")
    care_level = default.get("output", {}).get("careLevel", "PHC")

    # Final safety guard — urgency must always be valid
    if urgency not in VALID_URGENCIES:
        logger.warning(f"[TriageRules] Invalid urgency '{urgency}' from default rule — forcing MEDIUM")
        urgency = "MEDIUM"
    if care_level not in VALID_CARE_LEVELS:
        care_level = "PHC"

    return {
        "urgency": urgency,
        "careLevel": care_level,
        "reasonCodes": [default.get("id", "DEFAULT")],
        "matchedRules": [default.get("name", "Default conservative")],
    }


def _pick_highest(rules: list) -> dict:
    """Pick the rule with highest urgency, then highest care level."""
    return max(
        rules,
        key=lambda r: (
            URGENCY_ORDER.get(r["output"]["urgency"], 0),
            CARE_ORDER.get(r["output"]["careLevel"], 0),
        ),
    )

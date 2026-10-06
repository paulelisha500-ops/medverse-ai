import json
import re
from typing import Dict, Optional

from app.nlp.report_rules import analyze_with_rules
from app.rag.llm_providers import FallbackProvider, get_llm_provider

# Real pattern-based extraction for common lab values — works even
# without any LLM provider configured. Group 1 is the value, group 2 the unit
# when one is written (SI units included, so report_rules can convert them).
_NUM = r"(\d+(?:\.\d+)?)"
LAB_PATTERNS = {
    "glucose": rf"(?:fasting glucose|blood glucose|glucose)[:\s]+{_NUM}\s*(mg/dl|mmol/l)?",
    "hba1c": rf"(?:hba1c|a1c)[:\s]+{_NUM}\s*(%|mmol/mol)?",
    "total_cholesterol": rf"(?:total cholesterol|cholesterol)[:\s]+{_NUM}\s*(mg/dl|mmol/l)?",
    "ldl": rf"\bldl[:\s]+{_NUM}\s*(mg/dl|mmol/l)?",
    "hdl": rf"\bhdl[:\s]+{_NUM}\s*(mg/dl|mmol/l)?",
    "blood_pressure": r"(?:blood pressure|bp)[:\s]+(\d{2,3}\s*/\s*\d{2,3})",
    "creatinine": rf"creatinine[:\s]+{_NUM}\s*(mg/dl|µmol/l|umol/l)?",
    "hemoglobin": rf"(?:hemoglobin|hb)[:\s]+{_NUM}\s*(g/dl|g/l)?",
    "tsh": rf"\btsh[:\s]+{_NUM}\s*(uiu/ml|miu/l)?",
}


def extract_lab_measurements(text: str) -> Dict[str, Dict[str, Optional[str]]]:
    """{test: {"value": "126", "unit": "mg/dl" or None}} for each lab found."""
    found = {}
    lowered = text.lower()
    for key, pattern in LAB_PATTERNS.items():
        match = re.search(pattern, lowered, re.IGNORECASE)
        if match:
            unit = match.group(2) if match.re.groups >= 2 else None
            found[key] = {"value": match.group(1).strip(), "unit": unit}
    return found


def extract_lab_values(text: str) -> Dict[str, str]:
    return {key: m["value"] for key, m in extract_lab_measurements(text).items()}


EXTRACTION_SYSTEM_PROMPT = (
    "You extract structured information from a medical report or prescription for a clinical "
    "healthcare platform. Return ONLY valid JSON with keys: diagnoses (list of strings), "
    "medications (list of strings), follow_up (list of strings). No markdown, no other text."
)

SUMMARY_SYSTEM_PROMPT = (
    "You write two summaries of a medical report for a clinical healthcare platform: one in plain, "
    "friendly language for the patient (avoid jargon), and one concise, clinical summary for the "
    "doctor. Never present the summary as a diagnosis — it is a summary of what the report says. "
    "Return ONLY valid JSON with keys: patient_summary, clinical_summary. No markdown, no other text."
)


def _safe_json_parse(text: str, fallback: dict) -> dict:
    try:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            parsed = json.loads(text[start:end + 1])
            if isinstance(parsed, dict):
                return parsed
    except Exception:
        pass
    return fallback


def _string_list(value) -> Optional[list]:
    if isinstance(value, list) and all(isinstance(v, str) for v in value):
        return value
    return None


def analyze_report(text: str) -> dict:
    """Lab values and their range flags always come from the deterministic
    patterns. Diagnoses, medications, follow-up and summaries come from the
    LLM when one is configured and answers usefully, else from report_rules —
    so a keyless deployment still gets a real analysis, and a failing provider
    (bad key, outage, rate limit) degrades instead of erroring."""
    measurements = extract_lab_measurements(text)
    rules = analyze_with_rules(text, measurements)
    entities = {
        "diagnoses": rules["diagnoses"],
        "medications": rules["medications"],
        "follow_up": rules["follow_up"],
        "lab_values": {key: m["value"] for key, m in measurements.items()},
        "lab_flags": rules["lab_flags"],
        "method": "rules",
    }
    summaries = {
        "patient_summary": rules["patient_summary"],
        "clinical_summary": rules["clinical_summary"],
    }

    provider = get_llm_provider()
    if isinstance(provider, FallbackProvider):
        return {"entities": entities, **summaries}

    try:
        entities_raw = provider.generate(
            EXTRACTION_SYSTEM_PROMPT, f"Report text:\n{text}\n\nQuestion: Extract the entities."
        )
        summaries_raw = provider.generate(
            SUMMARY_SYSTEM_PROMPT, f"Report text:\n{text}\n\nQuestion: Summarize this report."
        )
    except Exception as exc:
        print(f"[reports] LLM call failed ({type(exc).__name__}: {exc}); using rule-based analysis.")
        return {"entities": entities, **summaries}

    llm_entities = _safe_json_parse(entities_raw, {})
    for key in ("diagnoses", "medications", "follow_up"):
        value = _string_list(llm_entities.get(key))
        if value is not None:
            entities[key] = value
            entities["method"] = "llm"
    llm_summaries = _safe_json_parse(summaries_raw, {})
    for key in summaries:
        value = llm_summaries.get(key)
        if isinstance(value, str) and value.strip():
            summaries[key] = value.strip()
            entities["method"] = "llm"

    return {"entities": entities, **summaries}

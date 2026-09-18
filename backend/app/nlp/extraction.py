import json
import re
from typing import Dict

from app.rag.llm_providers import get_llm_provider

# Real pattern-based extraction for common lab values — works even
# without any LLM provider configured.
LAB_PATTERNS = {
    "glucose": r"(?:fasting glucose|blood glucose|glucose)[:\s]+([\d.]+)\s*(mg/dl|mmol/l)?",
    "hba1c": r"(?:hba1c|a1c)[:\s]+([\d.]+)\s*%?",
    "total_cholesterol": r"(?:total cholesterol|cholesterol)[:\s]+([\d.]+)\s*(mg/dl)?",
    "ldl": r"\bldl[:\s]+([\d.]+)\s*(mg/dl)?",
    "hdl": r"\bhdl[:\s]+([\d.]+)\s*(mg/dl)?",
    "blood_pressure": r"(?:blood pressure|bp)[:\s]+(\d{2,3}\s*/\s*\d{2,3})",
    "creatinine": r"creatinine[:\s]+([\d.]+)\s*(mg/dl)?",
    "hemoglobin": r"(?:hemoglobin|hb)[:\s]+([\d.]+)\s*(g/dl)?",
    "tsh": r"\btsh[:\s]+([\d.]+)\s*(uiu/ml|miu/l)?",
}


def extract_lab_values(text: str) -> Dict[str, str]:
    found = {}
    lowered = text.lower()
    for key, pattern in LAB_PATTERNS.items():
        match = re.search(pattern, lowered, re.IGNORECASE)
        if match:
            found[key] = match.group(1).strip()
    return found


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
            return json.loads(text[start:end + 1])
    except Exception:
        pass
    return fallback


def analyze_report(text: str) -> dict:
    lab_values = extract_lab_values(text)
    provider = get_llm_provider()

    entities_raw = provider.generate(EXTRACTION_SYSTEM_PROMPT, f"Report text:\n{text}\n\nQuestion: Extract the entities.")
    entities = _safe_json_parse(entities_raw, {"diagnoses": [], "medications": [], "follow_up": []})
    entities["lab_values"] = lab_values

    summaries_raw = provider.generate(SUMMARY_SYSTEM_PROMPT, f"Report text:\n{text}\n\nQuestion: Summarize this report.")
    fallback_note = "A summary could not be generated for this report."
    summaries = _safe_json_parse(summaries_raw, {
        "patient_summary": fallback_note,
        "clinical_summary": fallback_note,
    })

    return {
        "entities": entities,
        "patient_summary": summaries.get("patient_summary", fallback_note),
        "clinical_summary": summaries.get("clinical_summary", fallback_note),
    }

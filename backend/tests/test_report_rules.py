"""Report analysis without an LLM (the default, and a keyless Space's only mode).

Regression: with LLM_PROVIDER=none the app's own sample report came back with
no diagnoses, no medications and "A summary could not be generated", although
it names metformin and prediabetes outright.
"""
import pytest

from app.nlp import extraction
from app.nlp.extraction import extract_lab_measurements
from app.nlp.report_rules import find_conditions, find_follow_up, find_medications, flag_lab_values
from tests.conftest import auth

# Same text as the "Use a sample report" button in frontend/src/pages/Reports.jsx.
SAMPLE_REPORT = """Patient Lab Report - Annual Check-up
Fasting Glucose: 126 mg/dL
HbA1c: 6.7%
Total Cholesterol: 215 mg/dL
LDL: 142 mg/dL
HDL: 42 mg/dL
Blood Pressure: 136/86

Assessment: Findings consistent with prediabetes and borderline hypertension.
Prescribed: Metformin 500mg twice daily. Recommended dietary changes and follow-up in 3 months."""


# ---------- medications ----------

def test_medication_with_dose_and_frequency():
    assert find_medications("Prescribed: Metformin 500mg twice daily.") == ["metformin 500mg twice daily"]


def test_brand_names_resolve_to_generic_and_keep_the_brand():
    meds = find_medications("Taking Eliquis 5 mg BID and Lipitor 20mg at bedtime.")
    assert meds == ["apixaban (Eliquis) 5 mg BID", "atorvastatin (Lipitor) 20mg at bedtime"]


def test_longest_name_wins():
    assert find_medications("Insulin glargine 20 units at bedtime.") == ["insulin glargine 20 units at bedtime"]


@pytest.mark.parametrize(
    "text",
    [
        "Allergies: amoxicillin, sulfa.",
        "Allergic to amoxicillin.",
        "Metformin was discontinued due to GI upset.",
        "Stopped lisinopril last month because of cough.",
    ],
)
def test_allergies_and_stopped_drugs_are_not_current_medications(text):
    assert find_medications(text) == []


def test_lab_analytes_are_not_medications_but_dosed_supplements_are():
    text = (
        "Potassium: 4.1 mmol/L. Calcium 9.5 mg/dL. Vitamin D, 25-OH: 18 ng/mL. "
        "Fasting insulin: 12 uIU/mL. Start vitamin D 2000 IU daily."
    )
    assert find_medications(text) == ["vitamin d 2000 IU daily"]


def test_store_brand_aliases_are_not_drug_mentions():
    assert find_medications("Use a stool softener and a dandruff shampoo; bought at WinCo.") == []


# ---------- conditions ----------

def test_conditions_skip_negated_and_family_history_mentions():
    text = (
        "No evidence of pneumonia. Denies chest pain. History of type 2 diabetes. "
        "Family history of hypertension. Mother has asthma."
    )
    assert find_conditions(text) == ["Type 2 diabetes"]


@pytest.mark.parametrize(
    "text, expected",
    [
        ("Patient has hypertension but no diabetes.", ["Hypertension"]),
        ("Pneumonia was ruled out.", []),
        ("No fever, cough or pneumonia; has COPD.", ["COPD"]),
        ("CKD stage 3a, HTN, HLD, T2DM.",
         ["Chronic kidney disease", "Hypertension", "Hyperlipidemia", "Type 2 diabetes"]),
        ("Findings consistent with prediabetes.", ["Prediabetes"]),
        ("Type 2 diabetes mellitus without complications.", ["Type 2 diabetes"]),
    ],
)
def test_condition_cases(text, expected):
    assert find_conditions(text) == expected


def test_specific_diabetes_type_replaces_the_generic_mention():
    assert find_conditions("Diabetes follow-up. Known type 2 diabetes.") == ["Type 2 diabetes"]


# ---------- follow-up ----------

def test_follow_up_sentences():
    text = "BP 150/95. Recheck blood pressure in 2 weeks. Referred to cardiology. Labs otherwise fine."
    assert find_follow_up(text) == ["Recheck blood pressure in 2 weeks.", "Referred to cardiology."]


# ---------- lab flags ----------

def _flags(text):
    return {f["test"]: f for f in flag_lab_values(extract_lab_measurements(text))}


def test_conventional_units_are_banded():
    flags = _flags(SAMPLE_REPORT)
    assert {t: f["status"] for t, f in flags.items()} == {
        "glucose": "high",
        "hba1c": "high",
        "total_cholesterol": "borderline",
        "ldl": "borderline",
        "hdl": "normal",
        "blood_pressure": "high",
    }


@pytest.mark.parametrize(
    "text, test, status",
    [
        ("Glucose 7.8 mmol/L", "glucose", "high"),          # 140 mg/dL
        ("Glucose 5.0", "glucose", "normal"),               # no unit, clearly mmol/L
        ("HbA1c 53 mmol/mol", "hba1c", "high"),             # IFCC, ~7.0%
        ("HbA1c 36 mmol/mol", "hba1c", "normal"),           # ~5.4%
        ("Creatinine 110 umol/L", "creatinine", "normal"),  # ~1.24 mg/dL
        ("Creatinine 2.1 mg/dL", "creatinine", "high"),
        ("Hb 135 g/L", "hemoglobin", "normal"),             # 13.5 g/dL
        ("Hemoglobin 9.8 g/dL", "hemoglobin", "low"),
        ("LDL 4.2 mmol/L", "ldl", "high"),                  # ~162 mg/dL
        ("HDL 0.8 mmol/L", "hdl", "low"),                   # ~31 mg/dL
        ("TSH 6.2 mIU/L", "tsh", "high"),
        ("BP 118/76", "blood_pressure", "normal"),
        ("BP 124/78", "blood_pressure", "borderline"),
        ("BP 88/58", "blood_pressure", "low"),
    ],
)
def test_si_units_and_bands(text, test, status):
    assert _flags(text)[test]["status"] == status


def test_lab_values_keep_their_original_shape():
    # The frontend renders entities.lab_values as {test: value-string}.
    assert extraction.extract_lab_values("HbA1c 7.1%. Fasting glucose 142 mg/dL.") == {
        "hba1c": "7.1",
        "glucose": "142",
    }


# ---------- end to end ----------

def test_sample_report_gets_a_real_analysis_without_an_llm(client, tokens):
    res = client.post("/api/reports/analyze", json={"text": SAMPLE_REPORT}, headers=auth(tokens["doctor"]))
    assert res.status_code == 200, res.text
    body = res.json()
    entities = body["entities"]
    assert entities["method"] == "rules"
    assert entities["diagnoses"] == ["Prediabetes", "Hypertension"]
    assert entities["medications"] == ["metformin 500mg twice daily"]
    assert entities["follow_up"] == ["Recommended dietary changes and follow-up in 3 months."]
    assert "could not be generated" not in body["patient_summary"]
    assert "HbA1c (6.7%) is high" in body["patient_summary"]
    assert "Problems: Prediabetes; Hypertension." in body["clinical_summary"]


def test_patients_still_do_not_receive_the_clinical_summary(client, tokens):
    res = client.post("/api/reports/analyze", json={"text": SAMPLE_REPORT}, headers=auth(tokens["patient"]))
    assert res.status_code == 200
    assert res.json()["clinical_summary"] is None


class _StubProvider:
    def __init__(self, *replies, error=None):
        self.replies = list(replies)
        self.error = error

    def generate(self, system_prompt, user_prompt):
        if self.error:
            raise self.error
        return self.replies.pop(0)


def test_failing_llm_degrades_to_rules_instead_of_erroring(client, tokens, monkeypatch):
    monkeypatch.setattr(extraction, "get_llm_provider", lambda: _StubProvider(error=TimeoutError("LLM down")))
    res = client.post("/api/reports/analyze", json={"text": SAMPLE_REPORT}, headers=auth(tokens["doctor"]))
    assert res.status_code == 200
    assert res.json()["entities"]["method"] == "rules"
    assert res.json()["entities"]["medications"] == ["metformin 500mg twice daily"]


def test_llm_answers_take_precedence_and_lab_flags_stay_deterministic(monkeypatch):
    stub = _StubProvider(
        '{"diagnoses": ["Prediabetes (LLM)"], "medications": ["Metformin"], "follow_up": []}',
        '{"patient_summary": "LLM patient summary", "clinical_summary": "LLM clinical summary"}',
    )
    monkeypatch.setattr(extraction, "get_llm_provider", lambda: stub)
    result = extraction.analyze_report(SAMPLE_REPORT)
    assert result["entities"]["method"] == "llm"
    assert result["entities"]["diagnoses"] == ["Prediabetes (LLM)"]
    assert result["patient_summary"] == "LLM patient summary"
    assert len(result["entities"]["lab_flags"]) == 6


def test_unparseable_llm_output_keeps_the_rule_based_results(monkeypatch):
    monkeypatch.setattr(extraction, "get_llm_provider", lambda: _StubProvider("not json", "also not json"))
    result = extraction.analyze_report(SAMPLE_REPORT)
    assert result["entities"]["method"] == "rules"
    assert result["entities"]["diagnoses"] == ["Prediabetes", "Hypertension"]
    assert "could not be generated" not in result["patient_summary"]

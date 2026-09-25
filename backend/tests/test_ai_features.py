"""Assistant, report analysis, risk and dashboard — run with LLM_PROVIDER=none."""
import pytest

from tests.conftest import auth


def test_assistant_answers_with_sources(client, tokens):
    res = client.post(
        "/api/assistant/chat",
        json={"message": "What are the early symptoms of type 2 diabetes?"},
        headers=auth(tokens["patient"]),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["answer"]
    assert body["sources"], "retrieval-only mode should still cite knowledge-base passages"


@pytest.mark.parametrize("message", ["", "   "])
def test_assistant_rejects_empty_message(client, tokens, message):
    # Regression: an empty message ran retrieval anyway, answered with whatever
    # passage ranked first for nothing, and saved the exchange to history.
    res = client.post("/api/assistant/chat", json={"message": message}, headers=auth(tokens["patient"]))
    assert res.status_code == 422


def test_report_extracts_lab_values_without_an_llm(client, tokens):
    res = client.post(
        "/api/reports/analyze",
        json={"text": "HbA1c 7.1%. Fasting glucose 142 mg/dL. LDL 165 mg/dL. Hemoglobin 11.2 g/dL."},
        headers=auth(tokens["patient"]),
    )
    assert res.status_code == 200
    labs = res.json()["entities"]["lab_values"]
    assert labs == {"hba1c": "7.1", "glucose": "142", "ldl": "165", "hemoglobin": "11.2"}


@pytest.mark.parametrize("text", ["", "   \n  "])
def test_report_rejects_empty_text(client, tokens, text):
    # Regression: an empty report was saved and counted as analyzed.
    before = len(client.get("/api/reports", headers=auth(tokens["patient"])).json())
    res = client.post("/api/reports/analyze", json={"text": text}, headers=auth(tokens["patient"]))
    assert res.status_code == 422
    assert len(client.get("/api/reports", headers=auth(tokens["patient"])).json()) == before


VALID_RISK = {
    "age": 45, "bmi": 26, "systolic_bp": 122, "glucose": 98, "cholesterol": 190,
    "smoker": False, "family_history": False, "activity_level": 1,
}


def test_risk_scores_are_percentages(client, tokens):
    res = client.post("/api/risk/assess", json=VALID_RISK, headers=auth(tokens["patient"]))
    assert res.status_code == 200
    body = res.json()
    for key in ("diabetes_risk_pct", "heart_disease_risk_pct"):
        assert 0 <= body[key] <= 100


def test_higher_risk_inputs_score_higher(client, tokens):
    high = {
        **VALID_RISK, "age": 72, "bmi": 39, "systolic_bp": 178, "glucose": 205,
        "cholesterol": 295, "smoker": True, "family_history": True, "activity_level": 0,
    }
    low = client.post("/api/risk/assess", json=VALID_RISK, headers=auth(tokens["patient"])).json()
    hi = client.post("/api/risk/assess", json=high, headers=auth(tokens["patient"])).json()
    assert hi["diabetes_risk_pct"] > low["diabetes_risk_pct"]
    assert hi["heart_disease_risk_pct"] > low["heart_disease_risk_pct"]


def test_risk_rejects_negative_age(client, tokens):
    res = client.post("/api/risk/assess", json={**VALID_RISK, "age": -3}, headers=auth(tokens["patient"]))
    assert res.status_code == 422


@pytest.mark.parametrize("role", ["admin", "doctor", "patient"])
def test_dashboard_stats_match_role(client, tokens, role):
    res = client.get("/api/dashboard/stats", headers=auth(tokens[role]))
    assert res.status_code == 200
    assert res.json()["role"] == role

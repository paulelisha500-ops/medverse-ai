"""Who can see and change which patient's records.

The demo data has a single patient, so "can a patient open a profile by id"
can't tell reading your own record from reading someone else's. These tests
create a second patient so the boundary is actually exercised.
"""
from tests.conftest import auth


def test_patient_can_read_own_profile_and_records_by_id(client, make_patient):
    token, profile_id = make_patient()
    assert client.get(f"/api/patients/{profile_id}", headers=auth(token)).status_code == 200
    assert client.get(f"/api/patients/{profile_id}/records", headers=auth(token)).status_code == 200


def test_patient_cannot_read_another_patients_profile(client, make_patient):
    alice_token, _ = make_patient()
    _, bob_profile = make_patient()
    res = client.get(f"/api/patients/{bob_profile}", headers=auth(alice_token))
    assert res.status_code == 403


def test_patient_cannot_read_another_patients_records(client, make_patient):
    alice_token, _ = make_patient()
    _, bob_profile = make_patient()
    res = client.get(f"/api/patients/{bob_profile}/records", headers=auth(alice_token))
    assert res.status_code == 403


def test_patient_cannot_edit_another_patient_or_add_records(client, make_patient):
    alice_token, _ = make_patient()
    _, bob_profile = make_patient()
    res = client.put(f"/api/patients/{bob_profile}", json={"weight_kg": 70}, headers=auth(alice_token))
    assert res.status_code == 403
    res = client.post(
        f"/api/patients/{bob_profile}/records",
        json={"type": "condition", "title": "Injected"},
        headers=auth(alice_token),
    )
    assert res.status_code == 403


def test_patient_cannot_list_patients(client, tokens):
    assert client.get("/api/patients", headers=auth(tokens["patient"])).status_code == 403


def test_doctor_and_admin_can_read_any_patient(client, tokens, make_patient):
    _, profile_id = make_patient()
    for role in ("doctor", "admin"):
        assert client.get(f"/api/patients/{profile_id}", headers=auth(tokens[role])).status_code == 200
        assert client.get(f"/api/patients/{profile_id}/records", headers=auth(tokens[role])).status_code == 200


def test_doctor_can_add_a_record(client, tokens, make_patient):
    _, profile_id = make_patient()
    res = client.post(
        f"/api/patients/{profile_id}/records",
        json={"type": "condition", "title": "Hypertension", "details": "Stage 1"},
        headers=auth(tokens["doctor"]),
    )
    assert res.status_code == 200
    records = client.get(f"/api/patients/{profile_id}/records", headers=auth(tokens["doctor"])).json()
    assert "Hypertension" in [r["title"] for r in records]


def test_record_with_blank_title_is_rejected(client, tokens, make_patient):
    _, profile_id = make_patient()
    res = client.post(
        f"/api/patients/{profile_id}/records",
        json={"type": "condition", "title": "   "},
        headers=auth(tokens["doctor"]),
    )
    assert res.status_code == 422


def test_missing_patient_is_404(client, tokens):
    assert client.get("/api/patients/99999999", headers=auth(tokens["doctor"])).status_code == 404


def test_own_profile_update_persists_and_computes_bmi(client, make_patient):
    token, _ = make_patient()
    res = client.put("/api/patients/me/profile", json={"height_cm": 180, "weight_kg": 81}, headers=auth(token))
    assert res.status_code == 200
    assert res.json()["bmi"] == 25.0
    assert client.get("/api/patients/me/profile", headers=auth(token)).json()["weight_kg"] == 81


def test_profile_rejects_negative_weight(client, make_patient):
    token, _ = make_patient()
    res = client.put("/api/patients/me/profile", json={"weight_kg": -5}, headers=auth(token))
    assert res.status_code == 422

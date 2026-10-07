"""Booking appointments."""
from datetime import datetime, timedelta, timezone

from tests.conftest import auth


def _doctor_id(client, token):
    doctors = client.get("/api/appointments/doctors", headers=auth(token)).json()
    return doctors[0]["id"]


def _book(client, token, when, **extra):
    body = {"doctor_id": _doctor_id(client, token), "scheduled_at": when.isoformat(), **extra}
    return client.post("/api/appointments", json=body, headers=auth(token))


def test_patient_requests_an_appointment_in_the_future(client, make_patient):
    token, _ = make_patient()
    res = _book(client, token, datetime.now(timezone.utc) + timedelta(days=3), reason="Check-up")
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "requested"


def test_appointment_in_the_past_is_rejected(client, make_patient, tokens):
    token, _ = make_patient()
    res = _book(client, token, datetime(2020, 1, 1, 9, 0, tzinfo=timezone.utc))
    assert res.status_code == 400
    assert res.json()["detail"] == "Choose a date and time in the future."

    # Staff booking on a patient's behalf follows the same rule.
    patient_id = client.get("/api/auth/me", headers=auth(token)).json()["id"]
    res = _book(client, tokens["doctor"], datetime.now(timezone.utc) - timedelta(minutes=5), patient_id=patient_id)
    assert res.status_code == 400

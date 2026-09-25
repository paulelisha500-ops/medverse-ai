import uuid

import pytest

from tests.conftest import DEMO_PASSWORDS, auth


def _email(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


@pytest.mark.parametrize("role", ["admin", "doctor", "patient"])
def test_demo_accounts_sign_in_with_their_role(client, tokens, role):
    res = client.get("/api/auth/me", headers=auth(tokens[role]))
    assert res.status_code == 200
    assert res.json()["role"] == role


def test_wrong_password_is_rejected(client):
    res = client.post("/api/auth/login", data={"username": "admin@medverse.ai", "password": "nope"})
    assert res.status_code == 401


def test_requests_without_a_token_are_rejected(client):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/dashboard/stats").status_code == 401


def test_self_registration_always_creates_a_patient(client):
    res = client.post(
        "/api/auth/register",
        json={"email": _email("new"), "password": "Secret@123", "full_name": "New Person"},
    )
    assert res.status_code == 200
    assert res.json()["user"]["role"] == "patient"


def test_duplicate_email_is_rejected(client):
    res = client.post(
        "/api/auth/register",
        json={"email": "patient@medverse.ai", "password": "Secret@123", "full_name": "Duplicate"},
    )
    assert res.status_code == 400


@pytest.mark.parametrize("name", ["", "   "])
def test_blank_full_name_is_rejected(client, name):
    res = client.post(
        "/api/auth/register",
        json={"email": _email("blank"), "password": "Secret@123", "full_name": name},
    )
    assert res.status_code == 422


def test_only_admins_can_create_staff(client, tokens):
    body = {"email": _email("staff"), "password": "Secret@123", "full_name": "Dr. New", "role": "doctor"}
    assert client.post("/api/auth/create-staff", json=body, headers=auth(tokens["patient"])).status_code == 403
    assert client.post("/api/auth/create-staff", json=body, headers=auth(tokens["doctor"])).status_code == 403
    assert client.post("/api/auth/create-staff", json=body, headers=auth(tokens["admin"])).status_code == 200


def test_staff_role_must_be_doctor_or_admin(client, tokens):
    body = {"email": _email("bad"), "password": "Secret@123", "full_name": "X", "role": "superuser"}
    assert client.post("/api/auth/create-staff", json=body, headers=auth(tokens["admin"])).status_code == 400


def test_demo_passwords_fixture_matches_seed():
    # Guards the fixtures themselves: if the seed changes, fail here with a
    # clear message rather than as a confusing 401 in every other test.
    from app.db.seed import SEED_USERS

    assert {u["role"]: u["password"] for u in SEED_USERS} == DEMO_PASSWORDS

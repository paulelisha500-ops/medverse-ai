"""Shared fixtures.

The app reads its settings at import time, so the environment is pinned here,
before anything under `app` is imported:

- a throwaway SQLite file, so tests never touch data/medverse.db;
- LLM_PROVIDER=none with blank keys, so a key sitting in backend/.env can't
  turn the suite into paid, network-dependent, non-deterministic API calls.
  Environment variables take precedence over the .env file.
"""
import os
import tempfile
import uuid

_TMP = tempfile.mkdtemp(prefix="medverse-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP}/test.db"
os.environ["LLM_PROVIDER"] = "none"
os.environ["OPENAI_API_KEY"] = ""
os.environ["ANTHROPIC_API_KEY"] = ""
os.environ["SECRET_KEY"] = "test-secret-key-not-for-production"
os.environ["GOOGLE_SHEET_CSV_URL"] = ""

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

DEMO_PASSWORDS = {"admin": "Admin@123", "doctor": "Doctor@123", "patient": "Patient@123"}


@pytest.fixture(autouse=True, scope="session")
def _offline_drug_lookups():
    """openFDA and RxNorm are live public APIs. Calling them made the medication
    tests depend on network access and on label wording that changes between
    label revisions. Every lookup now fails like an unreachable network, so the
    checker exercises its curated fallback deterministically; the live-label
    matching itself is covered with recorded payloads in test_drug_data.py.

    Patches drug_data's own `requests` reference only, so other HTTP users
    (e.g. the embedding model download) are unaffected."""
    import types

    import requests

    from app.nlp import drug_data

    def _unreachable(*args, **kwargs):
        raise requests.ConnectionError("network access is disabled in tests")

    offline = types.SimpleNamespace(get=_unreachable, RequestException=requests.RequestException)
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(drug_data, "requests", offline)
        mp.setattr(drug_data, "_cache", {})
        yield


@pytest.fixture(scope="session")
def client():
    # Entering the context runs the lifespan: tables, demo seed, RAG index and
    # risk models — the same startup the real server does.
    with TestClient(app) as c:
        yield c


def _login(client, email, password):
    res = client.post("/api/auth/login", data={"username": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


@pytest.fixture(scope="session")
def tokens(client):
    return {role: _login(client, f"{role}@medverse.ai", pw) for role, pw in DEMO_PASSWORDS.items()}


def auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def make_patient(client):
    """Registers a fresh patient and returns (token, profile_id)."""

    def _make():
        email = f"patient-{uuid.uuid4().hex[:10]}@example.com"
        res = client.post(
            "/api/auth/register",
            json={"email": email, "password": "Secret@123", "full_name": "Test Patient"},
        )
        assert res.status_code == 200, res.text
        token = res.json()["access_token"]
        profile = client.get("/api/patients/me/profile", headers=auth(token))
        assert profile.status_code == 200, profile.text
        return token, profile.json()["id"]

    return _make

"""Assistant retrieval when the embedding model is unavailable.

Regression: the sentence-transformers model downloads from the Hugging Face Hub
on first boot. When that failed (Hub outage, restricted egress), every
/api/assistant/chat request raised and returned a 500. It now falls back to
TF-IDF keyword retrieval over the same knowledge base.
"""
import pytest

from app.rag import vector_store
from tests.conftest import auth


@pytest.fixture
def broken_model(monkeypatch):
    """Simulates an embedding model that can't be loaded, and counts attempts."""
    attempts = []

    def _fail():
        attempts.append(1)
        raise OSError("couldn't connect to huggingface.co")

    monkeypatch.setattr(vector_store, "get_embedding_model", _fail)
    monkeypatch.setattr(vector_store, "_model", None)
    monkeypatch.setattr(vector_store, "_index", None)
    monkeypatch.setattr(vector_store, "_chunks", [])
    monkeypatch.setattr(vector_store, "_dense_failed_at", None)
    return attempts


def test_keyword_search_ranks_the_relevant_topic_first():
    results = vector_store._lexical_search("early symptoms of type 2 diabetes", top_k=4)
    assert results
    assert results[0]["title"] == "Understanding Type 2 Diabetes"
    assert results == sorted(results, key=lambda r: -r["score"])


@pytest.mark.parametrize(
    "query, expected",
    [
        ("FAST stroke symptoms face drooping", "Stroke: Recognizing Symptoms with FAST"),
        ("what does my LDL HDL lipid panel mean", "Understanding Your Lipid Panel (Cholesterol) Results"),
        ("gout uric acid flare", "Gout"),
        # Misspellings and word variants share no whole word with the passage.
        ("migranes", "Migraine and Headache Types"),
        ("hypothyroid tiredness", "Thyroid Disorders: Hypothyroidism and Hyperthyroidism"),
    ],
)
def test_keyword_search_finds_specific_topics(query, expected):
    titles = [r["title"] for r in vector_store._lexical_search(query, top_k=3)]
    assert expected in titles


@pytest.mark.parametrize(
    "query", ["xylophone quasar zeppelin", "what is the weather in paris", "who won the football game"]
)
def test_keyword_search_returns_nothing_rather_than_filler(query):
    assert vector_store._lexical_search(query, top_k=4) == []


def test_chat_still_answers_when_the_model_cannot_load(client, tokens, broken_model):
    res = client.post(
        "/api/assistant/chat",
        json={"message": "How can I lower my blood pressure?"},
        headers=auth(tokens["patient"]),
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["sources"]
    assert any("Blood Pressure" in s["title"] for s in body["sources"])
    assert vector_store.retrieval_mode() == "keyword"


def test_failed_model_is_not_retried_on_every_request(client, tokens, broken_model):
    for _ in range(3):
        res = client.post(
            "/api/assistant/chat", json={"message": "asthma inhaler"}, headers=auth(tokens["patient"])
        )
        assert res.status_code == 200
    assert len(broken_model) == 1


def test_model_is_retried_after_the_cooldown(broken_model, monkeypatch):
    vector_store.search("asthma", top_k=2)
    assert len(broken_model) == 1
    # Pretend the cooldown has elapsed.
    monkeypatch.setattr(
        vector_store, "_dense_failed_at", vector_store._dense_failed_at - vector_store.DENSE_RETRY_SECONDS
    )
    vector_store.search("asthma", top_k=2)
    assert len(broken_model) == 2


def test_health_reports_the_retrieval_mode(client):
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["retrieval"] in ("semantic", "keyword")

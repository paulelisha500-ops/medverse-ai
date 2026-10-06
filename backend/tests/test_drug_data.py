"""Live FDA-label interaction matching, against recorded payloads.

conftest.py makes the network unreachable for the rest of the suite; these
tests swap in a fake that answers like RxNorm and openFDA do, so the parsing
and matching code runs without depending on either service.
"""
import types

import pytest
import requests

from app.nlp import drug_data
from tests.conftest import auth

WARFARIN_LABEL = (
    "7 DRUG INTERACTIONS. Drugs that increase bleeding risk: concomitant use of drugs that "
    "increase bleeding risk, such as aspirin and other NSAIDs, may increase bleeding. "
    "Botanical products should be used with caution."
)


class _Response:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status_code = status

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"{self.status_code}")


def _fake_service(labels, rxnorm_names=None):
    """labels: {lowercase name: interaction text}; rxnorm_names: {typo: canonical}."""
    rxnorm_names = rxnorm_names or {}

    def get(url, params=None, timeout=None):
        params = params or {}
        if url.endswith("/approximateTerm.json"):
            term = params["term"].lower()
            canonical = rxnorm_names.get(term, term)
            return _Response({"approximateGroup": {"candidate": [{"rxcui": canonical}]}})
        if "/rxcui/" in url:
            rxcui = url.split("/rxcui/")[1].split("/")[0]
            return _Response({"propConceptGroup": {"propConcept": [{"propValue": rxcui}]}})
        if url == drug_data.OPENFDA_BASE:
            name = params["search"].split('"')[1].lower()
            if name not in labels:
                return _Response({"error": "No matches found!"}, status=404)
            return _Response({"results": [{"drug_interactions": [labels[name]]}]})
        raise AssertionError(f"unexpected URL {url}")

    return types.SimpleNamespace(get=get, RequestException=requests.RequestException)


@pytest.fixture
def fda(monkeypatch):
    def _install(labels, rxnorm_names=None):
        monkeypatch.setattr(drug_data, "requests", _fake_service(labels, rxnorm_names))
        monkeypatch.setattr(drug_data, "_cache", {})

    return _install


def test_label_mention_is_a_hit_with_the_sentence_as_evidence(fda):
    fda({"warfarin": WARFARIN_LABEL, "aspirin": "Reye's syndrome warning."})
    result = drug_data.check_pair_live("warfarin", "aspirin")
    assert result["status"] == "hit"
    assert result["labeled_drug"] == "warfarin"
    assert "such as aspirin and other NSAIDs" in result["excerpt"]


def test_mention_is_found_from_either_label(fda):
    fda({"warfarin": WARFARIN_LABEL, "aspirin": "Reye's syndrome warning."})
    assert drug_data.check_pair_live("aspirin", "warfarin")["labeled_drug"] == "warfarin"


def test_typo_resolves_through_rxnorm_before_matching(fda):
    fda({"warfarin": WARFARIN_LABEL, "aspirin": "No relevant text."}, rxnorm_names={"asprin": "aspirin"})
    result = drug_data.check_pair_live("warfarin", "asprin")
    assert result["status"] == "hit"


def test_both_labels_without_a_mention_is_no_match(fda):
    fda({"metformin": "Carbonic anhydrase inhibitors may increase lactic acidosis risk.",
         "loratadine": "No clinically relevant interactions."})
    assert drug_data.check_pair_live("metformin", "loratadine")["status"] == "no_match"


def test_missing_label_is_unavailable_not_a_clean_bill(fda):
    fda({"warfarin": WARFARIN_LABEL})
    assert drug_data.check_pair_live("warfarin", "madeupzol")["status"] == "unavailable"


def test_matching_is_whole_word():
    # "iron" must not match inside "environment".
    assert drug_data._mentions("Store in a dry environment.", "iron") is None
    assert drug_data._mentions("Take iron supplements apart.", "iron") == "Take iron supplements apart."


def test_failures_are_not_cached(fda, monkeypatch):
    monkeypatch.setattr(drug_data, "_cache", {})
    offline = types.SimpleNamespace(
        get=lambda *a, **k: (_ for _ in ()).throw(requests.ConnectionError("down")),
        RequestException=requests.RequestException,
    )
    monkeypatch.setattr(drug_data, "requests", offline)
    assert drug_data.lookup_drug("warfarin")["label_text"] is None
    # Network back: the next lookup must not be served a cached failure.
    fda({"warfarin": WARFARIN_LABEL})
    assert drug_data.lookup_drug("warfarin")["label_text"] == WARFARIN_LABEL


def test_checker_reports_fda_label_hits_with_curated_severity(client, tokens, fda):
    fda({"warfarin": WARFARIN_LABEL, "aspirin": "Reye's syndrome warning."})
    res = client.post(
        "/api/medications/check", json={"medications": ["warfarin", "aspirin"]}, headers=auth(tokens["patient"])
    )
    assert res.status_code == 200
    body = res.json()
    assert body["unverified"] == []
    [hit] = body["interactions"]
    assert hit["source"] == "fda_label"
    assert hit["severity"] == "high"
    assert "aspirin" in hit["excerpt"]


def test_checker_marks_unreachable_drugs_as_unverified(client, tokens):
    # conftest's offline network: everything is unverified, curated pairs still reported.
    res = client.post(
        "/api/medications/check", json={"medications": ["warfarin", "aspirin"]}, headers=auth(tokens["patient"])
    )
    body = res.json()
    assert set(body["unverified"]) == {"warfarin", "aspirin"}
    assert body["interactions"][0]["source"] == "curated"

"""
Real medication interaction lookups against live public drug data sources:

- RxNorm (rxnav.nlm.nih.gov) — NLM's drug name normalization service.
  Still operational; used here for typo-tolerant name resolution.
- openFDA (api.fda.gov) — official FDA-approved drug labeling, including
  the actual "drug_interactions" / "warnings_and_cautions" text written by
  each drug's manufacturer as part of its approved label. Free, no API key.

Note: NLM's own drug-drug interaction endpoint (the old RxNav interaction
API) was discontinued in January 2024 and no longer returns data, which is
why this checks openFDA label text directly instead.

If either lookup fails (network issue, drug not found in either dataset),
callers fall back to the curated INTERACTIONS list in medication_data.py.
"""
import re
from typing import Dict, Optional

import requests

RXNORM_BASE = "https://rxnav.nlm.nih.gov/REST"
OPENFDA_BASE = "https://api.fda.gov/drug/label.json"
TIMEOUT = 6


def resolve_drug_name(name: str) -> Optional[str]:
    """Returns the canonical RxNorm name for a (possibly misspelled or
    brand) drug name, or None if RxNorm has no match / is unreachable."""
    try:
        resp = requests.get(
            f"{RXNORM_BASE}/approximateTerm.json",
            params={"term": name, "maxEntries": 1},
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        candidates = resp.json().get("approximateGroup", {}).get("candidate") or []
        if not candidates:
            return None
        rxcui = candidates[0].get("rxcui")
        if not rxcui:
            return None
        name_resp = requests.get(f"{RXNORM_BASE}/rxcui/{rxcui}/property.json", params={"propName": "RxNorm Name"}, timeout=TIMEOUT)
        name_resp.raise_for_status()
        props = name_resp.json().get("propConceptGroup", {}).get("propConcept") or []
        if props:
            return props[0].get("propValue")
    except (requests.RequestException, ValueError, KeyError):
        return None
    return None


# Prescription labels carry structured "drug_interactions" text. OTC
# labels (e.g. Tylenol) use the Drug Facts format instead, which has no
# such field — the closest equivalents are "ask_doctor_or_pharmacist"
# (literally "ask your doctor before use if you're taking...") and the
# general "warnings" section.
INTERACTION_FIELDS = (
    "drug_interactions",
    "warnings_and_cautions",
    "ask_doctor_or_pharmacist",
    "warnings",
)


def _fetch_label_by_name(name: str) -> Optional[str]:
    try:
        query = f'openfda.brand_name:"{name}" openfda.generic_name:"{name}"'
        resp = requests.get(OPENFDA_BASE, params={"search": query, "limit": 1}, timeout=TIMEOUT)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        results = resp.json().get("results") or []
        if not results:
            return None
        label = results[0]
        for field in INTERACTION_FIELDS:
            text_field = label.get(field)
            if text_field:
                return " ".join(text_field) if isinstance(text_field, list) else str(text_field)
        return None
    except (requests.RequestException, ValueError, KeyError):
        return None


def lookup_drug(name: str) -> Dict:
    """Resolves a (possibly misspelled or brand) drug name and fetches its
    official FDA label interaction text. Returns
    {canonical_name, label_text} — canonical_name falls back to the RxNorm
    resolution (or the original input) even when no label text was found,
    so callers can still search for mentions of it by its standardized
    name rather than a user's typo."""
    text = _fetch_label_by_name(name)
    canonical = resolve_drug_name(name) or name

    if text is None and canonical.lower() != name.lower():
        text = _fetch_label_by_name(canonical)

    return {"canonical_name": canonical, "label_text": text}


def _mentions(haystack: str, needle: str) -> Optional[str]:
    """Returns the sentence mentioning `needle` in `haystack`, if any."""
    pattern = re.escape(needle.strip())
    if not pattern:
        return None
    sentences = re.split(r"(?<=[.!?])\s+", haystack)
    for sentence in sentences:
        if re.search(pattern, sentence, re.IGNORECASE):
            return sentence.strip()[:400]
    return None


def check_pair_live(drug_a: str, drug_b: str) -> Dict:
    """Checks whether drug_a's or drug_b's official FDA label text mentions
    the other (searching by RxNorm-resolved canonical name, so typos and
    brand names still match). Returns a dict with status "hit" (interaction
    found), "no_match" (both labels found, neither mentions the other), or
    "unavailable" (neither label could be found/reached — caller should
    fall back to the curated dataset in that case, see medications.py)."""
    a = lookup_drug(drug_a)
    b = lookup_drug(drug_b)

    if a["label_text"]:
        match = _mentions(a["label_text"], b["canonical_name"]) or _mentions(a["label_text"], drug_b)
        if match:
            return {
                "status": "hit", "drug_a": drug_a, "drug_b": drug_b, "source": "fda_label",
                "excerpt": match, "labeled_drug": drug_a, "mentioned_drug": drug_b,
            }
    if b["label_text"]:
        match = _mentions(b["label_text"], a["canonical_name"]) or _mentions(b["label_text"], drug_a)
        if match:
            return {
                "status": "hit", "drug_a": drug_a, "drug_b": drug_b, "source": "fda_label",
                "excerpt": match, "labeled_drug": drug_b, "mentioned_drug": drug_a,
            }

    if a["label_text"] is None and b["label_text"] is None:
        return {"status": "unavailable"}
    return {"status": "no_match"}

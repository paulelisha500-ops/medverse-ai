"""
Optional live sync of the drug *directory* (autocomplete names/categories/dosages)
from a published Google Sheet CSV export. Off by default (GOOGLE_SHEET_CSV_URL unset).

Scope, deliberately narrow: a sheet can only add to or override DRUG_INFO entries
(what the autocomplete shows). It can never add BRAND_TO_GENERIC aliases or
INTERACTIONS pairs — those stay code-reviewed, since a bad interaction/severity
claim is a safety issue, not just a stale dosage note. Any fetch/parse failure
falls back silently to the built-in DRUG_INFO so the feature is never load-bearing.

Expected columns (case-insensitive header match), same shape as the .xlsx export:
Generic Name | Category | Brand / Alternate Names | Typical Adult Dosage
"""
import csv
import io
import time
from typing import Dict, Optional

import requests

_CACHE: Dict[str, tuple] = {}  # url -> (fetched_at, parsed_dict)
_CACHE_TTL_SECONDS = 15 * 60


def _parse_csv(text: str) -> Dict[str, Dict[str, str]]:
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        return {}
    # Normalize header names so minor spreadsheet edits (extra spaces, case) don't break parsing.
    field_map = {(f or "").strip().lower(): f for f in reader.fieldnames}

    def get(row, *candidates):
        for c in candidates:
            key = field_map.get(c)
            if key is not None:
                return (row.get(key) or "").strip()
        return ""

    parsed: Dict[str, Dict[str, str]] = {}
    for row in reader:
        name = get(row, "generic name", "name").lower()
        dosage = get(row, "typical adult dosage", "dosage")
        if not name or not dosage:
            continue
        parsed[name] = {
            "dosage": dosage,
            "category": get(row, "category") or "Other",
        }
    return parsed


def fetch_sheet_drug_info(url: str, timeout: float = 5.0) -> Optional[Dict[str, Dict[str, str]]]:
    """Fetch + parse the published sheet, with a short in-memory cache. Returns
    None on any failure (network, HTTP, empty/malformed CSV) — callers should
    treat None as "keep using the built-in directory"."""
    if not url:
        return None

    cached = _CACHE.get(url)
    if cached and (time.time() - cached[0]) < _CACHE_TTL_SECONDS:
        return cached[1]

    try:
        resp = requests.get(url, timeout=timeout)
        resp.raise_for_status()
        parsed = _parse_csv(resp.text)
        if not parsed:
            return None
        _CACHE[url] = (time.time(), parsed)
        return parsed
    except Exception:
        return None

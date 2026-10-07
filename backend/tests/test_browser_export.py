"""The browser edition (frontend/src/browser/) runs on data exported from the
Python sources by scripts/export_browser_data.py. These fail when a source
changes and the export isn't re-run, so the two editions can't drift apart."""
import base64
import importlib.util
import json
import math
import os

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_spec = importlib.util.spec_from_file_location(
    "export_browser_data", os.path.join(BACKEND, "scripts", "export_browser_data.py")
)
export = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(export)

STALE = "is out of date: run `python scripts/export_browser_data.py` from backend/"


def _committed(name):
    with open(os.path.join(export.OUT_DIR, name), encoding="utf-8") as f:
        return json.load(f)


def _first_difference(committed, fresh, path):
    """Where two exports differ, or None. Floats need only agree to about nine
    significant digits: the risk models are retrained for the comparison, and
    numpy builds differ in the last bit between platforms (Windows here, Linux
    in CI). A stale export differs far more than that."""
    if isinstance(committed, float) or isinstance(fresh, float):
        numbers = all(isinstance(x, (int, float)) and not isinstance(x, bool) for x in (committed, fresh))
        return None if numbers and math.isclose(committed, fresh, rel_tol=1e-9, abs_tol=1e-12) else path
    if isinstance(committed, dict) and isinstance(fresh, dict):
        if committed.keys() != fresh.keys():
            return path
        diffs = (_first_difference(committed[k], fresh[k], f"{path}.{k}") for k in committed)
        return next((d for d in diffs if d), None)
    if isinstance(committed, list) and isinstance(fresh, list):
        if len(committed) != len(fresh):
            return path
        diffs = (_first_difference(a, b, f"{path}[{i}]") for i, (a, b) in enumerate(zip(committed, fresh)))
        return next((d for d in diffs if d), None)
    return None if committed == fresh else path


def test_exported_data_matches_sources():
    for name, data in export.build_all(with_embeddings=False).items():
        if name == "knowledge-base.json":
            continue
        diff = _first_difference(_committed(name), json.loads(json.dumps(data)), name)
        assert diff is None, f"{name} {STALE} (first difference at {diff})"


def test_export_comparison_still_catches_stale_data():
    committed = _committed("risk-models.json")
    assert _first_difference(committed, json.loads(json.dumps(committed)), "risk") is None
    stale = json.loads(json.dumps(committed))
    stale["models"]["diabetes"]["intercept"] += 0.001
    assert _first_difference(committed, stale, "risk") == "risk.models.diabetes.intercept"
    stale = json.loads(json.dumps(committed))
    stale["features"].append("waist")
    assert _first_difference(committed, stale, "risk") == "risk.features"


def test_knowledge_base_export_matches_sources():
    committed = _committed("knowledge-base.json")
    chunks = export.knowledge_base(with_embeddings=False)["chunks"]
    assert committed["chunks"] == chunks, f"knowledge-base.json {STALE}"
    # One normalized float32 vector per chunk.
    vectors = base64.b64decode(committed["embeddings"])
    assert len(vectors) == 4 * committed["dim"] * len(chunks)

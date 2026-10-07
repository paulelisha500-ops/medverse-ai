"""The browser edition (frontend/src/browser/) runs on data exported from the
Python sources by scripts/export_browser_data.py. These fail when a source
changes and the export isn't re-run, so the two editions can't drift apart."""
import base64
import importlib.util
import json
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


def test_exported_data_matches_sources():
    for name, data in export.build_all(with_embeddings=False).items():
        if name == "knowledge-base.json":
            continue
        assert _committed(name) == json.loads(json.dumps(data)), f"{name} {STALE}"


def test_knowledge_base_export_matches_sources():
    committed = _committed("knowledge-base.json")
    chunks = export.knowledge_base(with_embeddings=False)["chunks"]
    assert committed["chunks"] == chunks, f"knowledge-base.json {STALE}"
    # One normalized float32 vector per chunk.
    vectors = base64.b64decode(committed["embeddings"])
    assert len(vectors) == 4 * committed["dim"] * len(chunks)

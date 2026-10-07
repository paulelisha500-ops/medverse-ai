"""
Export the data the browser edition needs (frontend/src/browser/data/).

The browser edition runs the whole app client-side, so it can be hosted as
plain static files (Hugging Face static Space, GitHub Pages). Everything it
knows comes from the same Python sources the API uses, exported here so the
two can't drift apart:

  knowledge-base.json   KB chunks + their all-MiniLM-L6-v2 embeddings
  medications.json      drug directory, brand aliases, curated interactions
  dose-conversion.json  equivalent-dose tables and caveats
  risk-models.json      fitted scaler + logistic-regression parameters
  lab-patterns.json     report lab-value regexes
  seed.json             the accounts and sample record a fresh install starts with

Run from backend/ after changing any of those sources:

    python scripts/export_browser_data.py

tests/test_browser_export.py fails when the committed files are stale.
"""
import base64
import json
import os
import pickle
import secrets
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
OUT_DIR = os.path.join(os.path.dirname(BACKEND), "frontend", "src", "browser", "data")
sys.path.insert(0, BACKEND)

# Importing app modules builds Settings, which refuses to load without a
# SECRET_KEY. Nothing here signs a token, so a throwaway value is enough.
os.environ.setdefault("SECRET_KEY", secrets.token_hex(32))
# The directory must be the built-in one, never a configured Google Sheet.
os.environ["GOOGLE_SHEET_CSV_URL"] = ""

from app.db.seed import SEED_PATIENT_PROFILE, SEED_RECORDS, SEED_USERS  # noqa: E402
from app.ml import train_risk_model  # noqa: E402
from app.ml.risk_model import TIPS  # noqa: E402
from app.nlp import dose_conversion, medication_data  # noqa: E402
from app.nlp.extraction import LAB_PATTERNS  # noqa: E402
from app.rag.vector_store import parse_knowledge_base  # noqa: E402

EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


def knowledge_base(with_embeddings: bool = True) -> dict:
    chunks = parse_knowledge_base()
    data = {"model": EMBEDDING_MODEL, "chunks": chunks}
    if with_embeddings:
        import numpy as np
        from sentence_transformers import SentenceTransformer

        model = SentenceTransformer(EMBEDDING_MODEL)
        # Same text the API indexes (vector_store.build_index).
        texts = [f"{c['title']}. {c['text']}" for c in chunks]
        vectors = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        vectors = np.asarray(vectors, dtype="<f4")
        data["dim"] = int(vectors.shape[1])
        data["embeddings"] = base64.b64encode(vectors.tobytes()).decode("ascii")
    return data


def medications() -> dict:
    return {
        "brand_to_generic": medication_data.BRAND_TO_GENERIC,
        "curated_names": list(medication_data.DRUG_INFO),
        "directory": medication_data.get_drug_directory(),
        "interactions": [
            {"drugs": list(item["drugs"]), "description": item["description"], "severity": item["severity"]}
            for item in medication_data.INTERACTIONS
        ],
    }


def dose_tables() -> dict:
    return {
        "families": dose_conversion.get_conversion_families(),
        "tables": {
            "opioid": dose_conversion.OPIOID_MME,
            "corticosteroid": dose_conversion.STEROID_EQUIV_MG,
            "benzodiazepine": dose_conversion.BENZO_EQUIV_MG,
        },
        "opioid_excluded": dose_conversion.OPIOID_EXCLUDED,
    }


def risk_models() -> dict:
    models = {}
    with tempfile.TemporaryDirectory() as tmp:
        for condition in ("diabetes", "heart"):
            path = os.path.join(tmp, f"{condition}.pkl")
            # Seeded, so this is the exact model the API trains on first run.
            train_risk_model.train_and_save(condition, path)
            with open(path, "rb") as f:
                bundle = pickle.load(f)
            models[condition] = {
                "mean": bundle["scaler"].mean_.tolist(),
                "scale": bundle["scaler"].scale_.tolist(),
                "coef": bundle["model"].coef_[0].tolist(),
                "intercept": float(bundle["model"].intercept_[0]),
            }
    return {"features": train_risk_model.FEATURES, "tips": TIPS, "models": models}


def seed() -> dict:
    return {"users": SEED_USERS, "patient_profile": SEED_PATIENT_PROFILE, "records": SEED_RECORDS}


def build_all(with_embeddings: bool = True) -> dict:
    return {
        "knowledge-base.json": knowledge_base(with_embeddings),
        "medications.json": medications(),
        "dose-conversion.json": dose_tables(),
        "risk-models.json": risk_models(),
        "lab-patterns.json": {"patterns": LAB_PATTERNS},
        "seed.json": seed(),
    }


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    for name, data in build_all().items():
        path = os.path.join(OUT_DIR, name)
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
            f.write("\n")
        print(f"{os.path.relpath(path, os.path.dirname(BACKEND))}: {os.path.getsize(path):,} bytes")


if __name__ == "__main__":
    main()

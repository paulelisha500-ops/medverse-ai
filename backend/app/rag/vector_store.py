import json
import os
import re
from typing import List, Dict

import numpy as np

from app.core.config import settings

KB_DIR = os.path.join(os.path.dirname(__file__), "knowledge_base")
KB_FILE = os.path.join(KB_DIR, "health_topics.md")

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")
INDEX_PATH = os.path.join(DATA_DIR, "kb_index.faiss")
CHUNKS_PATH = os.path.join(DATA_DIR, "kb_chunks.json")

_model = None
_index = None
_chunks: List[Dict] = []


def get_embedding_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer(settings.EMBEDDING_MODEL)
    return _model


def parse_knowledge_base() -> List[Dict]:
    """Splits health_topics.md into (title, text) chunks on '# TOPIC:' headers."""
    with open(KB_FILE, "r", encoding="utf-8") as f:
        raw = f.read()

    sections = re.split(r"^# TOPIC:\s*", raw, flags=re.MULTILINE)
    chunks = []
    for section in sections:
        section = section.strip()
        if not section:
            continue
        lines = section.split("\n", 1)
        title = lines[0].strip()
        body = lines[1].strip() if len(lines) > 1 else ""
        if body:
            chunks.append({"title": title, "text": body})
    return chunks


def build_index(force: bool = False) -> None:
    global _index, _chunks
    import faiss

    os.makedirs(DATA_DIR, exist_ok=True)

    if not force and os.path.exists(INDEX_PATH) and os.path.exists(CHUNKS_PATH):
        _index = faiss.read_index(INDEX_PATH)
        with open(CHUNKS_PATH, "r", encoding="utf-8") as f:
            _chunks = json.load(f)
        return

    chunks = parse_knowledge_base()
    model = get_embedding_model()
    texts = [f"{c['title']}. {c['text']}" for c in chunks]
    embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    embeddings = np.asarray(embeddings).astype("float32")

    dim = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)
    index.add(embeddings)

    faiss.write_index(index, INDEX_PATH)
    with open(CHUNKS_PATH, "w", encoding="utf-8") as f:
        json.dump(chunks, f, ensure_ascii=False, indent=2)

    _index = index
    _chunks = chunks


def ensure_index_ready() -> None:
    if _index is None or not _chunks:
        build_index(force=False)


def search(query: str, top_k: int = 4) -> List[Dict]:
    ensure_index_ready()
    model = get_embedding_model()
    q_emb = model.encode([query], normalize_embeddings=True, show_progress_bar=False)
    q_emb = np.asarray(q_emb).astype("float32")

    scores, indices = _index.search(q_emb, min(top_k, len(_chunks)))

    results = []
    for score, idx in zip(scores[0], indices[0]):
        if idx == -1:
            continue
        chunk = _chunks[idx]
        results.append({"title": chunk["title"], "text": chunk["text"], "score": float(score)})
    return results

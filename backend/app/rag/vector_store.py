import json
import os
import re
import time
from typing import List, Dict, Optional

import numpy as np

from app.core.config import settings

KB_DIR = os.path.join(os.path.dirname(__file__), "knowledge_base")
KB_FILE = os.path.join(KB_DIR, "health_topics.md")

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")
INDEX_PATH = os.path.join(DATA_DIR, "kb_index.faiss")
CHUNKS_PATH = os.path.join(DATA_DIR, "kb_chunks.json")

# After the embedding model fails to load (Hub unreachable, no disk space, ...)
# searches use keyword retrieval for this long before trying the model again,
# so a Hub outage costs one slow request per window instead of one per request.
DENSE_RETRY_SECONDS = 300

_model = None
_index = None
_chunks: List[Dict] = []
_dense_failed_at: Optional[float] = None
_lexical = None  # ((word vectorizer, matrix), (char vectorizer, matrix), chunks)


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


def warm_up() -> str:
    """Loads the FAISS index and the embedding model into memory eagerly.

    Without this, both are lazy-loaded on the first /assistant/chat request —
    the sentence-transformers model in particular takes several seconds to
    load (torch + tokenizer + weights), so the first real user query would
    otherwise stall for that long. Called once at startup instead.

    Returns the retrieval mode that will serve requests. If the model can't be
    loaded, the keyword index is built instead so the assistant still works.
    """
    try:
        ensure_index_ready()
        model = get_embedding_model()
        model.encode(["warm-up"], normalize_embeddings=True, show_progress_bar=False)
    except Exception as exc:
        _mark_dense_failed(exc)
        _lexical_index()
    return retrieval_mode()


def retrieval_mode() -> str:
    """"semantic" once the embedding model and FAISS index are loaded, else
    "keyword" (TF-IDF over the same knowledge base)."""
    return "semantic" if _model is not None and _index is not None else "keyword"


def _mark_dense_failed(exc: Exception) -> None:
    global _dense_failed_at
    _dense_failed_at = time.monotonic()
    print(
        f"[rag] Embedding model unavailable ({type(exc).__name__}: {exc}). Using keyword "
        f"retrieval; will retry the model in {DENSE_RETRY_SECONDS}s."
    )


def _dense_search(query: str, top_k: int) -> List[Dict]:
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


# Blended keyword scores below this are noise: off-topic questions ("weather in
# Paris") peak around 0.03-0.04 against this knowledge base, while misspelled
# but on-topic ones ("migranes", "diabetis symptoms") score 0.065 and up.
MIN_KEYWORD_SCORE = 0.05


def _lexical_index():
    global _lexical
    if _lexical is None:
        from sklearn.feature_extraction.text import TfidfVectorizer

        chunks = parse_knowledge_base()
        docs = [f"{c['title']}. {c['text']}" for c in chunks]
        # Words: token_pattern keeps 1-character tokens. The default drops them,
        # which makes "type 2 diabetes" and "type 1 diabetes" the same query.
        words = TfidfVectorizer(
            stop_words="english", ngram_range=(1, 2), sublinear_tf=True, token_pattern=r"(?u)\b\w+\b"
        )
        # Character n-grams catch typos and word variants ("migranes",
        # "hypothyroid") that share no whole word with the passage.
        chars = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True)
        _lexical = ((words, words.fit_transform(docs)), (chars, chars.fit_transform(docs)), chunks)
    return _lexical


def _lexical_search(query: str, top_k: int) -> List[Dict]:
    """Keyword retrieval: the mean of word and character-n-gram TF-IDF cosine
    similarity. Weak matches are dropped rather than returned as filler, so an
    off-topic question gets an honest "nothing found", not an unrelated passage."""
    *views, chunks = _lexical_index()
    # Rows are L2-normalized by TfidfVectorizer, so each dot product is a cosine.
    scores = sum((matrix @ vec.transform([query]).T).toarray().ravel() for vec, matrix in views) / len(views)
    ranked = np.argsort(-scores, kind="stable")[:top_k]
    return [
        {"title": chunks[i]["title"], "text": chunks[i]["text"], "score": float(scores[i])}
        for i in ranked
        if scores[i] >= MIN_KEYWORD_SCORE
    ]


def search(query: str, top_k: int = 4) -> List[Dict]:
    global _dense_failed_at
    dense_due = _dense_failed_at is None or time.monotonic() - _dense_failed_at >= DENSE_RETRY_SECONDS
    if dense_due:
        try:
            results = _dense_search(query, top_k)
            _dense_failed_at = None
            return results
        except Exception as exc:
            _mark_dense_failed(exc)
    return _lexical_search(query, top_k)

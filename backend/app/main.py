import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.api import appointments, assistant, auth, dashboard, medications, patients, reminders, reports, risk
from app.core.config import settings
from app.db import models
from app.db.database import Base, SessionLocal, engine, run_lightweight_migrations
from app.db.migrate import run_light_migrations
from app.db.seed import run_seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables, run lightweight migrations, seed data, warm up RAG index + risk models
    Base.metadata.create_all(bind=engine)
    run_lightweight_migrations()
    run_light_migrations(engine)

    db = SessionLocal()
    try:
        run_seed(db)
    finally:
        db.close()

    try:
        from app.rag.vector_store import warm_up

        # Loads the embedding model into memory now (several seconds, torch +
        # tokenizer + weights) instead of on a user's first assistant message.
        print(f"[startup] Assistant retrieval mode: {warm_up()}")
    except Exception as exc:  # pragma: no cover
        print(f"[startup] RAG index/model not ready yet ({exc}). It will build on first request.")

    try:
        from app.ml.risk_model import warm_up as warm_up_risk_models

        warm_up_risk_models()
    except Exception as exc:  # pragma: no cover
        print(f"[startup] Risk models not trained yet ({exc}).")

    yield
    # Shutdown: nothing to clean up


app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(assistant.router)
app.include_router(reports.router)
app.include_router(risk.router)
app.include_router(medications.router)
app.include_router(dashboard.router)
app.include_router(appointments.router)
app.include_router(reminders.router)


@app.get("/api/health")
def health():
    from app.rag.vector_store import retrieval_mode

    # "keyword" means the embedding model couldn't load (e.g. the Hub was
    # unreachable at boot) and the assistant is on its TF-IDF fallback.
    return {"status": "ok", "app": settings.APP_NAME, "retrieval": retrieval_mode()}


# ---------- Built frontend (single-container deployment, e.g. HF Spaces) ----------
# When the Vite build is copied in at STATIC_DIR (see root Dockerfile), serve it and
# fall back to index.html for any non-API path so React Router can handle it. Local
# dev (npm run dev / docker-compose) doesn't set this, so nothing changes there.

STATIC_DIR = os.environ.get("STATIC_DIR", "")


def resolve_static_file(static_dir: str, full_path: str) -> str | None:
    """Returns the real path of `full_path` inside `static_dir`, or None.

    The path parameter arrives URL-decoded, so "/..%2fdata%2fmedverse.db" is
    "../data/medverse.db" here. A plain os.path.join would serve the database,
    /proc/self/environ (SECRET_KEY, API keys) or any other readable file;
    resolving symlinks and ".." first and requiring the result to stay under
    static_dir closes that.
    """
    if not full_path:
        return None
    root = os.path.realpath(static_dir)
    candidate = os.path.realpath(os.path.join(root, full_path))
    if os.path.commonpath([root, candidate]) != root or not os.path.isfile(candidate):
        return None
    return candidate


def mount_spa(target: FastAPI, static_dir: str) -> None:
    """Registers the catch-all that serves the built frontend from static_dir.
    Must run after every API router is included, since it matches any path."""

    @target.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        # An unknown API route is a client bug, not a page: answer like the API
        # does instead of handing back index.html with a 200.
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        static_file = resolve_static_file(static_dir, full_path)
        if static_file:
            return FileResponse(static_file)
        return FileResponse(os.path.join(static_dir, "index.html"))


if STATIC_DIR and os.path.isdir(STATIC_DIR):
    mount_spa(app, STATIC_DIR)

import os
from contextlib import asynccontextmanager
from typing import Optional

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
        warm_up()
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
    return {"status": "ok", "app": settings.APP_NAME}


# ---------- Built frontend (single-container deployment, e.g. HF Spaces) ----------
# When the Vite build is copied in at STATIC_DIR (see root Dockerfile), serve it and
# fall back to index.html for any non-API path so React Router can handle it. Local
# dev (npm run dev / docker-compose) doesn't set this, so nothing changes there.


def resolve_static_file(static_dir: str, request_path: str) -> Optional[str]:
    """Maps a request path to a real file inside static_dir, or None.

    The path arrives percent-decoded, so "..%2f" is already "../" by the time it
    gets here, and an absolute path ("/etc/passwd", or "C:/..." on Windows)
    makes os.path.join throw static_dir away entirely. Joining it naively let
    GET /..%2fdata%2fmedverse.db download the whole database. Resolving ".."
    and symlinks first, then requiring the result to still sit under
    static_dir, closes all of those at once.
    """
    if not request_path or "\x00" in request_path:
        return None
    root = os.path.realpath(static_dir)
    candidate = os.path.realpath(os.path.join(root, request_path))
    try:
        inside = os.path.commonpath([root, candidate]) == root
    except ValueError:  # different drives on Windows
        return None
    if inside and candidate != root and os.path.isfile(candidate):
        return candidate
    return None


def mount_frontend(app: FastAPI, static_dir: str) -> None:
    index_html = os.path.join(static_dir, "index.html")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        # A mistyped API call should fail the way the API does, not come back
        # 200 with the app's HTML (which the client would then try to parse).
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        static_file = resolve_static_file(static_dir, full_path)
        return FileResponse(static_file or index_html)


STATIC_DIR = os.environ.get("STATIC_DIR", "")

if STATIC_DIR and os.path.isdir(STATIC_DIR):
    mount_frontend(app, STATIC_DIR)

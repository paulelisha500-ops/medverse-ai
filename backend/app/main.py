import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
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

STATIC_DIR = os.environ.get("STATIC_DIR", "")

if STATIC_DIR and os.path.isdir(STATIC_DIR):

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        candidate = os.path.join(STATIC_DIR, full_path)
        if full_path and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))

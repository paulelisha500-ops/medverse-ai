from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
        from app.rag.vector_store import ensure_index_ready

        ensure_index_ready()
    except Exception as exc:  # pragma: no cover
        print(f"[startup] RAG index not built yet ({exc}). It will build on first request.")

    try:
        from app.ml.train_risk_model import ensure_models_trained

        ensure_models_trained()
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

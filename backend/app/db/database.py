import os

from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

# Make sure the SQLite data directory exists before the engine touches it
if settings.DATABASE_URL.startswith("sqlite"):
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    db_dir = os.path.dirname(db_path)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_lightweight_migrations() -> None:
    """Adds columns introduced after a database file already existed.

    Base.metadata.create_all only creates missing tables, not missing
    columns on existing ones — this covers that gap for SQLite without
    pulling in a full migration framework.
    """
    if not settings.DATABASE_URL.startswith("sqlite"):
        return
    with engine.connect() as conn:
        table_exists = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        ).first()
        if not table_exists:
            return
        columns = {row[1] for row in conn.execute(text("PRAGMA table_info(users)"))}
        if "phone" not in columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN phone TEXT"))
            conn.commit()

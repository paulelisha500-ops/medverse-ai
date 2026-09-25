"""
Tiny additive migration: adds any model columns missing from existing tables.
There's no Alembic in this project (SQLite, demo scale) — this keeps local/dev
databases in sync with models.py across schema changes without wiping data.
"""
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from app.db.database import Base

_SQL_TYPES = {
    "STRING": "VARCHAR",
    "TEXT": "TEXT",
    "FLOAT": "FLOAT",
    "INTEGER": "INTEGER",
    "BOOLEAN": "BOOLEAN",
    "DATETIME": "DATETIME",
    "JSON": "JSON",
}


def run_light_migrations(engine: Engine) -> None:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if table.name not in existing_tables:
                continue  # brand-new table — create_all already handled it
            existing_columns = {c["name"] for c in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name in existing_columns:
                    continue
                col_type = _SQL_TYPES.get(column.type.__class__.__name__.upper(), str(column.type))
                conn.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {col_type}'))
                print(f"[migrate] Added column {table.name}.{column.name}")

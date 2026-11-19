"""Database access layer.

Two backends, chosen by environment:
- DATABASE_URL set (e.g. Supabase Postgres) -> psycopg3, %s params
- otherwise -> local SQLite file (dev, tests, offline demo)

All queries in the app use "?" placeholders; the Postgres wrapper translates
them to "%s". Callers always use `with get_conn() as conn:` which commits on
success and rolls back on error, for both backends.
"""

import os
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def db_path() -> Path:
    return Path(os.environ.get("DB_PATH") or (BASE_DIR / "hub.db"))


def upload_dir() -> Path:
    return Path(os.environ.get("UPLOAD_DIR") or (BASE_DIR / "uploads"))


def using_postgres() -> bool:
    return bool(os.environ.get("DATABASE_URL"))


SCHEMA_SQLITE = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    department TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('senior', 'junior', 'moderator')),
    year INTEGER
);

CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    semester INTEGER NOT NULL,
    department TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS resources (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    resource_type TEXT NOT NULL CHECK (resource_type IN ('notes', 'previous_paper', 'tips')),
    subject_id INTEGER NOT NULL REFERENCES subjects(id),
    uploader_id INTEGER NOT NULL REFERENCES users(id),
    file_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    file_hash TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    reject_reason TEXT,
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TEXT,
    download_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    resource_id INTEGER NOT NULL REFERENCES resources(id),
    created_at TEXT NOT NULL,
    UNIQUE (user_id, resource_id)
);

CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY,
    resource_id INTEGER NOT NULL REFERENCES resources(id),
    reporter_id INTEGER NOT NULL REFERENCES users(id),
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_resources_status ON resources(status);
CREATE INDEX IF NOT EXISTS idx_resources_subject ON resources(subject_id);
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(resource_type);
"""

SCHEMA_POSTGRES = """
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    department TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('senior', 'junior', 'moderator')),
    year INTEGER
);

CREATE TABLE IF NOT EXISTS subjects (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    semester INTEGER NOT NULL,
    department TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS resources (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    resource_type TEXT NOT NULL CHECK (resource_type IN ('notes', 'previous_paper', 'tips')),
    subject_id INTEGER NOT NULL REFERENCES subjects(id),
    uploader_id INTEGER NOT NULL REFERENCES users(id),
    file_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    file_hash TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    reject_reason TEXT,
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TEXT,
    download_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookmarks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    resource_id INTEGER NOT NULL REFERENCES resources(id),
    created_at TEXT NOT NULL,
    UNIQUE (user_id, resource_id)
);

CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    resource_id INTEGER NOT NULL REFERENCES resources(id),
    reporter_id INTEGER NOT NULL REFERENCES users(id),
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_resources_status ON resources(status);
CREATE INDEX IF NOT EXISTS idx_resources_subject ON resources(subject_id);
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(resource_type);
"""


def _split_sql(script: str):
    return [s.strip() for s in script.split(";") if s.strip()]


class _SqliteConn:
    def __init__(self):
        self._conn = sqlite3.connect(db_path())
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA foreign_keys = ON")

    def execute(self, sql, params=()):
        return self._conn.execute(sql, params)

    def executemany(self, sql, seq):
        return self._conn.executemany(sql, seq)

    def executescript(self, script):
        return self._conn.executescript(script)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        try:
            if exc_type:
                self._conn.rollback()
            else:
                self._conn.commit()
        finally:
            self._conn.close()
        return False


class _PgConn:
    """Thin psycopg3 wrapper presenting the sqlite-style API used by the app."""

    def __init__(self):
        import psycopg
        from psycopg.rows import dict_row

        self._conn = psycopg.connect(
            os.environ["DATABASE_URL"], row_factory=dict_row, autocommit=False
        )

    def execute(self, sql, params=()):
        return self._conn.execute(sql.replace("?", "%s"), params)

    def executemany(self, sql, seq):
        sql = sql.replace("?", "%s")
        return self._conn.cursor().executemany(sql, seq)

    def executescript(self, script):
        for stmt in _split_sql(script):
            self._conn.execute(stmt)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        try:
            if exc_type:
                self._conn.rollback()
            else:
                self._conn.commit()
        finally:
            self._conn.close()
        return False


def get_conn():
    return _PgConn() if using_postgres() else _SqliteConn()


def init_db() -> None:
    if using_postgres():
        with get_conn() as conn:
            conn.executescript(SCHEMA_POSTGRES)
        return
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    upload_dir().mkdir(parents=True, exist_ok=True)
    with get_conn() as conn:
        conn.executescript(SCHEMA_SQLITE)

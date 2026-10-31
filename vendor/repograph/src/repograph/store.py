"""SQLite persistence.

Single local database, WAL mode, relative paths only. All user-controlled
values are bound parameters; identifiers are never interpolated into SQL.
"""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

from .config import Settings

SCHEMA_VERSION = "1"

SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    lang TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    size INTEGER NOT NULL,
    mtime REAL NOT NULL,
    parsed INTEGER NOT NULL DEFAULT 1,
    parse_error TEXT,
    is_test INTEGER NOT NULL DEFAULT 0,
    indexed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS symbols (
    id INTEGER PRIMARY KEY,
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    qualified_name TEXT NOT NULL,
    kind TEXT NOT NULL,
    start_line INTEGER NOT NULL,
    end_line INTEGER NOT NULL,
    start_col INTEGER NOT NULL,
    end_col INTEGER NOT NULL,
    tags TEXT NOT NULL DEFAULT '',
    is_exported INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS imports (
    id INTEGER PRIMARY KEY,
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    raw TEXT NOT NULL,
    module TEXT NOT NULL,
    line INTEGER NOT NULL,
    target_file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
    confidence TEXT NOT NULL,
    method TEXT NOT NULL,
    kind TEXT NOT NULL,
    names TEXT NOT NULL DEFAULT '[]',
    note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS refs (
    id INTEGER PRIMARY KEY,
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    line INTEGER NOT NULL,
    col INTEGER NOT NULL,
    kind TEXT NOT NULL,
    confidence TEXT NOT NULL,
    method TEXT NOT NULL,
    target_file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
    target_name TEXT
);
CREATE TABLE IF NOT EXISTS routes (
    id INTEGER PRIMARY KEY,
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    handler TEXT NOT NULL,
    line INTEGER NOT NULL,
    framework TEXT NOT NULL,
    confidence TEXT NOT NULL DEFAULT 'heuristic'
);
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
CREATE INDEX IF NOT EXISTS idx_symbols_qname ON symbols(qualified_name);
CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_id);
CREATE INDEX IF NOT EXISTS idx_imports_file ON imports(file_id);
CREATE INDEX IF NOT EXISTS idx_imports_target ON imports(target_file_id);
CREATE INDEX IF NOT EXISTS idx_refs_file ON refs(file_id);
CREATE INDEX IF NOT EXISTS idx_refs_target_file ON refs(target_file_id);
CREATE INDEX IF NOT EXISTS idx_routes_file ON routes(file_id);
CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
"""


@dataclass
class FileRow:
    id: int
    path: str
    lang: str
    sha256: str
    size: int
    mtime: float
    parsed: int
    parse_error: str | None
    is_test: int
    indexed_at: str = ""


class Store:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        settings.state_dir.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(settings.db_path, timeout=30)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("PRAGMA foreign_keys=ON")
        self.conn.execute("PRAGMA synchronous=NORMAL")

    # -- lifecycle ----------------------------------------------------------

    def init_schema(self, reset: bool = False) -> None:
        if reset:
            self.conn.executescript(
                "DROP TABLE IF EXISTS refs; DROP TABLE IF EXISTS imports;"
                "DROP TABLE IF EXISTS symbols; DROP TABLE IF EXISTS files;"
                "DROP TABLE IF EXISTS meta;"
            )
        self.conn.executescript(SCHEMA)
        current = self.get_meta("schema_version")
        if current and current != SCHEMA_VERSION:
            raise RuntimeError(
                f"index schema {current} does not match {SCHEMA_VERSION}; run `repograph index --force`"
            )
        self.set_meta("schema_version", SCHEMA_VERSION)
        self.conn.commit()

    def close(self) -> None:
        self.conn.close()

    def __enter__(self) -> "Store":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    @contextmanager
    def tx(self) -> Iterator[None]:
        try:
            yield
            self.conn.commit()
        except Exception:
            self.conn.rollback()
            raise

    # -- meta ---------------------------------------------------------------

    def get_meta(self, key: str) -> str | None:
        row = self.conn.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
        return row["value"] if row else None

    def set_meta(self, key: str, value: str) -> None:
        self.conn.execute(
            "INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, value),
        )

    # -- files --------------------------------------------------------------

    def existing_files(self) -> dict[str, FileRow]:
        rows = self.conn.execute("SELECT * FROM files").fetchall()
        return {r["path"]: FileRow(**dict(r)) for r in rows}

    def file_id(self, path: str) -> int | None:
        row = self.conn.execute("SELECT id FROM files WHERE path=?", (path,)).fetchone()
        return row["id"] if row else None

    def file_path(self, file_id: int) -> str | None:
        row = self.conn.execute("SELECT path FROM files WHERE id=?", (file_id,)).fetchone()
        return row["path"] if row else None

    def upsert_file(self, path: str, lang: str, sha: str, size: int, mtime: float,
                    parse_error: str | None, is_test: bool, indexed_at: str) -> int:
        self.conn.execute(
            """INSERT INTO files(path,lang,sha256,size,mtime,parsed,parse_error,is_test,indexed_at)
               VALUES(?,?,?,?,?,?,?,?,?)
               ON CONFLICT(path) DO UPDATE SET lang=excluded.lang, sha256=excluded.sha256,
                 size=excluded.size, mtime=excluded.mtime, parsed=excluded.parsed,
                 parse_error=excluded.parse_error, is_test=excluded.is_test,
                 indexed_at=excluded.indexed_at""",
            (path, lang, sha, size, mtime, 0 if parse_error else 1, parse_error, int(is_test), indexed_at),
        )
        row = self.conn.execute("SELECT id FROM files WHERE path=?", (path,)).fetchone()
        return int(row["id"])

    def delete_file(self, path: str) -> None:
        self.conn.execute("DELETE FROM files WHERE path=?", (path,))

    def clear_children(self, file_id: int) -> None:
        for table in ("symbols", "imports", "refs", "routes"):
            self.conn.execute(f"DELETE FROM {table} WHERE file_id=?", (file_id,))

    def all_files(self) -> list[sqlite3.Row]:
        return self.conn.execute("SELECT * FROM files ORDER BY path").fetchall()

    def stats(self) -> dict[str, object]:
        one = lambda sql: self.conn.execute(sql).fetchone()[0]  # noqa: E731
        langs = {
            r["lang"]: r["n"]
            for r in self.conn.execute("SELECT lang, COUNT(*) AS n FROM files GROUP BY lang ORDER BY n DESC")
        }
        kinds = {
            r["kind"]: r["n"]
            for r in self.conn.execute("SELECT kind, COUNT(*) AS n FROM symbols GROUP BY kind ORDER BY n DESC")
        }
        return {
            "files": one("SELECT COUNT(*) FROM files"),
            "symbols": one("SELECT COUNT(*) FROM symbols"),
            "imports": one("SELECT COUNT(*) FROM imports"),
            "internal_imports": one("SELECT COUNT(*) FROM imports WHERE target_file_id IS NOT NULL"),
            "refs": one("SELECT COUNT(*) FROM refs"),
            "resolved_refs": one("SELECT COUNT(*) FROM refs WHERE target_file_id IS NOT NULL"),
            "tests": one("SELECT COUNT(*) FROM files WHERE is_test=1"),
            "parse_errors": one("SELECT COUNT(*) FROM files WHERE parsed=0"),
            "languages": langs,
            "symbol_kinds": kinds,
            "indexed_at": self.get_meta("indexed_at"),
            "root": self.get_meta("root"),
        }

    # -- symbols ------------------------------------------------------------

    def insert_symbol(self, file_id: int, s, is_exported: bool = True) -> int:
        cur = self.conn.execute(
            """INSERT INTO symbols(file_id,name,qualified_name,kind,start_line,end_line,
                                   start_col,end_col,tags,is_exported)
               VALUES(?,?,?,?,?,?,?,?,?,?)""",
            (file_id, s.name, s.qualified_name, s.kind, s.start_line, s.end_line,
             s.start_col, s.end_col, ",".join(s.tags), int(is_exported)),
        )
        return int(cur.lastrowid)

    def insert_import(self, file_id: int, imp, target_file_id: int | None, confidence: str,
                      method: str, kind: str, note: str = "") -> None:
        self.conn.execute(
            """INSERT INTO imports(file_id,raw,module,line,target_file_id,confidence,method,kind,names,note)
               VALUES(?,?,?,?,?,?,?,?,?,?)""",
            (file_id, imp.raw, imp.module, imp.line, target_file_id, confidence, method, kind,
             json.dumps(imp.names), note),
        )

    def insert_ref(self, file_id: int, ref, confidence: str, method: str,
                   target_file_id: int | None, target_name: str | None) -> None:
        self.conn.execute(
            """INSERT INTO refs(file_id,name,line,col,kind,confidence,method,target_file_id,target_name)
               VALUES(?,?,?,?,?,?,?,?,?)""",
            (file_id, ref.name, ref.line, ref.col, ref.kind, confidence, method,
             target_file_id, target_name),
        )

    def insert_route(self, file_id: int, route, confidence: str = "heuristic") -> None:
        self.conn.execute(
            """INSERT INTO routes(file_id,method,path,handler,line,framework,confidence)
               VALUES(?,?,?,?,?,?,?)""",
            (file_id, route.method, route.path, route.handler, route.line, route.framework, confidence),
        )

    # -- read helpers -------------------------------------------------------

    def file_edges(self) -> list[dict[str, object]]:
        rows = self.conn.execute(
            """SELECT s.path AS src, t.path AS dst, i.confidence, i.method, i.line, i.module
               FROM imports i
               JOIN files s ON s.id=i.file_id
               JOIN files t ON t.id=i.target_file_id
               WHERE i.target_file_id IS NOT NULL AND s.path != t.path"""
        ).fetchall()
        return [dict(r) for r in rows]

    def symbols_by_name(self, name: str, limit: int = 50) -> list[dict[str, object]]:
        rows = self.conn.execute(
            """SELECT s.*, f.path FROM symbols s JOIN files f ON f.id=s.file_id
               WHERE s.name=? ORDER BY f.path, s.start_line LIMIT ?""",
            (name, limit),
        ).fetchall()
        return [dict(r) for r in rows]

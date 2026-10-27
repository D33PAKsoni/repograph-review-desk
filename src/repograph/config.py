"""Project configuration.

Config is intentionally a small JSON file (no extra dependency, no code
execution). Anything not set here falls back to conservative defaults.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

INDEX_DIR = ".repograph"
DB_NAME = "index.db"
CONFIG_NAME = "config.json"

DEFAULT_EXCLUDES = [
    ".git",
    ".hg",
    ".svn",
    ".repograph",
    ".venv",
    "venv",
    "env",
    "node_modules",
    "__pycache__",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".tox",
    ".nox",
    "dist",
    "build",
    "target",
    "vendor",
    ".next",
    ".nuxt",
    ".turbo",
    ".cache",
    "coverage",
    "htmlcov",
    "site-packages",
    "*.min.js",
    "*.min.css",
    "*.map",
    "*.lock",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "poetry.lock",
    "uv.lock",
    ".env",
    ".env.*",
    "*.pem",
    "*.key",
]

# Files that are likely to contain credentials are never indexed or searched.
SECRET_GLOBS = [".env", ".env.*", "*.pem", "*.key", "*.p12", "id_rsa", "id_ed25519", ".npmrc", ".pypirc"]


@dataclass
class Settings:
    root: Path
    exclude: list[str] = field(default_factory=lambda: list(DEFAULT_EXCLUDES))
    max_file_bytes: int = 1_500_000
    max_files: int = 200_000
    follow_symlinks: bool = False
    index_dir: Path | None = None

    @property
    def db_path(self) -> Path:
        return (self.index_dir or (self.root / INDEX_DIR)) / DB_NAME

    @property
    def state_dir(self) -> Path:
        return self.index_dir or (self.root / INDEX_DIR)

    def is_excluded(self, rel: str) -> bool:
        from fnmatch import fnmatchcase

        parts = rel.split("/")
        for pat in self.exclude + SECRET_GLOBS:
            if fnmatchcase(rel, pat) or any(fnmatchcase(p, pat) for p in parts):
                return True
        return False


def load_settings(root: str | Path) -> Settings:
    root = Path(root).expanduser().resolve()
    s = Settings(root=root)
    cfg = root / INDEX_DIR / CONFIG_NAME
    if cfg.is_file():
        try:
            data = json.loads(cfg.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            data = {}
        if isinstance(data.get("exclude"), list):
            # User excludes extend, never replace, the safety defaults.
            s.exclude = list(dict.fromkeys(DEFAULT_EXCLUDES + [str(x) for x in data["exclude"]]))
        for key in ("max_file_bytes", "max_files"):
            if isinstance(data.get(key), int) and data[key] > 0:
                setattr(s, key, data[key])
        s.follow_symlinks = bool(data.get("follow_symlinks", False))
    return s


def init_project(root: str | Path) -> Settings:
    root = Path(root).expanduser().resolve()
    s = load_settings(root)
    s.state_dir.mkdir(parents=True, exist_ok=True)
    cfg = s.state_dir / CONFIG_NAME
    if not cfg.exists():
        cfg.write_text(
            json.dumps(
                {
                    "exclude": [],
                    "max_file_bytes": s.max_file_bytes,
                    "max_files": s.max_files,
                    "follow_symlinks": False,
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
    return s


def safe_path(root: Path, user_path: str | Path, *, must_exist: bool = True) -> Path:
    """Resolve a user-supplied path, refusing anything outside the repository.

    Guards against ``..`` traversal, absolute paths elsewhere, and symlinks
    that point outside the index root.
    """
    root = root.resolve()
    p = Path(user_path).expanduser()
    candidate = p if p.is_absolute() else root / p
    if must_exist and not candidate.exists():
        raise FileNotFoundError(f"path not found: {user_path}")
    resolved = candidate.resolve()
    try:
        resolved.relative_to(root)
    except ValueError as exc:
        raise PermissionError(f"path escapes repository root: {user_path}") from exc
    return resolved

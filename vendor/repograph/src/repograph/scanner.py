"""Repository file discovery with exclusions and resource limits."""

from __future__ import annotations

import os
import stat
from dataclasses import dataclass
from pathlib import Path

from .config import Settings

LANGUAGES = {
    ".py": "python",
    ".pyi": "python",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".mts": "typescript",
    ".cts": "typescript",
    ".js": "javascript",
    ".jsx": "jsx",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".prisma": "prisma",
}

SUPPORTED_LANGUAGES = ("python", "typescript", "tsx", "javascript", "jsx", "prisma")


@dataclass(frozen=True)
class FileEntry:
    path: str  # repo-relative POSIX path
    lang: str
    size: int
    mtime: float


@dataclass
class ScanResult:
    files: list[FileEntry]
    skipped_large: int = 0
    skipped_symlink: int = 0
    truncated: bool = False


def detect_language(path: str) -> str | None:
    return LANGUAGES.get(Path(path).suffix.lower())


def scan(root: Path, settings: Settings) -> ScanResult:
    root = root.resolve()
    out: list[FileEntry] = []
    skipped_large = skipped_symlink = 0

    for dirpath, dirnames, filenames in os.walk(root, followlinks=False):
        dirnames[:] = sorted(
            d
            for d in dirnames
            if not settings.is_excluded(f"{Path(dirpath, d).relative_to(root).as_posix()}")
            and not (Path(dirpath, d) / ".repograph").exists()
        )
        for name in sorted(filenames):
            if len(out) >= settings.max_files:
                return ScanResult(out, skipped_large, skipped_symlink, truncated=True)
            full = Path(dirpath, name)
            rel = full.relative_to(root).as_posix()
            if settings.is_excluded(rel):
                continue
            lang = detect_language(rel)
            if lang is None:
                continue
            try:
                st = full.lstat()
            except OSError:
                continue
            if stat.S_ISLNK(st.st_mode):
                # Symlinked files are skipped by default: they can read data
                # outside the repository and double-count sources.
                if not settings.follow_symlinks:
                    skipped_symlink += 1
                    continue
                try:
                    resolved = full.resolve(strict=True)
                    resolved.relative_to(root)
                    st = resolved.stat()
                except (OSError, ValueError):
                    skipped_symlink += 1
                    continue
            if not stat.S_ISREG(st.st_mode):
                continue
            if st.st_size > settings.max_file_bytes:
                skipped_large += 1
                continue
            out.append(FileEntry(rel, lang, st.st_size, st.st_mtime))
    return ScanResult(out, skipped_large, skipped_symlink)


def read_source(root: Path, rel: str, settings: Settings) -> bytes | None:
    """Read a source file without following links outside the root."""
    full = (root / rel)
    try:
        resolved = full.resolve(strict=True)
        resolved.relative_to(root.resolve())
        if not resolved.is_file() or resolved.stat().st_size > settings.max_file_bytes:
            return None
        return resolved.read_bytes()
    except (OSError, ValueError):
        return None

from __future__ import annotations

import shutil
from pathlib import Path

import pytest

from repograph.config import load_settings
from repograph.indexer import index_repository
from repograph.store import Store

FIXTURE = Path(__file__).parent / "fixtures" / "shop"


@pytest.fixture()
def repo(tmp_path: Path) -> Path:
    dst = tmp_path / "shop"
    shutil.copytree(FIXTURE, dst)
    return dst


@pytest.fixture()
def indexed(repo: Path) -> Path:
    index_repository(repo)
    return repo


@pytest.fixture()
def store(indexed: Path):
    s = Store(load_settings(indexed))
    yield s
    s.close()


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")

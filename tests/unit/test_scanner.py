from __future__ import annotations

import os
from pathlib import Path

import pytest

from repograph.config import Settings, init_project, load_settings, safe_path
from repograph.scanner import read_source, scan


def test_exclusions_secrets_and_size_limits(tmp_path: Path):
    (tmp_path / "pkg").mkdir()
    (tmp_path / "node_modules").mkdir()
    (tmp_path / ".git").mkdir()
    (tmp_path / "pkg/a.py").write_text("x = 1\n")
    (tmp_path / "node_modules/x.js").write_text("x")
    (tmp_path / ".git/config.py").write_text("x")
    (tmp_path / ".env").write_text("SECRET=1")
    (tmp_path / "big.py").write_text("x" * 100)
    settings = Settings(root=tmp_path, max_file_bytes=50)
    result = scan(tmp_path, settings)
    assert [e.path for e in result.files] == ["pkg/a.py"]
    assert result.skipped_large == 1


def test_symlink_outside_root_is_skipped_not_read(tmp_path: Path):
    root = tmp_path / "repo"
    root.mkdir()
    outside = tmp_path / "secret.py"
    outside.write_text("TOKEN = 'leak'\n")
    os.symlink(outside, root / "linked.py")
    settings = Settings(root=root)
    result = scan(root, settings)
    assert result.files == []
    assert result.skipped_symlink == 1
    assert read_source(root, "linked.py", settings) is None


def test_safe_path_rejects_traversal_and_outside_symlink(tmp_path: Path):
    root = tmp_path / "repo"
    root.mkdir()
    (root / "ok.py").write_text("")
    outside = tmp_path / "outside.py"
    outside.write_text("")
    os.symlink(outside, root / "escape.py")
    assert safe_path(root, "ok.py") == (root / "ok.py").resolve()
    with pytest.raises(PermissionError):
        safe_path(root, "../outside.py")
    with pytest.raises(PermissionError):
        safe_path(root, "escape.py")


def test_config_defaults_cannot_be_replaced_by_user_config(tmp_path: Path):
    settings = init_project(tmp_path)
    cfg = settings.state_dir / "config.json"
    assert cfg.exists()
    cfg.write_text('{"exclude": ["custom"], "max_files": 5}')
    loaded = load_settings(tmp_path)
    assert "custom" in loaded.exclude
    assert "node_modules" in loaded.exclude  # safety defaults are merged in
    assert loaded.max_files == 5


def test_directory_named_env_is_not_excluded(tmp_path: Path):
    """`lib/env/` is source, not a virtualenv (measured Axios defect)."""
    (tmp_path / "lib/env").mkdir(parents=True)
    (tmp_path / "lib/env/data.js").write_text("export const VERSION = '1'\n")
    (tmp_path / "venv").mkdir()
    (tmp_path / "venv/x.py").write_text("x = 1\n")
    result = scan(tmp_path, Settings(root=tmp_path))
    paths = [e.path for e in result.files]
    assert "lib/env/data.js" in paths
    assert "venv/x.py" not in paths

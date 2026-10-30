from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from repograph.config import load_settings
from repograph.indexer import index_repository
from repograph.store import Store
from repograph.test_gate import select


def _git(root: Path, *args: str) -> None:
    subprocess.run(["git", "-C", str(root), *args], check=True, capture_output=True)


def _select(repo: Path, **kwargs) -> dict:
    with Store(load_settings(repo)) as store:
        return select(store, repo, **kwargs)


def test_change_selects_the_test_that_imports_it(indexed: Path):
    data = _select(indexed, paths=["src/shop/services/subscription.py"])

    run = [t["path"] for t in data["run"]]
    assert "tests/test_subscription.py" in run
    assert "tests/test_models.py" not in run
    assert data["selection"]["total_tests"] == 2
    assert data["command"].endswith("tests/test_subscription.py")


def test_files_that_cannot_be_checked_are_reported_not_ignored(indexed: Path):
    blind = indexed / "tests" / "test_dynamic.py"
    blind.write_text("from shop.services.nowhere import thing\n\n\ndef test_x():\n    assert thing\n")
    index_repository(indexed)

    data = _select(indexed, paths=["src/shop/models.py"])

    reasons = {u["path"]: u["reason"] for u in data["undetermined"]}
    assert reasons.get("tests/test_dynamic.py") == "unresolved-import"
    assert "tests/test_dynamic.py" not in {t["path"] for t in data["run"]}


def test_conftest_marks_the_suite_undetermined(indexed: Path):
    conftest = indexed / "tests" / "conftest.py"
    conftest.write_text("import pytest\n")
    index_repository(indexed)

    data = _select(indexed, paths=["tests/conftest.py"])

    assert {u["reason"] for u in data["undetermined"]} == {"conftest-change"}
    assert data["exit_code"] == 0  # strict is opt-in

    strict = _select(indexed, paths=["tests/conftest.py"], strict=True)
    assert strict["exit_code"] == 3


def test_strict_fails_when_nothing_is_selected(indexed: Path):
    data = _select(indexed, paths=["docs/adr/0001-subscription-cancellation.md"], strict=True)

    assert data["run"] == []
    assert data["exit_code"] == 3
    assert "pytest" in data["command"]


def test_git_diff_and_unindexed_change(indexed: Path):
    _git(indexed, "init")
    _git(indexed, "config", "user.email", "test@example.com")
    _git(indexed, "config", "user.name", "Test")
    _git(indexed, "add", "-A")
    _git(indexed, "commit", "-m", "initial")

    (indexed / "src" / "shop" / "services" / "subscription.py").write_text(
        (indexed / "src/shop/services/subscription.py").read_text() + "\n\ndef extra():\n    return 1\n"
    )
    (indexed / "src" / "shop" / "brand_new.py").write_text("def fresh():\n    return 1\n")
    index_repository(indexed)

    data = _select(indexed, diff=True, strict=True)

    assert data["source"] == "git-diff"
    assert "src/shop/services/subscription.py" in data["changed_files"]
    assert "tests/test_subscription.py" in {t["path"] for t in data["run"]}
    assert data["unindexed_changed_files"] == []
    assert data["exit_code"] == 0


def test_reachable_tests_are_disclosed_not_silently_dropped(indexed: Path):
    # tests/test_deep.py -> shop/api/routes.py -> shop/services/subscription.py
    deep = indexed / "tests" / "test_deep.py"
    deep.write_text("from shop.api.routes import refund\n\n"
                    "def test_refund() -> None:\n    assert refund()\n", encoding="utf-8")
    index_repository(indexed)

    data = _select(indexed, paths=["src/shop/services/subscription.py"])

    assert "tests/test_deep.py" not in {t["path"] for t in data["run"]}
    assert "tests/test_deep.py" in data["reachable_not_selected"]


def test_cli_json_and_strict_exit(indexed: Path):
    out = subprocess.run(
        [sys.executable, "-m", "repograph", "tests",
         "src/shop/services/subscription.py", "--root", str(indexed), "--json"],
        capture_output=True, text=True, timeout=120,
    )
    assert out.returncode == 0, out.stderr
    data = json.loads(out.stdout)
    assert data["selection"]["run"] >= 1
    assert data["argv"][1:3] == ["-m", "pytest"]

    out = subprocess.run(
        [sys.executable, "-m", "repograph", "tests",
         "docs/adr/0001-subscription-cancellation.md", "--root", str(indexed), "--strict"],
        capture_output=True, text=True, timeout=120,
    )
    assert out.returncode == 3
    assert "cannot rule out" in out.stdout

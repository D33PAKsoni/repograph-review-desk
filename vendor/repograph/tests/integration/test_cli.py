from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path


def run_cli(repo: Path, *args: str) -> subprocess.CompletedProcess:
    env = dict(os.environ)
    env.pop("REPOGRAPH_ROOT", None)
    return subprocess.run(
        [sys.executable, "-m", "repograph", *args],
        cwd=repo, capture_output=True, text=True, timeout=120, env=env,
    )


def test_version_and_init(repo: Path):
    from repograph import __version__

    out = run_cli(repo, "version")
    assert out.returncode == 0
    assert out.stdout.strip() == __version__
    assert re.fullmatch(r"\d+\.\d+\.\d+", __version__)

    out = run_cli(repo, "init", str(repo))
    assert out.returncode == 0
    assert (repo / ".repograph" / "config.json").exists()


def test_index_status_search_json(repo: Path):
    out = run_cli(repo, "index", str(repo), "--json")
    assert out.returncode == 0, out.stderr
    stats = json.loads(out.stdout)
    assert stats["files_scanned"] == 20
    assert stats["added"] == 20
    assert stats["parse_errors"] == 1

    out = run_cli(repo, "status", str(repo), "--json")
    assert out.returncode == 0, out.stderr
    status = json.loads(out.stdout)
    assert status["files"] == 20
    assert status["symbols"] > 0

    out = run_cli(repo, "search", "cancel", "--root", str(repo), "--json")
    assert out.returncode == 0, out.stderr
    data = json.loads(out.stdout)
    names = {s["name"] for s in data["symbols"]}
    assert "cancel" in names
    assert data["text"]


def test_impact_refs_graph_arch_json(repo: Path):
    assert run_cli(repo, "index", str(repo)).returncode == 0

    out = run_cli(repo, "impact", "src/shop/services/subscription.py",
                  "--root", str(repo), "--json")
    assert out.returncode == 0, out.stderr
    impact = json.loads(out.stdout)
    assert impact["summary"]["changed_files"] == 1
    assert impact["direct_dependents"]

    out = run_cli(repo, "refs", "cancel", "--root", str(repo), "--json")
    assert out.returncode == 0, out.stderr
    refs = json.loads(out.stdout)
    assert refs["definitions"]

    out = run_cli(repo, "graph", "--cycles", "--root", str(repo), "--json")
    assert out.returncode == 0, out.stderr
    cycles = json.loads(out.stdout)["cycles"]
    assert any(any("billing.py" in p for p in c) and any("subscription.py" in p for p in c)
               for c in cycles)

    out = run_cli(repo, "arch", "--root", str(repo), "--json")
    assert out.returncode == 0, out.stderr
    arch = json.loads(out.stdout)
    assert arch["files"] == 20
    assert arch["database_models"]
    # Architecture counts must disclose what the edge count omits.
    assert arch["dynamic_imports"] == 2
    assert arch["unresolved_imports"] == 0
    assert any("not a census" in line for line in arch["limitations"])


def test_missing_index_fails_cleanly(repo: Path):
    out = run_cli(repo, "status", str(repo))
    assert out.returncode == 1
    assert "no index found" in out.stderr
    assert "run: repograph index" in out.stderr


def test_impact_ambiguous_symbol_exits_2(repo: Path):
    extra = repo / "src" / "shop" / "extra.py"
    extra.write_text("class Subscription:\n    pass\n", encoding="utf-8")
    assert run_cli(repo, "index", str(repo)).returncode == 0
    out = run_cli(repo, "impact", "--symbol", "Subscription", "--root", str(repo), "--json")
    assert out.returncode == 2
    assert "ambiguous" in json.loads(out.stdout)["error"]


def test_setup_records_a_working_command(repo: Path, tmp_path: Path):
    out = run_cli(repo, "setup", str(repo), "--yes")
    assert out.returncode == 0, out.stderr

    entry = json.loads((repo / ".mcp.json").read_text())["mcpServers"]["repograph"]
    assert "serve" in entry["args"]
    assert str(repo.resolve()) in entry["args"]
    assert (repo / ".claude" / "skills" / "repograph" / "SKILL.md").is_file()

    # The recorded launch must work from any working directory.
    check = subprocess.run(
        [entry["command"], *entry["args"], "--help"],
        cwd=tmp_path, capture_output=True, text=True, timeout=60,
    )
    assert check.returncode == 0, check.stderr

    again = run_cli(repo, "setup", str(repo), "--yes")
    assert "already configured" in again.stdout

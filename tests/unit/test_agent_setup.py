from __future__ import annotations

import json
from pathlib import Path

import pytest

from repograph.agent_setup import apply, plan


def test_writes_config_and_skill(tmp_path: Path) -> None:
    changes = plan(tmp_path, ["claude"], home=tmp_path / "home")
    written = apply(changes)

    config = json.loads((tmp_path / ".mcp.json").read_text())
    entry = config["mcpServers"]["repograph"]
    assert entry["args"][-2:] == ["--root", str(tmp_path.resolve())]
    assert entry["command"]
    skill = (tmp_path / ".claude" / "skills" / "repograph" / "SKILL.md").read_text()
    assert skill.startswith("---\nname: repograph\n")
    assert "blind_spots" in skill
    assert len(written) == 2


def test_merges_and_preserves_other_servers(tmp_path: Path) -> None:
    (tmp_path / ".mcp.json").write_text(
        json.dumps({"mcpServers": {"other": {"command": "x"}}, "keep": True})
    )
    apply(plan(tmp_path, ["claude"], include_skill=False, home=tmp_path / "home"))

    config = json.loads((tmp_path / ".mcp.json").read_text())
    assert config["keep"] is True
    assert config["mcpServers"]["other"] == {"command": "x"}
    assert "repograph" in config["mcpServers"]


def test_second_run_is_idempotent(tmp_path: Path) -> None:
    apply(plan(tmp_path, ["claude"], home=tmp_path / "home"))
    again = plan(tmp_path, ["claude"], home=tmp_path / "home")
    assert all(change.kind == "unchanged" for change in again)
    assert apply(again) == []


def test_backup_keeps_the_original(tmp_path: Path) -> None:
    path = tmp_path / ".mcp.json"
    original = json.dumps({"mcpServers": {}})
    path.write_text(original)

    apply(plan(tmp_path, ["claude"], include_skill=False, home=tmp_path / "home"))
    apply(plan(tmp_path, ["claude"], include_skill=False, home=tmp_path / "home"))

    assert path.with_name(".mcp.json.bak").read_text() == original


def test_codex_block_is_replaced_not_duplicated(tmp_path: Path) -> None:
    home = tmp_path / "home"
    (home / ".codex").mkdir(parents=True)
    (home / ".codex" / "config.toml").write_text('model = "x"\n')

    apply(plan(tmp_path, ["codex"], home=home))
    apply(plan(tmp_path, ["codex"], home=home))

    text = (home / ".codex" / "config.toml").read_text()
    assert text.count("[mcp_servers.repograph]") == 1
    assert text.startswith('model = "x"')


def test_rejects_broken_json(tmp_path: Path) -> None:
    (tmp_path / ".mcp.json").write_text("{not json")
    with pytest.raises(ValueError, match="not valid JSON"):
        plan(tmp_path, ["claude"], home=tmp_path / "home")


def test_opencode_writes_mcp_config_and_agents_instructions(tmp_path: Path) -> None:
    apply(plan(tmp_path, ["opencode"], home=tmp_path / "home"))

    config = json.loads((tmp_path / "opencode.json").read_text())
    entry = config["mcp"]["servers"]["repograph"]
    assert entry["args"][-2:] == ["--root", str(tmp_path.resolve())]

    agents = (tmp_path / "AGENTS.md").read_text()
    assert agents.startswith("<!-- repograph:start")
    assert "analyze_change_impact" in agents and "blind_spots" in agents


def test_opencode_keeps_existing_agents_file_and_reruns_clean(tmp_path: Path) -> None:
    (tmp_path / "AGENTS.md").write_text("# House rules\n\nUse tabs.\n")

    first = plan(tmp_path, ["opencode"], home=tmp_path / "home")
    assert all(c.kind != "unchanged" for c in first)
    apply(first)

    text = (tmp_path / "AGENTS.md").read_text()
    assert text.startswith("# House rules\n\nUse tabs.\n")
    assert text.count("<!-- repograph:start") == 1

    again = plan(tmp_path, ["opencode"], home=tmp_path / "home")
    assert all(c.kind == "unchanged" for c in again)


def test_detects_opencode_from_global_config(tmp_path: Path) -> None:
    from repograph.agent_setup import detect_clients

    home = tmp_path / "home"
    assert "opencode" not in detect_clients(tmp_path, home)
    (home / ".config" / "opencode").mkdir(parents=True)
    (home / ".config" / "opencode" / "opencode.json").write_text("{}")
    assert "opencode" in detect_clients(tmp_path, home)

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

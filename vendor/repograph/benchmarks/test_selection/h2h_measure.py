"""Head-to-head: graphify `affected` vs repograph `impact` on the gate corpus.

Ground truth: benchmarks/test_selection/gate-{repo}.json (22 measured mutations,
180 failing test files) at the commits recorded in TEST_SELECTION_GATE_RESULTS.md.
Both tools answer on the pristine tree, seeded with the mutated function name.

Arms (pre-registered):
  G2  graphify affected NAME              (their default depth 2)
  G5  graphify affected NAME --depth 5    (their maximum useful depth)
  R2  repograph impact --symbol NAME --depth 2 --json
  R5  repograph impact --symbol NAME --depth 5 --json

A failing test file counts as caught if its path appears anywhere in the tool's
output for that mutation. Cost is the number of distinct files the tool names.
"""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

ROOT = Path("/tmp/opencode/h2h")
GRAPHIFY = "/tmp/opencode/h2h/gvenv/bin/graphify"
REPOGRAPH = "/home/darion-dev/.local/share/mise/installs/python/latest/bin/repograph"
GATE = Path("/home/darion-dev/repograph/benchmarks/test_selection")

PATH_RE = re.compile(r"([\w./@+-]+\.(?:py|pyi|js|jsx|ts|tsx|prisma))(?::L?\d+)?\s*$")


def graphify_files(repo: str, name: str, depth: int) -> tuple[list[str], str]:
    cmd = [GRAPHIFY, "affected", name] + ([] if depth == 2 else ["--depth", str(depth)])
    out = subprocess.run(cmd, cwd=ROOT / repo, capture_output=True, text=True, timeout=180)
    text = out.stdout.strip()
    files = []
    for line in text.splitlines():
        if not line.startswith("- "):
            continue
        match = PATH_RE.search(line)
        if match:
            files.append(match.group(1))
    return sorted(set(files)), text or out.stderr.strip()


def repograph_files(repo: str, name: str, depth: int, symbol: bool = True) -> tuple[list[str], str, dict]:
    cmd = [REPOGRAPH, "impact", "--symbol", name, "--depth", str(depth), "--json"]
    if not symbol:
        cmd = [REPOGRAPH, "impact", name, "--depth", str(depth), "--json"]
    out = subprocess.run(cmd, cwd=ROOT / repo, capture_output=True, text=True, timeout=180)
    try:
        data = json.loads(out.stdout)
    except json.JSONDecodeError:
        return [], out.stdout.strip() + out.stderr.strip(), {}
    files = set()
    for key in ("direct_dependents", "transitive_dependents", "related_tests"):
        for item in data.get(key) or []:
            if isinstance(item, dict):
                path = item.get("path") or item.get("file")
                if path:
                    files.add(path)
            elif isinstance(item, str):
                files.add(item)
    for item in data.get("changed_files") or []:
        if isinstance(item, str):
            files.add(item)
    return sorted(files), out.stdout, data


def main() -> None:
    results = []
    for gate_path in sorted(GATE.glob("gate-*.json")):
        gate = json.loads(gate_path.read_text())
        repo = gate["repo"]
        test_files = set(
            subprocess.run(
                ["git", "ls-files", "tests/*.py", "tests/**/*.py"],
                cwd=ROOT / repo, capture_output=True, text=True,
            ).stdout.split()
        )
        for mutation in gate["mutations"]:
            if mutation.get("status") != "measured":
                continue
            name = mutation["name"]
            failing = sorted(mutation["failed_files"])
            row = {"repo": repo, "name": name, "file": mutation["file"],
                   "failing": failing, "test_files": len(test_files)}
            for arm, depth in (("G2", 2), ("G5", 5)):
                files, raw = graphify_files(repo, name, depth)
                row[arm] = {"files": files, "caught": sorted(set(failing) & set(files)),
                            "raw": raw}
            for arm, depth in (("R2", 2), ("R5", 5)):
                files, raw, data = repograph_files(repo, name, depth)
                row[arm] = {"files": files, "caught": sorted(set(failing) & set(files)),
                            "raw": raw,
                            "blind_spots": len(data.get("blind_spots") or []),
                            "error": data.get("error") if isinstance(data, dict) else None}
            # F: file seed, depth 5, both tools. Mechanical resolution fallback for
            # bare names that are ambiguous (a user would do exactly this).
            gf, graw = graphify_files(repo, mutation["file"], 5)
            row["GF"] = {"files": gf, "caught": sorted(set(failing) & set(gf)), "raw": graw}
            rf, rraw, rdata = repograph_files(repo, mutation["file"], 5, symbol=False)
            row["RF"] = {"files": rf, "caught": sorted(set(failing) & set(rf)), "raw": rraw,
                         "blind_spots": len(rdata.get("blind_spots") or []),
                         "error": rdata.get("error") if isinstance(rdata, dict) else None}
            results.append(row)
            print(repo, name, {a: len(row[a]["caught"]) for a in ("G2", "G5", "R2", "R5")},
                  "/", len(failing), flush=True)

    out = Path("/home/darion-dev/repograph/research/evidence/h2h-affected.json")
    out.write_text(json.dumps(results, indent=1))
    print("wrote", out)


if __name__ == "__main__":
    main()

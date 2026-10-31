"""Measure test selection against real pytest outcomes.

This is the oracle the rest of the project lacks. For each mutation:

1. record the failing test files from a real pytest run (junitxml),
2. ask `repograph tests` which test files it would run for the changed file,
3. score the selection against the failures.

Predictions are computed on the pristine index, before the mutation is applied,
exactly as a developer would ask them on a clean tree with a diff.

A mutation whose suite does not run (collection/import error) is reported and
kept out of the recall denominator. A mutation with no failing test is
unobserved: the suite never exercises it, so it says nothing about selection.

Usage:
    python benchmarks/test_selection/gate_measure.py \
        --repo /tmp/opencode/sel/click --src click --max 10 \
        --python /tmp/opencode/sel/click/.venv/bin/python \
        --out benchmarks/test_selection/gate-click.json
"""

from __future__ import annotations

import argparse
import ast
import json
import subprocess
import sys
import tempfile
import time
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from repograph.config import load_settings  # noqa: E402
from repograph.impact import analyze_impact  # noqa: E402
from repograph.indexer import index_repository  # noqa: E402
from repograph.store import Store  # noqa: E402
from repograph.test_gate import select  # noqa: E402

SKIP_PREFIX = ("_", "test_", "visit_")


def candidate_functions(repo: Path, src: Path) -> list[tuple[str, int, int, str]]:
    """Top-level functions with a body worth mutating, in stable order."""
    out: list[tuple[str, int, int, str]] = []
    for path in sorted(src.rglob("*.py")):
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"))
        except (SyntaxError, UnicodeDecodeError):
            continue
        rel = path.relative_to(repo).as_posix()
        for node in tree.body:
            if not isinstance(node, ast.FunctionDef):
                continue
            if node.name.startswith(SKIP_PREFIX) or node.name.startswith("__"):
                continue
            if len(node.body) < 2:
                continue
            out.append((rel, node.body[0].lineno, node.body[-1].end_lineno or 0, node.name))
    return out


def pick(functions: list[tuple[str, int, int, str]], count: int) -> list[tuple[str, int, int, str]]:
    if len(functions) <= count:
        return functions
    step = len(functions) / count
    return [functions[int(i * step)] for i in range(count)]


def mutate(path: Path, start: int, end: int) -> str:
    """Replace a function body with a raise; return the original text."""
    original = path.read_text(encoding="utf-8")
    lines = original.splitlines(keepends=True)
    indent = lines[start - 1][: len(lines[start - 1]) - len(lines[start - 1].lstrip())]
    replacement = f'{indent}raise RuntimeError("repograph mutation")\n'
    mutated = "".join(lines[: start - 1]) + replacement + "".join(lines[end:])
    path.write_text(mutated, encoding="utf-8")
    return original


def _node_file(case, repo: Path) -> str:
    """junitxml leaves `file` empty on some pytest versions; derive it from classname."""
    direct = case.get("file") or ""
    if direct:
        return direct
    parts = (case.get("classname") or "").split(".")
    for i in range(len(parts), 0, -1):
        candidate = "/".join(parts[:i]) + ".py"
        if (repo / candidate).is_file():
            return candidate
    return ""


def run_suite(python: str, repo: Path, timeout: int = 900) -> dict:
    with tempfile.TemporaryDirectory() as tmp:
        report = Path(tmp) / "junit.xml"
        started = time.monotonic()
        proc = subprocess.run(
            [python, "-m", "pytest", "-q", "--tb=no", "-p", "no:cacheprovider",
             f"--junitxml={report}"],
            cwd=repo, capture_output=True, text=True, timeout=timeout,
        )
        duration = time.monotonic() - started
        failed: dict[str, int] = {}
        unmapped: list[str] = []
        total = 0
        if report.is_file():
            for case in ET.parse(report).getroot().iter("testcase"):
                total += 1
                if case.find("failure") is None and case.find("error") is None:
                    continue
                name = _node_file(case, repo)
                if not name:
                    unmapped.append(case.get("classname") or "?")
                    continue
                failed[name] = failed.get(name, 0) + 1
        return {
            "returncode": proc.returncode,
            "duration_s": round(duration, 1),
            "total": total,
            "failed_files": dict(sorted(failed.items())),
            "unmapped": sorted(set(unmapped)),
            "tail": (proc.stdout or "")[-400:],
        }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True)
    ap.add_argument("--src", required=True, help="Package directory, relative to the repo.")
    ap.add_argument("--python", required=True, help="Interpreter that can run the repo's suite.")
    ap.add_argument("--max", type=int, default=10)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    repo = Path(args.repo).resolve()
    src = repo / args.src
    out: dict = {"repo": repo.name, "src": args.src, "python": args.python}

    dirty = subprocess.run(
        ["git", "status", "--porcelain", "--untracked-files=no"],
        cwd=repo, capture_output=True, text=True,
    ).stdout.strip()
    if dirty:
        # A killed earlier run can leave a mutated file behind; measuring on top
        # of it would attribute that failure to the wrong mutation.
        raise SystemExit(f"refusing to measure a dirty tree:\n{dirty}")

    started = time.monotonic()
    index_repository(repo)
    out["index_s"] = round(time.monotonic() - started, 2)

    baseline = run_suite(args.python, repo)
    out["baseline"] = {k: baseline[k] for k in ("returncode", "duration_s", "total")}
    if baseline["returncode"] != 0:
        out["error"] = "baseline suite is not green"
        Path(args.out).write_text(json.dumps(out, indent=1))
        print(json.dumps(out, indent=1))
        raise SystemExit(1)
    out["baseline"]["failed_files"] = baseline["failed_files"]
    # A file that already fails on the pristine tree cannot be attributed to a
    # mutation; it is removed from every mutation's denominator.
    baseline_failed = set(baseline["failed_files"])

    rows = []
    picked = pick(candidate_functions(repo, src), args.max)
    store = Store(load_settings(repo))
    try:
        for rel, start, end, name in picked:
            path = repo / rel
            row = {"name": name, "file": rel, "lines": [start, end]}
            original = mutate(path, start, end)
            try:
                suite = run_suite(args.python, repo)
            finally:
                path.write_text(original, encoding="utf-8")

            row["pytest_rc"] = suite["returncode"]
            row["failed_files"] = suite["failed_files"]
            row["unmapped"] = suite["unmapped"]
            row["suite_s"] = suite["duration_s"]
            if suite["returncode"] in (2, 3, 4):
                row["status"] = "unusable-suite"
                rows.append(row)
                continue
            failed = set(suite["failed_files"]) - baseline_failed
            if not failed:
                row["status"] = "unobserved"
                rows.append(row)
                continue

            data = select(store, repo, paths=[rel])
            undetermined = {u["path"] for u in data["undetermined"]}
            run_direct = {t["path"] for t in data["run"]}
            # Arm B is what a cautious reader would run: the selection plus every
            # test the tool discloses as reachable but unselected. It is the
            # ceiling of the disclosure, not a change to the product.
            impact = analyze_impact(store, repo, paths=[rel], depth=2)
            def _paths(items) -> set[str]:
                # Blind-spot items are strings in the reachability group and
                # dicts elsewhere; only the reachability group is unioned here,
                # but normalising both keeps the arm definition honest.
                return {
                    it if isinstance(it, str) else (it.get("file") or it.get("path"))
                    for it in (items or [])
                } - {None}

            blind = {b["kind"]: _paths(b.get("items")) for b in impact.get("blind_spots", [])}
            run_closure = run_direct | blind.get("test-selection-reachability", set())
            row.update({
                "status": "measured",
                "undetermined_disclosed": len(failed & undetermined),
            })
            for arm, run in (("direct", run_direct), ("closure", run_closure)):
                hit = failed & run
                row[arm] = {
                    "selected": len(run),
                    "hit": len(hit),
                    "recall": round(len(hit) / len(failed), 4),
                    "precision": round(len(hit) / len(run), 4) if run else 0.0,
                    "fraction": round(len(run) / data["selection"]["total_tests"], 4)
                    if data["selection"]["total_tests"] else None,
                    "missed": sorted(failed - run),
                }
            rows.append(row)
            print(f"{name}: direct {row['direct']['recall']:.2f} "
                  f"({row['direct']['hit']}/{len(failed)}) "
                  f"closure {row['closure']['recall']:.2f} "
                  f"selected {row['closure']['selected']}", flush=True)
    finally:
        store.close()

    measured = [r for r in rows if r["status"] == "measured"]
    out["mutations"] = rows

    def pool(arm: str) -> dict:
        fails = sum(len(r["failed_files"]) for r in measured)
        hits = sum(r[arm]["hit"] for r in measured)
        predicted = sum(r[arm]["selected"] for r in measured)
        recall = sorted(r[arm]["recall"] for r in measured)
        fractions = sorted(r[arm]["fraction"] for r in measured if r[arm]["fraction"] is not None)
        return {
            "mutations": len(measured),
            "unobserved": sum(1 for r in rows if r["status"] == "unobserved"),
            "unusable": sum(1 for r in rows if r["status"] == "unusable-suite"),
            "failing_test_files": fails,
            "hits": hits,
            "selected": predicted,
            "recall": round(hits / fails, 4) if fails else None,
            "precision": round(hits / predicted, 4) if predicted else None,
            "median_recall": round(recall[len(recall) // 2], 4) if recall else None,
            "median_fraction": round(fractions[len(fractions) // 2], 4) if fractions else None,
            "disclosed_of_missed": sum(r["undetermined_disclosed"] for r in measured),
            "unmapped_testcases": sum(len(r["unmapped"]) for r in measured),
        }

    out["pooled"] = {"direct": pool("direct"), "closure": pool("closure")}
    Path(args.out).write_text(json.dumps(out, indent=1))
    print(json.dumps(out["pooled"], indent=1))


if __name__ == "__main__":
    main()

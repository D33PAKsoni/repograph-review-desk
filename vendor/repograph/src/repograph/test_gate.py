"""Select the tests a change needs, and say what cannot be ruled out.

The value of this command is not the list it produces; it is that the list is
*checkable*. Run the selection, run the full suite, subtract: the difference is
the tool's recall, measured by pytest instead of by the author.

So the gate fails closed. A changed file missing from the index, a test file
that failed to parse, a test file with an unresolved internal import, or a
changed ``conftest.py`` are reported as undetermined rather than assumed
unrelated. ``--strict`` turns "I cannot prove this" into a nonzero exit.
"""

from __future__ import annotations

import posixpath
import shlex
import sys
from pathlib import Path

from .impact import _is_test_module, analyze_impact, git_changes
from .store import Store

# A test whose own imports we could not resolve may reach any file. Listing it
# as unrelated would be a silent false negative, which is the failure this tool
# exists to avoid.
_UNDETERMINED_SQL = """
SELECT f.path AS path,
       f.parse_error AS parse_error,
       (SELECT COUNT(*) FROM imports i
         WHERE i.file_id=f.id AND i.target_file_id IS NULL AND i.kind != 'external'
       ) AS unresolved
  FROM files f
 WHERE f.is_test=1 AND f.path LIKE '%.py'
   AND (f.parsed=0
        OR EXISTS (SELECT 1 FROM imports i
                    WHERE i.file_id=f.id AND i.target_file_id IS NULL
                      AND i.kind != 'external'))
 ORDER BY f.path
"""


def _is_pytest_file(path: str) -> bool:
    """pytest only collects Python; a .test.ts file is a test but not ours."""
    return path.endswith(".py") and _is_test_module(path)


def _pytest_command(run: list[str]) -> list[str]:
    return [sys.executable, "-m", "pytest", "-q", *run] if run else [sys.executable, "-m", "pytest", "-q"]


def select(
    store: Store,
    root: Path,
    *,
    paths: list[str] | None = None,
    diff: bool = False,
    base: str = "HEAD",
    strict: bool = False,
) -> dict:
    """Tests to run, tests that cannot be ruled out, and an exit code."""
    changed: list[str] = []
    source = "files"
    if diff:
        source = "git-diff"
        changes = git_changes(root, base=base)
        if not changes["available"]:
            return {"error": changes["error"]}
        changed = list(changes["paths"])
        deleted = set(changes["deleted"])
    else:
        changed = [p.strip("/") for p in (paths or [])]
        deleted = set()

    indexed = {r["path"] for r in store.all_files()}
    analysable = [p for p in changed if p in indexed]
    unindexed = [p for p in changed if p not in indexed and p not in deleted]

    total = store.conn.execute(
        "SELECT COUNT(*) AS n FROM files WHERE is_test=1"
    ).fetchone()["n"]
    test_paths = [r["path"] for r in store.conn.execute(
        "SELECT path FROM files WHERE is_test=1 ORDER BY path"
    ).fetchall() if _is_pytest_file(r["path"])]
    total = len(test_paths)

    run: list[dict] = []
    caveats: list[str] = []
    reachable: list[str] = []
    if analysable:
        impact = analyze_impact(store, root, paths=analysable, depth=2)
        if "error" in impact:
            return {"error": impact["error"]}
        for t in impact["related_tests"]:
            if not _is_pytest_file(t["path"]):
                continue
            run.append({
                "path": t["path"],
                "confidence": t["confidence"],
                "rules": list(dict.fromkeys(r["rule"] for r in t["rules"])),
                "evidence": t["evidence"],
            })
        for b in impact.get("blind_spots", []):
            if b["kind"] == "test-selection-reachability":
                reachable = [p for p in b.get("items") or [] if _is_pytest_file(p)]
        if reachable:
            caveats.append(
                f"{len(reachable)} more test files reach this change through dependent "
                "modules but are not selected; run them or the full suite"
            )
    else:
        caveats.append("no changed file is in the index; nothing can be selected")

    conftest_changed = [p for p in changed if posixpath.basename(p) == "conftest.py"]
    if conftest_changed:
        caveats.append(
            "a conftest.py changed: session fixtures can affect any test, so the whole suite is undetermined"
        )

    seen = {r["path"] for r in run}
    undetermined: list[dict] = []
    if conftest_changed:
        undetermined = [
            {"path": p, "reason": "conftest-change", "evidence": {"location": conftest_changed[0]}}
            for p in test_paths if p not in seen
        ]
        seen |= {u["path"] for u in undetermined}
    else:
        for row in store.conn.execute(_UNDETERMINED_SQL).fetchall():
            if row["path"] in seen:
                continue
            reason = "parse-error" if row["parse_error"] is not None else "unresolved-import"
            undetermined.append({
                "path": row["path"],
                "reason": reason,
                "evidence": {"location": row["path"], "detail": row["parse_error"]},
            })

    undetermined += [
        {"path": p, "reason": "changed-file-not-indexed", "evidence": {"location": p}}
        for p in unindexed
    ]

    argv = _pytest_command([r["path"] for r in run])
    selected = len(run)
    exit_code = 0
    if strict and (undetermined or not run):
        exit_code = 3
    return {
        "source": source,
        "base": base if diff else None,
        "changed_files": changed,
        "unindexed_changed_files": unindexed,
        "run": run,
        "reachable_not_selected": reachable,
        "undetermined": undetermined,
        "selection": {
            "run": selected,
            "undetermined": len(undetermined),
            "total_tests": total,
            "fraction": round(selected / total, 4) if total else None,
        },
        "command": shlex.join(argv),
        "argv": argv,
        "exit_code": exit_code,
        "caveats": caveats + [
            "selected tests are a lower bound: the static graph cannot see dynamic imports, "
            "fixtures that parameterize modules, or pytest plugins that collect elsewhere",
        ],
    }

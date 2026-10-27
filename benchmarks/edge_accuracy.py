#!/usr/bin/env python3
"""Sampled edge-accuracy evaluation for RepoGraph.

This tool does not label anything. It draws a deterministic, stratified sample
of import edges and reports metrics from independent label files.

    python benchmarks/edge_accuracy.py sample \
        --repo fastapi=/path/to/fastapi \
        --repo vue-core=/path/to/vue-core \
        --repo express=/path/to/express \
        --out benchmarks/eval/sample.jsonl

    python benchmarks/edge_accuracy.py report \
        --sample benchmarks/eval/sample.jsonl \
        --labels benchmarks/eval/labels-a.jsonl \
        --labels benchmarks/eval/labels-b.jsonl \
        --out benchmarks/eval/report.json

Label rubric: research/EDGE_ACCURACY_PROTOCOL.md. Never edit the sample file;
copy it and fill `label`.
"""

from __future__ import annotations

import argparse
import json
import random
import sqlite3
from collections import Counter, defaultdict
from pathlib import Path

RESOLVED_LABELS = {"correct", "wrong_target", "not_internal", "uncertain"}
MISS_LABELS = {"internal_missed", "external_ok", "unresolved_ok", "uncertain"}


def load_repo(spec: str) -> tuple[str, Path]:
    name, _, path = spec.partition("=")
    if not name or not path:
        raise SystemExit("--repo must be name=/absolute/path")
    root = Path(path).expanduser().resolve()
    if not root.is_dir():
        raise SystemExit(f"not a directory: {root}")
    if not (root / ".repograph" / "index.db").exists():
        raise SystemExit(f"no index at {root}/.repograph/index.db; index it first")
    return name, root


def read_line(root: Path, rel: str, line: int) -> str:
    try:
        lines = (root / rel).read_text(encoding="utf-8", errors="replace").splitlines()
        return lines[line - 1].strip()[:240] if 0 < line <= len(lines) else ""
    except OSError:
        return ""


def rows_for(conn: sqlite3.Connection, repo: str, kind: str) -> list[dict]:
    if kind == "resolved":
        sql = """
            SELECT i.id, i.raw, i.module, i.line, i.confidence, i.method, i.kind,
                   i.names, f.path AS file, t.path AS target
            FROM imports i JOIN files f ON f.id=i.file_id
            JOIN files t ON t.id=i.target_file_id
            WHERE i.kind='internal' AND i.target_file_id IS NOT NULL
            ORDER BY i.id
        """
    else:
        sql = """
            SELECT i.id, i.raw, i.module, i.line, i.confidence, i.method, i.kind,
                   i.names, f.path AS file, NULL AS target
            FROM imports i JOIN files f ON f.id=i.file_id
            WHERE i.kind=? ORDER BY i.id
        """
    cur = conn.execute(sql, () if kind == "resolved" else (kind,))
    out = []
    for row in cur.fetchall():
        d = dict(row)
        d["repo"] = repo
        d["stratum"] = f"{repo}|{kind}|{d['confidence']}"
        out.append(d)
    return out


def sample(args) -> None:
    rng = random.Random(args.seed)
    records: list[dict] = []
    population: dict[str, int] = {}
    for spec in args.repo:
        name, root = load_repo(spec)
        conn = sqlite3.connect(root / ".repograph" / "index.db")
        conn.row_factory = sqlite3.Row
        for kind, limit in (
            ("resolved", args.resolved_per_stratum),
            ("unresolved", args.unresolved_per_repo),
            ("external", args.external_per_repo),
        ):
            rows = rows_for(conn, name, kind)
            by_stratum: dict[str, list[dict]] = defaultdict(list)
            for row in rows:
                by_stratum[row["stratum"]].append(row)
            for stratum, pool in sorted(by_stratum.items()):
                population[stratum] = len(pool)
                take = min(limit, len(pool))
                chosen = rng.sample(sorted(pool, key=lambda r: r["id"]), take)
                for row in chosen:
                    row["kind_group"] = kind
                    row["stratum_size"] = len(pool)
                    row["source"] = read_line(root, row["file"], row["line"])
                    row["repo_path"] = str(root)
                    row["names"] = json.loads(row["names"] or "[]")
                    row["label"] = ""
                    row["note"] = ""
                    records.append(row)
        conn.close()

    rng.shuffle(records)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w") as fh:
        for i, row in enumerate(records, 1):
            row["id"] = f"{row['repo']}-{i:04d}"
            fh.write(json.dumps(row, sort_keys=True) + "\n")
    meta = {
        "seed": args.seed,
        "sample_size": len(records),
        "population": population,
        "labels": {},
    }
    (out.parent / (out.stem + ".meta.json")).write_text(json.dumps(meta, indent=2) + "\n")
    counts = Counter((r["repo"], r["kind_group"]) for r in records)
    print(json.dumps({"sample_size": len(records), "by_repo_kind": {
        f"{k[0]}:{k[1]}": v for k, v in sorted(counts.items())}}, indent=2))
    print(f"written: {out}")


def load_jsonl(path: Path) -> dict[str, dict]:
    out = {}
    for line in path.read_text().splitlines():
        if line.strip():
            row = json.loads(line)
            out[row["id"]] = row
    return out


def weighted(rows: list[dict], label_key: str) -> float:
    """Weighted count of a label, scaling each stratum to its population."""
    total = 0.0
    groups: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        groups[row["stratum"]].append(row)
    for _, group in groups.items():
        weight = group[0]["stratum_size"] / len(group)
        total += weight * sum(1 for r in group if r.get("label") == label_key)
    return total


def metrics(rows: list[dict], group: str) -> dict:
    resolved = [r for r in rows if r["kind_group"] == "resolved"]
    misses = [r for r in rows if r["kind_group"] in ("unresolved", "external")]
    resolved_labeled = [r for r in resolved if r.get("label") in RESOLVED_LABELS]

    correct = weighted(resolved_labeled, "correct")
    wrong = weighted(resolved_labeled, "wrong_target")
    not_internal = weighted(resolved_labeled, "not_internal")
    uncertain = weighted(resolved_labeled, "uncertain")
    denominator = correct + wrong + not_internal
    precision = correct / denominator if denominator else None
    precision_lower = correct / (denominator + uncertain) if denominator + uncertain else None

    missed = weighted(misses, "internal_missed")
    recall = correct / (correct + missed) if correct + missed else None

    unweighted = [r for r in resolved_labeled if r.get("label") != "uncertain"]
    simple_precision = (
        sum(1 for r in unweighted if r["label"] == "correct") / len(unweighted)
        if unweighted else None
    )

    by_confidence = {}
    for conf in sorted({r["confidence"] for r in resolved_labeled}):
        sub = [r for r in resolved_labeled if r["confidence"] == conf and r["label"] != "uncertain"]
        by_confidence[conf] = {
            "n": len(sub),
            "precision": round(sum(1 for r in sub if r["label"] == "correct") / len(sub), 4)
            if sub else None,
        }

    return {
        "group": group,
        "resolved_sample": len(resolved),
        "resolved_labeled": len(resolved_labeled),
        "miss_sample": len(misses),
        "weighted_estimated_edges": {
            "correct": round(correct, 1),
            "wrong_target": round(wrong, 1),
            "not_internal": round(not_internal, 1),
            "uncertain": round(uncertain, 1),
            "internal_missed": round(missed, 1),
        },
        "precision": round(precision, 4) if precision is not None else None,
        "precision_conservative": round(precision_lower, 4) if precision_lower is not None else None,
        "recall_estimate": round(recall, 4) if recall is not None else None,
        "precision_unweighted": round(simple_precision, 4) if simple_precision is not None else None,
        "by_confidence": by_confidence,
    }


def report(args) -> None:
    sample_rows = load_jsonl(Path(args.sample))
    label_files = [load_jsonl(Path(p)) for p in args.labels]
    if len(label_files) < 2:
        raise SystemExit("need at least two independent --labels files")

    rows = []
    disagreements = []
    for sid, base in sample_rows.items():
        labels = [f[sid].get("label") for f in label_files if sid in f]
        if len(labels) != len(label_files):
            disagreements.append({"id": sid, "reason": "missing-label", "labels": labels})
            continue
        if len(set(labels)) > 1:
            disagreements.append({"id": sid, "reason": "label-disagreement", "labels": labels,
                                  "file": base["file"], "line": base["line"],
                                  "module": base["module"], "target": base.get("target")})
            label = "uncertain"
        else:
            label = labels[0]
        row = dict(base)
        row["label"] = label
        rows.append(row)

    result = {
        "sample": args.sample,
        "labelers": args.labels,
        "n": len(rows),
        "agreement": round(1 - len(disagreements) / len(sample_rows), 4) if sample_rows else None,
        "disagreements": disagreements[:100],
        "disagreement_count": len(disagreements),
        "overall": metrics(rows, "all"),
    }
    for key in sorted({r["repo"] for r in rows}):
        result[key] = metrics([r for r in rows if r["repo"] == key], key)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({k: v for k, v in result.items() if k not in ("disagreements",)}, indent=2)[:6000])
    print(f"written: {out}")


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)

    s = sub.add_parser("sample")
    s.add_argument("--repo", action="append", required=True, help="name=/path")
    s.add_argument("--out", required=True)
    s.add_argument("--seed", type=int, default=20261027)
    s.add_argument("--resolved-per-stratum", type=int, default=30)
    s.add_argument("--unresolved-per-repo", type=int, default=30)
    s.add_argument("--external-per-repo", type=int, default=20)
    s.set_defaults(func=sample)

    r = sub.add_parser("report")
    r.add_argument("--sample", required=True)
    r.add_argument("--labels", action="append", required=True)
    r.add_argument("--out", required=True)
    r.set_defaults(func=report)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()

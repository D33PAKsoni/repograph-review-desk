#!/usr/bin/env python3
"""Reproducible RepoGraph benchmark on a real repository.

Usage:
    python benchmarks/benchmark.py --repo /path/to/repo --name repo-name
    python benchmarks/benchmark.py --clone https://github.com/psf/requests --name requests

Clones are shallow (depth 1) into --workdir. Results are written to
benchmarks/results/<name>.json. No numbers are synthesized: every value comes
from the run on this machine.
"""

from __future__ import annotations

import argparse
import json
import platform
import shutil
import statistics
import subprocess
import sys
import time
from pathlib import Path

from repograph.config import load_settings
from repograph.impact import analyze_impact
from repograph.indexer import index_repository
from repograph.query import architecture_summary, dependency_graph, search_symbols
from repograph.store import Store


def timed(fn):
    started = time.perf_counter()
    value = fn()
    return value, round(time.perf_counter() - started, 4)


def prepare(args) -> Path:
    workdir = Path(args.workdir).expanduser().resolve()
    workdir.mkdir(parents=True, exist_ok=True)
    if args.clone:
        dest = workdir / args.name
        if not dest.exists():
            subprocess.run(
                ["git", "clone", "--depth", "1", "--quiet", args.clone, str(dest)],
                check=True,
            )
        return dest
    src = Path(args.repo).expanduser().resolve()
    if not src.is_dir():
        raise SystemExit(f"not a directory: {src}")
    # Benchmark a copy so the source repository's index is never destroyed.
    dest = workdir / f"{args.name}-copy"
    if not dest.exists():
        ignore = shutil.ignore_patterns(
            ".git", ".repograph", ".venv", "venv", "node_modules",
            "__pycache__", "dist", "build", ".pytest_cache",
        )
        shutil.copytree(src, dest, ignore=ignore, symlinks=True)
    return dest


def benchmark(repo: Path, args) -> dict:
    state = repo / ".repograph"
    if state.exists():
        shutil.rmtree(state)

    cold, cold_s = timed(lambda: index_repository(repo))
    warm, warm_s = timed(lambda: index_repository(repo))

    settings = load_settings(repo)
    with Store(settings) as store:
        stats = store.stats()
        edges = store.file_edges()
        top_symbol = store.conn.execute(
            "SELECT name, COUNT(*) c FROM symbols GROUP BY name ORDER BY c DESC, name LIMIT 1"
        ).fetchone()
        inbound: dict[str, int] = {}
        for e in edges:
            inbound[e["dst"]] = inbound.get(e["dst"], 0) + 1
        hub = max(inbound, key=inbound.get) if inbound else None

        search_s = []
        for _ in range(5):
            _, dt = timed(lambda: search_symbols(store, top_symbol["name"] if top_symbol else "main"))
            search_s.append(dt)
        impact_s = []
        if hub:
            for _ in range(5):
                _, dt = timed(lambda: analyze_impact(store, repo, paths=[hub], depth=2))
                impact_s.append(dt)
        arch, arch_s = timed(lambda: architecture_summary(store, repo))
        graph, graph_s = timed(lambda: dependency_graph(store, depth=1))

    db = Path(settings.db_path)
    db_bytes = sum(p.stat().st_size for p in (db, Path(str(db) + "-wal")) if p.exists())

    return {
        "name": args.name,
        "source": args.clone or args.repo,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "environment": {
            "python": platform.python_version(),
            "platform": platform.platform(),
            "machine": platform.machine(),
        },
        "index": {
            "files": stats["files"],
            "symbols": stats["symbols"],
            "internal_imports": stats["internal_imports"],
            "refs": stats["refs"],
            "tests": stats["tests"],
            "parse_errors": stats["parse_errors"],
            "languages": stats["languages"],
            "cold_seconds": cold_s,
            "cold_added": cold.added,
            "incremental_seconds": warm_s,
            "incremental_updated": warm.updated,
            "db_bytes": db_bytes,
            "files_per_second": round(stats["files"] / cold_s, 1) if cold_s else None,
        },
        "queries": {
            "search_median_ms": round(statistics.median(search_s) * 1000, 2) if search_s else None,
            "impact_median_ms": round(statistics.median(impact_s) * 1000, 2) if impact_s else None,
            "architecture_ms": round(arch_s * 1000, 2),
            "graph_ms": round(graph_s * 1000, 2),
            "impact_hub": hub,
            "impact_hub_inbound": inbound.get(hub, 0) if hub else 0,
            "graph_nodes": len(graph.get("nodes", [])),
            "graph_edges": len(graph.get("edges", [])),
            "architecture_hubs": len(arch.get("dependency_hubs", [])),
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--repo", help="Local repository path")
    source.add_argument("--clone", help="Git URL to clone shallowly")
    parser.add_argument("--name", required=True)
    parser.add_argument("--workdir", default="/tmp/opencode/repograph-bench")
    parser.add_argument("--out", default=str(Path(__file__).parent / "results"))
    args = parser.parse_args()

    repo = prepare(args)
    result = benchmark(repo, args)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    path = out / f"{args.name}.json"
    path.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))
    print(f"\nwritten: {path}", file=sys.stderr)


if __name__ == "__main__":
    main()

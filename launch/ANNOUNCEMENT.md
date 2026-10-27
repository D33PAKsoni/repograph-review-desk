# Draft announcement

> **Not published.** Requires maintainer approval and the launch checklist in `LAUNCH_STRATEGY.md`.

## RepoGraph: local-first impact analysis for coding agents

Coding agents are good at editing a file and bad at knowing what else depends on it. Asking the agent to grep is not a dependency analysis, and a dependency list without provenance is hard to trust.

RepoGraph indexes a repository locally with tree-sitter and SQLite, then exposes the result through a CLI and an MCP server. The point is not another code graph. The point is an **auditable answer**:

- every relationship carries file:line, extraction method and confidence;
- unresolved, dynamic and external imports are reported separately;
- every impact analysis lists its blind spots;
- an empty dependent list is explicitly **not** a safety verdict.

```bash
repograph index .
repograph impact src/payments/refund.py
```

```
direct dependents (3):
  [confirmed] src/payments/api.py      (imports-changed-file at line 4)
  [confirmed] tests/test_refund.py     (imports-changed-file at line 2)
  [inferred]  src/payments/worker.py   (references-changed-symbol at line 31)

blind spots:
  - external-imports (2): External packages were not analyzed...
  - repo-parse-errors (1): Files with parse errors contribute no symbols or edges...
```

MCP tools: `search_symbols`, `find_references`, `get_dependency_graph`, `analyze_change_impact`, `find_related_tests`, `get_architecture_summary`.

### What it is not

- Not a compiler or type checker.
- Not semantic search.
- Not safe for a blocking CI gate yet.
- Not multi-language beyond Python, TypeScript and JavaScript.
- Not free of blind spots. Dynamic imports, reflection, DI and external consumers are not modeled.

### Measured on real repositories

Single run, Linux x86_64, Python 3.14.8:

| Repo | Files | Cold index | Incremental | Impact (highest-inbound, depth 2) |
| --- | ---: | ---: | ---: | ---: |
| requests | 37 | 0.26 s | 0.04 s | 8.2 ms |
| click | 91 | 0.57 s | 0.06 s | 18.4 ms |
| express | 142 | 0.28 s | 0.08 s | 2.1 ms |
| vue-core | 528 | 1.79 s | 0.24 s | 22.4 ms |
| fastapi | 1,223 | 5.26 s | 1.10 s | 82.1 ms |

Express exposed a real weakness: 142 JavaScript files yielded only 63 symbols because CommonJS function-expression exports are poorly extracted. Vue core produced two parse errors. Both are in the report.

### Try it

```bash
git clone <repository-url>
cd repograph
python -m venv .venv
.venv/bin/pip install -e .
.venv/bin/repograph index /path/to/your/repo
.venv/bin/repograph impact /path/to/your/repo/src/file.py --root /path/to/your/repo
```

Apache-2.0. No API key. No network. No code execution.

### What I want from you

Run it on a repository you know. Tell me where the graph is **wrong**: a missed import, a bad alias, a false dependent, a route it failed to see. Edge accuracy is the next milestone, and wrong-edge reports are more useful than stars.

---

*RepoGraph is an alpha. Do not use its output as the only basis for a production change.*

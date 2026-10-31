# Draft announcement

> **Not published.** Requires maintainer approval and the checklist in `LAUNCH_STRATEGY.md`.

## Which code does this change touch?

Coding agents are good at editing one file and bad at knowing what else depends on it. Grep finds
strings, not dependencies, and a list of "related files" with no provenance is hard to act on.

RepoGraph indexes a repository locally with tree-sitter and SQLite — no network, no API key, no
code execution — and answers questions where every edge carries its evidence:

```bash
repograph index .
repograph impact src/flask/helpers.py
```

```
direct dependents (10):
  [confirmed] src/flask/__init__.py      (imports-changed-file at line 13)
  [confirmed] src/flask/app.py           (imports-changed-file at line 38)
  [confirmed] src/flask/blueprints.py    (imports-changed-file at line 9)
  [confirmed] src/flask/cli.py           (imports-changed-file at line 24)
  [confirmed] tests/test_helpers.py      (imports-changed-file at line 8)
  ...
transitive dependents: 53
```

Four confidence classes (`confirmed`, `inferred`, `heuristic`, `unresolved`), external and dynamic
imports kept separate, and every report ends with its blind spots. An empty dependent list is
labelled as *not evidence of safety*.

MCP tools for agents: `search_symbols`, `find_references`, `get_dependency_graph`,
`analyze_change_impact`, `find_related_tests`, `get_architecture_summary`.

## Measured on real repositories

Edge accuracy, round 5 (httpx, zustand, mocha — never indexed or tuned against before the round):

| Metric | Result |
| --- | ---: |
| Precision | 118/120 audited resolved edges (98.3%, Wilson 94.1%–99.5%) |
| Estimated recall | 118/126 (93.7%, Wilson 88.0%–96.8%) |

Labels came from two independent AI agents with adjudication, not humans. Three small repositories
are not a random sample of all code; treat this as an estimate, not a promise.

Indexing is fast and local: requests 37 files / 0.26 s, click 91 / 0.57 s, fastapi 1,223 / 5.3 s.

## And one thing that does not work

I built a test-selection mode: *run only the tests this diff affects*. I measured it against real
pytest results — 22 mutations across click, Flask and packaging, 180 failing test files:

| | Selected tests | Recall |
| --- | ---: | ---: |
| Selection alone | median 6.7% of files | **0.23** (41/180) |
| Selection + every disclosed reachable file | 98.9% of files | 0.994 |

There is no setting that is both safe and cheap, so it is documented as a heuristic that must be
backed by a full suite run, and the number is printed next to the feature. If you want a code-graph
tool that publishes its own failures, this is that tool.

## Try it

```bash
pip install repograph-codeintel
repograph init . && repograph index .
repograph impact src/your_module.py
repograph setup .          # optional: registers the MCP server with Claude Code / Cursor / Codex
```

Python 3.10+. Apache-2.0. Indexes Python, TypeScript, TSX, JavaScript, JSX and Prisma.
Source: https://github.com/INDEX0-RESEARCH-LABS/repograph

## What I want from you

Run it on a repository you know well, and reply with **one place the graph is wrong**: a missed
import, a false dependent, a route it failed to see. Wrong-edge reports are worth more than stars.

Then, honestly: tell me whether you ran it a second time, and on what. That is the only number I
am actually trying to move.

---

*Alpha. Do not use its output as the only basis for a production change.*

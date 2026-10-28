<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/logo-dark.svg">
    <img src="docs/assets/logo.svg" alt="RepoGraph" width="440">
  </picture>
</p>

<p align="center">
  <a href="https://github.com/INDEX0-RESEARCH-LABS/repograph/actions/workflows/ci.yml"><img src="https://github.com/INDEX0-RESEARCH-LABS/repograph/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.python.org/downloads/"><img src="https://img.shields.io/badge/python-3.10%2B-3776AB" alt="Python 3.10+"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="Apache-2.0"></a>
  <a href="STATUS.md"><img src="https://img.shields.io/badge/status-alpha-orange" alt="alpha"></a>
</p>

<p align="center">
  <b>Change impact you can audit.</b><br>
  Local-first codebase intelligence for AI coding agents.
</p>

RepoGraph indexes a repository with tree-sitter, stores symbols, imports, references, routes and models in SQLite, and exposes the result through a CLI and an MCP server. Its focus is **change impact you can audit**: every relationship returns a source location, extraction method and confidence, and every analysis lists its blind spots.

```
repograph index .
repograph impact src/payments/refund.py
```

Output from the repository's own fixture (`tests/fixtures/shop`), unedited:

```
changed files (1): src/shop/services/subscription.py
changed symbols: 1
  function  cancel  src/shop/services/subscription.py:6

direct dependents (4):
  [confirmed] src/shop/__init__.py  (imports-changed-file at line 1)
  [confirmed] src/shop/api/routes.py  (imports-changed-file at line 3)
  [confirmed] src/shop/services/billing.py  (imports-changed-file at line 1)
  [confirmed] tests/test_subscription.py  (imports-changed-file at line 1)
transitive dependents: 1
  [confirmed] depth 2 src/shop/app.py

related tests (1):
  [inferred] tests/test_subscription.py  (test-imports-changed-file, test-name-matches-changed-file, test-name-matches-dependent)

affected routes:
  POST /subscriptions/{subscription_id}/cancel  src/shop/api/routes.py:8

blind spots:
  - repo-dynamic-imports (2): Dynamic imports exist in the repository; their runtime targets may include the changed files.
  - repo-parse-errors (1): Files with parse errors contribute no symbols or edges anywhere in the index.

note: absence of static evidence is not evidence of safety.
```

> **Status: 0.1.0 alpha.** Python, TypeScript, JavaScript, JSX and TSX only. Static analysis only. The benchmark numbers below are from one machine and one run; reproduce them with `benchmarks/benchmark.py`. Current evidence state, including what is *not* yet validated, is in [STATUS.md](STATUS.md).

## Why another code graph?

Most code-indexing tools answer *"what is connected?"*. RepoGraph answers *"what might this change break, how sure are you, and what did you fail to see?"*

- **Evidence on every edge.** Imports and references carry file, line, extractor and method.
- **Separate confidence classes.** `confirmed`, `inferred`, `heuristic`, `unresolved`.
- **Explicit blind spots.** Dynamic imports, reflection, unresolved imports, parse failures, external consumers and missing tests are reported, not silently dropped.
- **Empty is not safe.** A result with no dependents says so; it never claims the change is safe.
- **Local and dependency-light.** No API key, no cloud, no embeddings. SQLite plus tree-sitter.
- **Read-only by construction.** Indexing parses bytes. It never imports or executes repository code.

It is *not* a compiler front end, a semantic search engine, or a replacement for tests and type checking.

## Install

Requires Python 3.10+.

From a local checkout:

```bash
cd repograph
python -m venv .venv
.venv/bin/pip install -e '.[dev]'
.venv/bin/repograph version
```

Or install the checkout with pipx:

```bash
pipx install --editable .
```

## Quick start

```bash
cd /path/to/your/repo
repograph init .
repograph index .
repograph status .
```

Search, inspect and analyze:

```bash
repograph search "cancel_subscription"
repograph refs cancel_subscription
repograph graph --cycles
repograph arch
repograph impact src/billing/subscription.py
repograph impact --symbol SubscriptionService.cancel
repograph impact --diff            # current git worktree changes
```

All read commands accept `--json`. Analyze the current diff *after* re-indexing, so symbols added in the worktree exist in the index:

```bash
repograph index . && repograph impact --diff --json
```

## MCP server

```bash
repograph serve --root /path/to/repo          # stdio
repograph serve --root /path/to/repo --http   # streamable HTTP on 127.0.0.1:8765
```

Example client configuration:

```json
{
  "mcpServers": {
    "repograph": {
      "command": "repograph",
      "args": ["serve", "--root", "/absolute/path/to/repo"]
    }
  }
}
```

The server exposes six read-only tools:

| Tool | Purpose |
| --- | --- |
| `search_symbols` | Lexical symbol lookup with file:line |
| `find_references` | Definitions plus statically resolved reference sites |
| `get_dependency_graph` | File graph around a path or the whole repo |
| `analyze_change_impact` | Direct/transitive dependents, tests, routes, models, blind spots |
| `find_related_tests` | Tests selected by import edges and naming conventions |
| `get_architecture_summary` | Languages, layers, hubs, entry points, routes, models |

`REPOGRAPH_ROOT` is also read by `python -m repograph.mcp_server`.

The HTTP mode has **no authentication**. It binds to localhost by default and prints a warning for non-loopback hosts. Do not expose it to an untrusted network.

## How it works

<p align="center">
  <img src="docs/assets/architecture.svg" alt="RepoGraph pipeline: source bytes are scanned, parsed with tree-sitter, resolved statically into a local SQLite index, and queried through the CLI or MCP tools" width="820">
</p>

1. **Scan** — walk the repository with default and user exclusions, skip symlinks, binaries, oversized files and an optional file cap.
2. **Parse** — tree-sitter extracts symbols, imports, calls, attributes, routes and model classes. Source is read as bytes; nothing is imported.
3. **Resolve** — static resolver handles Python relative/absolute imports and `src` layouts, TypeScript `tsconfig` aliases and workspace packages, CommonJS `require`, and syntactic dynamic imports. External and unresolved imports are kept distinct.
4. **Store** — SQLite tables for `files`, `symbols`, `imports`, `refs` and `routes`, with incremental updates by size/mtime then SHA-256.
5. **Query** — graph traversal, reverse imports, cycle detection (Kosaraju), lexical search, documentation mentions and impact analysis.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the schema and algorithms.

## Confidence model

| Class | Meaning |
| --- | --- |
| `confirmed` | Direct syntax evidence, e.g. a call to a symbol defined in the same file or a resolved import binding. |
| `inferred` | Resolved through project conventions, e.g. a TypeScript path alias or a module-object attribute. |
| `heuristic` | Pattern-based, e.g. route decorators, model base classes, test naming. |
| `unresolved` | Kept in the index and reported, but no target was resolved. |

Transitive impact is computed from resolved import edges. A cycle is reported, not treated as an error.

## Benchmarks

Measured with `benchmarks/benchmark.py` on 2026-10-27, Linux x86_64, Python 3.14.8. Cold = empty index; incremental = immediate no-op re-index; impact = highest-inbound file, depth 2. Full JSON in [`benchmarks/results/`](benchmarks/results/).

| Repo | Files | Symbols | Cold | Incremental | DB | Search | Impact |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| [express](https://github.com/expressjs/express) | 142 | 63 | 0.28 s | 0.08 s | 176 KiB | 0.2 ms | 2.1 ms |
| [click](https://github.com/pallets/click) | 91 | 2,077 | 0.57 s | 0.06 s | 960 KiB | 2.5 ms | 18.4 ms |
| [requests](https://github.com/psf/requests) | 37 | 807 | 0.26 s | 0.04 s | 508 KiB | 0.7 ms | 8.2 ms |
| [vue-core](https://github.com/vuejs/core) | 528 | 2,273 | 1.79 s | 0.24 s | 1.5 MiB | 1.2 ms | 22.4 ms |
| [fastapi](https://github.com/fastapi/fastapi) | 1,223 | 7,125 | 5.26 s | 1.10 s | 4.0 MiB | 5.4 ms | 82.1 ms |

These numbers measure RepoGraph, not the quality of its answers. Express shows a real weakness: CommonJS function-expression exports yield few symbols. Vue core produced two parse errors in this run. Neither is hidden in the report; see [docs/LIMITATIONS.md](docs/LIMITATIONS.md).

## Measured accuracy

Edge accuracy is measured with a pre-registered protocol and two independent AI labelers. Round 5 used three repositories that had never been indexed or tuned against: httpx, zustand and mocha.

| Repository | Precision | Recall |
| --- | ---: | ---: |
| [httpx](https://github.com/encode/httpx) (Python) | 100% (30/30) | 100% (30/30) |
| [zustand](https://github.com/pmndrs/zustand) (TypeScript) | 96.7% (58/60) | 100% (58/58) |
| [mocha](https://github.com/mochajs/mocha) (JavaScript) | 100% (30/30) | 78.9% (30/38) |
| **overall** | **98.3%** (118/120) | **93.7%** (118/126) |

- Precision 95% interval: **94.1%–99.5%**; recall **88.0%–96.8%** (Wilson, 120 and 126 rows). Weighted for population size: 99.5% precision, 98.5% recall.
- Both precision errors are one defect: a root `tsconfig` alias applied to zustand example apps that pin the registry package. Fixed afterwards (alias scope follows `include`; cross-package names need a workspace declaration) and rechecked on the same sample: both rows now external, 118/118 correct rows unchanged. The estimate below stays 118/120.
- All eight agreed misses are JSON `require`s in mocha, a documented non-code blind spot. That is why mocha's recall is below the pooled figure; the per-repository number is the honest one.
- `confirmed` edges were 90/90 correct; `inferred` edges 28/30.
- An earlier round on flask, vite and svelte measured 150/150 precision and 94.3% recall, and its misses drove twelve resolver fixes. Those numbers describe that build, not this one.
- Recall is an estimate, not a census. Known gaps: Python apps imported by bare name from `tests/`/`examples/`, Node `#imports` aliases, JSON/config imports, and package self-references. Non-code assets, `.vue` SFCs and bundler-virtual modules (`?raw`, `?worker`) are reported as unresolved or external, not guessed.

Method, adjudication log and threats to validity: [`research/EDGE_ACCURACY_RESULTS.md`](research/EDGE_ACCURACY_RESULTS.md). Precision does not make an empty dependent list safe: re-index and verify before relying on absence.

## Limitations

- Static analysis only. Reflection, dynamic imports with computed targets, runtime DI, generated code and external consumers are not fully modeled.
- Python and TypeScript/JavaScript are the only supported languages today.
- Symbol names are lexical, not semantic. `search` does not understand intent.
- Impact analysis is file- and symbol-oriented. It does not perform data-flow or type analysis.
- Test selection is heuristic. It can miss tests and include irrelevant ones. A measured run on Flask found **24% file recall** on six behaviour-changing mutations (60% if transitive dependents are counted); see `research/TEST_SELECTION_RESULTS.md`. Always run the suite; do not treat the list as complete.
- Route/model extraction is framework-specific and incomplete.
- Diff analysis uses symbols already in the index; re-index before analyzing a fresh edit.

## Development

```bash
.venv/bin/python -m pytest
.venv/bin/python -m pytest --cov=repograph --cov-report=term-missing
.venv/bin/python benchmarks/benchmark.py --repo . --name repograph
```

62 tests run in a few seconds. CI runs them on Python 3.10, 3.12 and 3.13, then smoke-tests `repograph arch --root .`. Direct coverage is 70%; the CLI and MCP server are exercised through subprocesses, so the coverage tool attributes none of that to their modules.

Contribution rules, test expectations and the security model are in [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## License

Apache-2.0. See [LICENSE](LICENSE).

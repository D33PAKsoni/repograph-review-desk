# RepoGraph

Local-first codebase intelligence for AI coding agents.

RepoGraph indexes a repository with tree-sitter, stores symbols, imports, references, routes and models in SQLite, and exposes the result through a CLI and an MCP server. Its focus is **change impact you can audit**: every relationship returns a source location, extraction method and confidence, and every analysis lists its blind spots.

```
repograph index .
repograph impact src/payments/refund.py
```

Illustrative output (paths abbreviated):

```
direct dependents (3):
  [confirmed] src/payments/api.py  (imports-changed-file at line 4)
  [confirmed] tests/test_refund.py  (imports-changed-file at line 2)
  [inferred]  src/payments/worker.py  (references-changed-symbol at line 31)

blind spots:
  - external-imports (2): External packages were not analyzed...
  - repo-parse-errors (1): Files with parse errors contribute no symbols or edges...

note: absence of static evidence is not evidence of safety.
```

> **Status: 0.1.0 alpha.** Python, TypeScript, JavaScript and TSX only. Static analysis only. The benchmark numbers below are from one machine and one run; reproduce them with `benchmarks/benchmark.py`.

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

Edge accuracy was measured with a pre-registered protocol and two independent AI labelers. The final test used three repositories not used to develop the resolver: flask, vite and svelte.

| Repository | Precision | Recall |
| --- | ---: | ---: |
| flask (Python) | 100% | 94.9% |
| vite (TypeScript monorepo) | 100% | 85.5% |
| svelte (JS/TS compiler) | 100% | 97.6% |
| **overall** | **100%** (150/150) | **94.3%** |

- No false resolved edge appeared in the final sample (Wilson 95% lower bound 97.5%).
- `confirmed` and `inferred` edges were both 100% precise in that sample.
- Those numbers describe the measured build. Later resolver fixes were verified by a within-sample recheck (25 of 29 known misses resolved, no previously correct sampled edge changed); that recheck is not a new recall estimate. See `research/EDGE_ACCURACY_RESULTS.md`.
- Recall is an estimate, not a census. The largest known gaps: Python apps imported by bare name from `tests/`/`examples/`, Node `#imports` aliases, JSON/config imports, and package self-references. Non-code assets, `.vue` SFCs and bundler-virtual modules (`?raw`, `?worker`) are reported as unresolved or external, not guessed.
- Earlier rounds found and fixed 12 measured defects, including false stdlib edges, missed CommonJS root imports, broken `tsconfig` globs and `.d.ts` resolution. The baseline Express recall was 32%.

Full method, per-repository tables, disagreements and threats to validity: [`research/EDGE_ACCURACY_RESULTS.md`](research/EDGE_ACCURACY_RESULTS.md). Precision does not make an empty dependent list safe: re-index and verify before relying on absence.

## Limitations

- Static analysis only. Reflection, dynamic imports with computed targets, runtime DI, generated code and external consumers are not fully modeled.
- Python and TypeScript/JavaScript are the only supported languages today.
- Symbol names are lexical, not semantic. `search` does not understand intent.
- Impact analysis is file- and symbol-oriented. It does not perform data-flow or type analysis.
- Test selection is heuristic. It can miss tests and include irrelevant ones.
- Route/model extraction is framework-specific and incomplete.
- Diff analysis uses symbols already in the index; re-index before analyzing a fresh edit.

## Development

```bash
.venv/bin/python -m pytest
.venv/bin/python -m pytest --cov=repograph --cov-report=term-missing
.venv/bin/python benchmarks/benchmark.py --repo . --name repograph
```

Contribution rules, test expectations and the security model are in [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## License

Apache-2.0. See [LICENSE](LICENSE).

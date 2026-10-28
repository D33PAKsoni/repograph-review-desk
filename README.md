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
  Local code intelligence for AI coding agents.
</p>

RepoGraph reads a repository and builds a map of its files, symbols and imports. You can then ask one practical question:

> If I change this file or symbol, what else may break — and how sure can I be?

Every answer shows **where the evidence comes from** and **what the tool could not see**. It runs on your machine. No API key, no cloud account, no code execution.

```bash
repograph index .
repograph impact src/payments/refund.py
```

Real output from the repository's test fixture (`tests/fixtures/shop`), unedited:

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

documentation mentions:
  docs/adr/0001-subscription-cancellation.md:1
  docs/adr/0001-subscription-cancellation.md:3
  docs/adr/0001-subscription-cancellation.md:5

blind spots:
  - repo-dynamic-imports (2): Dynamic imports exist in the repository; their runtime targets may include the changed files.
  - repo-parse-errors (1): Files with parse errors contribute no symbols or edges anywhere in the index.

note: absence of static evidence is not evidence of safety.
```

> **Status: 0.1.0 alpha.** Supports Python, TypeScript, JavaScript, JSX and TSX. Static analysis only. See [STATUS.md](STATUS.md) for what is validated and what is not.

## Contents

- [Why RepoGraph](#why-repograph)
- [Requirements](#requirements)
- [Install](#install)
- [Quick start](#quick-start)
- [Commands](#commands)
- [MCP server](#mcp-server)
- [How it works](#how-it-works)
- [Confidence levels](#confidence-levels)
- [Measured accuracy](#measured-accuracy)
- [Performance](#performance)
- [What RepoGraph is not](#what-repograph-is-not)
- [Limitations](#limitations)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Why RepoGraph

Most code-map tools answer *"what is connected?"*. RepoGraph answers *"what may break, how sure are you, and what did you miss?"*.

| What you get | What it means in practice |
| --- | --- |
| **Evidence on every link** | Each import and reference shows file, line, extractor and method. |
| **Separate confidence levels** | `confirmed`, `inferred`, `heuristic` and `unresolved` are never mixed together. |
| **Explicit blind spots** | Dynamic imports, reflection, parse errors, unresolved imports and missing tests are reported, not hidden. |
| **No false comfort** | An empty result says "no dependents found", never "this change is safe". |
| **Local and small** | SQLite and tree-sitter. No server, no account, no embeddings. |
| **Read-only by design** | The indexer reads bytes. It never imports or runs repository code. |

## Requirements

| Item | Requirement |
| --- | --- |
| Python | 3.10 or newer |
| Operating system | Linux is tested in CI. macOS and Windows should work but are not tested yet. |
| Disk | A few MB per repository for the index |
| Network | Not needed after install |
| API keys | None |

## Install

RepoGraph is not yet published to PyPI. Install it from a checkout.

**1. Clone and create a virtual environment**

```bash
git clone https://github.com/INDEX0-RESEARCH-LABS/repograph.git
cd repograph
python -m venv .venv
```

**2. Install**

```bash
.venv/bin/pip install -e .
```

For development, include the test tools:

```bash
.venv/bin/pip install -e '.[dev]'
```

**3. Check the install**

```bash
.venv/bin/repograph version
```

If you use `pipx`, you can install the checkout the same way:

```bash
pipx install --editable .
```

## Quick start

**1. Go to the repository you want to analyze**

```bash
cd /path/to/your/repo
```

**2. Create the local index folder**

```bash
repograph init .
```

This creates `.repograph/` with a default config file (`exclude`, size and file caps, symlink policy). The index database also lives there. Commit the config if your team wants shared rules; do not commit the database.

**3. Build the index**

```bash
repograph index .
```

**4. Check what was indexed**

```bash
repograph status .
```

**5. Ask a question**

```bash
repograph impact src/billing/subscription.py
```

That is the whole loop. Re-run `repograph index .` after you change code.

## Commands

All read commands accept `--json` for scripts and agents.

| Command | What it does |
| --- | --- |
| `repograph init [path]` | Create `.repograph/` and a default config. |
| `repograph index [path]` | Scan, parse and store the repository. Incremental by default; `--force` reparses everything, `--reset` drops the index first. |
| `repograph status [path]` | Show file, symbol and edge counts, parse errors and whether a re-index is needed. |
| `repograph search <query>` | Search symbol names and source text. Filter with `--kind`, limit with `--limit`. |
| `repograph refs <name>` | Show the definition of a symbol and its resolved reference sites. |
| `repograph graph [path]` | Show the file dependency graph around a path or for the whole repo. Use `--direction in\|out\|both`, `--depth 1-5`, `--format dot`, or `--cycles`. |
| `repograph arch` | Summarize languages, layers, hubs, entry points, routes, models, unresolved imports and parse errors. |
| `repograph impact <paths>` | List direct and transitive dependents, related tests, affected routes and models, and blind spots. |
| `repograph impact --symbol <Name>` | Analyze a symbol instead of a file. |
| `repograph impact --diff` | Analyze the current git worktree changes. |
| `repograph serve` | Start the MCP server (see below). |
| `repograph version` | Print the version. |

### Common options

| Option | Used by | Effect |
| --- | --- | --- |
| `--root <path>` | read commands, `serve` | Repository root to use. Defaults to the current directory. |
| `--json` | read commands | Machine-readable output. |
| `--depth <1-5>` | `impact`, `graph` | How many levels to follow. Default is 2. |
| `--tests / --no-tests` | `impact` | Include or skip related tests. Tests are included by default. |

### Analyze an uncommitted change

The index must know about your edit before the diff can be analyzed:

```bash
repograph index . && repograph impact --diff --json
```

## MCP server

MCP (Model Context Protocol) is the standard way for AI assistants to call external tools. RepoGraph ships a read-only MCP server, so an agent can query the index instead of grepping the whole repository.

```bash
repograph serve --root /path/to/repo          # stdio, for local clients
repograph serve --root /path/to/repo --http   # streamable HTTP on 127.0.0.1:8765
```

Client configuration:

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

The server exposes six tools:

| Tool | What it returns |
| --- | --- |
| `search_symbols` | Symbol matches with file and line. |
| `find_references` | Definitions plus statically resolved reference sites. |
| `get_dependency_graph` | The file graph around a path, or the whole repo. |
| `analyze_change_impact` | Direct and transitive dependents, tests, routes, models and blind spots. |
| `find_related_tests` | Candidate tests, chosen by imports and naming rules. |
| `get_architecture_summary` | Languages, layers, hubs, entry points, routes and models. |

`python -m repograph.mcp_server` also works and reads the `REPOGRAPH_ROOT` environment variable.

> **Security notice:** HTTP mode has **no authentication**. It binds to `127.0.0.1` by default and warns if you choose another host. Do not expose it to an untrusted network.

## How it works

<p align="center">
  <img src="docs/assets/architecture.svg" alt="Pipeline: source bytes are scanned, parsed with tree-sitter, resolved, stored in a local SQLite index, and queried by the CLI or MCP tools" width="820">
</p>

| Step | What happens |
| --- | --- |
| **1. Scan** | Walk the repository. Skip symlinks, binaries, oversized files, secret-shaped filenames and configured paths. |
| **2. Parse** | tree-sitter, a parser library, extracts symbols, imports, calls, attributes, routes and model classes. Source is read as bytes. |
| **3. Resolve** | Match imports to files: Python relative and absolute imports, `src` layouts, TypeScript aliases, workspace packages, CommonJS `require` and literal dynamic imports. External and unresolved imports stay separate. |
| **4. Store** | Write tables to a local SQLite database (one file): files, symbols, imports, references and routes. Updates use size and mtime first, then SHA-256. |
| **5. Query** | Traverse the graph, find reverse imports, detect cycles (Kosaraju), search names and documentation, and build impact reports. |

Schema and algorithms: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Confidence levels

Every answer is labeled. The labels are the point of the tool, so read them before you act.

| Label | Meaning | Example |
| --- | --- | --- |
| `confirmed` | Direct syntax evidence. | A resolved import, or a call to a symbol in the same file. |
| `inferred` | Found through project conventions. | A TypeScript path alias, or a workspace package entry. |
| `heuristic` | Pattern-based, can be wrong. | Route decorators, model base classes, test naming. |
| `unresolved` | Stored and reported, but no target was found. | A missing file or a computed import path. |

Transitive impact follows resolved import edges only. A dependency cycle is reported as a cycle; it is not treated as an error.

## Measured accuracy

Accuracy is measured with a pre-registered protocol and two independent AI labelers. Round 5 used three repositories that were never indexed or tuned against before.

| Repository | Precision | Recall |
| --- | ---: | ---: |
| [httpx](https://github.com/encode/httpx) (Python) | 100% (30/30) | 100% (30/30) |
| [zustand](https://github.com/pmndrs/zustand) (TypeScript) | 96.7% (58/60) | 100% (58/58) |
| [mocha](https://github.com/mochajs/mocha) (JavaScript) | 100% (30/30) | 78.9% (30/38) |
| **Overall** | **98.3%** (118/120) | **93.7%** (118/126) |

- 95% intervals: precision **94.1%–99.5%**, recall **88.0%–96.8%** (Wilson). Weighted by the number of imports in each repository: 99.5% precision, 98.5% recall.
- Both precision errors were one defect: a root `tsconfig` alias applied to zustand example apps that pin the registry package. It is fixed and rechecked on the same sample; the measured figure stays 118/120.
- All eight agreed misses are JSON `require`s in mocha. JSON files are not part of the code graph, which is why mocha's recall is shown separately instead of being averaged away.
- `confirmed` edges: 90/90 correct. `inferred` edges: 28/30.
- An earlier round on flask, vite and svelte measured 150/150 precision and 94.3% recall, and drove twelve resolver fixes. Those numbers describe that build, not this one.
- Recall is an estimate, not a census. Known gaps: JSON and config imports, Node `#imports` aliases, Python imports that rely on test or example paths, and package self-references. Non-code assets, `.vue` files and bundler-only specifiers (`?raw`, `?worker`) are reported as unresolved or external, never guessed.

Method, adjudication and threats to validity: [research/EDGE_ACCURACY_RESULTS.md](research/EDGE_ACCURACY_RESULTS.md).

> A correct edge list does not make an empty result safe. Re-index, then verify before you rely on "no dependents".

## Performance

Measured with `benchmarks/benchmark.py` on 2026-10-27: Linux x86_64, Python 3.14.8, one run per repository. Cold = empty index. Incremental = immediate no-op re-index. Impact = highest-inbound file, depth 2. Raw JSON: [`benchmarks/results/`](benchmarks/results/).

| Repository | Files | Symbols | Cold index | Incremental | Index size | Search | Impact |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| [express](https://github.com/expressjs/express) | 142 | 63 | 0.28 s | 0.08 s | 176 KiB | 0.2 ms | 2.1 ms |
| [click](https://github.com/pallets/click) | 91 | 2,077 | 0.57 s | 0.06 s | 960 KiB | 2.5 ms | 18.4 ms |
| [requests](https://github.com/psf/requests) | 37 | 807 | 0.26 s | 0.04 s | 508 KiB | 0.7 ms | 8.2 ms |
| [vue-core](https://github.com/vuejs/core) | 528 | 2,273 | 1.79 s | 0.24 s | 1.5 MiB | 1.2 ms | 22.4 ms |
| [fastapi](https://github.com/fastapi/fastapi) | 1,223 | 7,125 | 5.26 s | 1.10 s | 4.0 MiB | 5.4 ms | 82.1 ms |

These numbers describe RepoGraph, not the quality of its answers. Express is a known weak spot: CommonJS function-expression exports produce few symbols. Vue core produced two parse errors in that run. Both cases appear in the reports; see [docs/LIMITATIONS.md](docs/LIMITATIONS.md).

## What RepoGraph is not

It is not a compiler front end, a type checker, a semantic search engine, or a replacement for your test suite. It does not prove that a change is safe. It gives you a checked list of what is linked, what is uncertain, and what it could not see.

## Limitations

- **Static analysis only.** Reflection, computed dynamic imports, runtime dependency injection, generated code and external consumers are not fully modeled.
- **Two language families.** Python and TypeScript/JavaScript (including JSX and TSX). Other languages are ignored.
- **Lexical search.** `search` matches names and text. It does not understand intent.
- **No data-flow or type analysis.** Impact is file- and symbol-oriented.
- **Test selection is heuristic.** It can miss tests and include unrelated ones. A measured run on Flask found **24% file recall** (60% when transitive dependents are counted). Read [research/TEST_SELECTION_RESULTS.md](research/TEST_SELECTION_RESULTS.md). Always run the full suite.
- **Framework coverage is partial.** Route and model extraction knows common patterns, not every framework.
- **Diffs use indexed symbols.** Re-index before analyzing a fresh edit.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `impact --diff` finds nothing | The worktree edit is not indexed yet. Run `repograph index .` first. |
| No dependents, but the code does break | The edge may be dynamic, unresolved or outside the indexed languages. Check the blind spots block. |
| Fewer symbols than expected | The language may use patterns the extractor does not cover (for example CommonJS function-expression exports). Check `repograph status` and `repograph arch` for parse errors. |
| `status` says a re-index is needed | Files changed after the last index. Run `repograph index .`. |
| MCP client cannot connect | Use an absolute path in `--root`, and confirm the `repograph` binary is on the client's `PATH`. |

## Development

```bash
.venv/bin/python -m pytest
.venv/bin/python -m pytest --cov=repograph --cov-report=term-missing
.venv/bin/python benchmarks/benchmark.py --repo . --name repograph
```

62 tests run in a few seconds. CI runs them on Python 3.10, 3.12 and 3.13, then smoke-tests `repograph arch --root .`. Direct coverage is 70%. The CLI and MCP server are tested through subprocesses, so the coverage tool does not attribute those runs to their modules.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) for code style, test expectations and the review process. Report security issues privately as described in [SECURITY.md](SECURITY.md). Do not open a public issue for a vulnerability.

## License

Apache-2.0. See [LICENSE](LICENSE).

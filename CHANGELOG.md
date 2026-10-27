# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project follows semantic versioning once it reaches 1.0.

## [Unreleased]

### Added

- Pre-registered edge-accuracy protocol, deterministic stratified sampler/reporter (`benchmarks/edge_accuracy.py`), independent labels and weighted precision/recall reports in `benchmarks/eval/`.
- `research/EDGE_ACCURACY_RESULTS.md`: baseline, development rounds and an unseen final test (flask, vite, svelte) with threats to validity.

### Fixed

- Python bare imports of example/test applications now resolve through project roots (`pyproject.toml`, `setup.py`, `setup.cfg`, including `src` layouts) and `conftest` `syspath_prepend` directories, as `inferred`; ambiguous names stay unresolved.
- Node `#private` specifiers resolve from the nearest `package.json` `imports` map, including `*` keys and condition objects.
- Package entries that point at unbuilt `dist/…` output map back to `src/…`, so a package self-reference (for example `import "vite"` inside Vite) resolves.
- Python stdlib names no longer bind to same-named repository files (`types` → `fastapi/types.py`), which produced 24 false edges.
- CommonJS `require('..')` now resolves the root `index.js` (96 Express imports).
- `.d.ts` files resolve for extensionless TypeScript imports (17 Vue misses).
- `tsconfig` glob aliases survive JSONC comment stripping (`"@vue/*"` was truncated as a comment).
- Workspace packages resolve subpaths and prefer source entries over unbuilt `dist` shims.
- ESM `./x.js` imports map to `x.ts`; `import pkg` binds `pkg/__init__.py` in `src` layouts.
- Directories named `env` are no longer excluded (`lib/env/data.js`).
- `from . import mod` no longer emits a duplicate package edge, while attribute imports keep the `__init__` edge.

## [0.1.0] — 2026-10-27

First alpha. Local-only, read-only analysis.

### Added

- Incremental SQLite index in `.repograph/index.db`, with SHA-256 checking, WAL mode and per-file transactions.
- tree-sitter extraction for Python, TypeScript, TSX, JavaScript, JSX and Prisma: symbols, imports, references, decorators, routes and model tags.
- Static import resolution for Python relative/absolute imports and `src` layouts; TypeScript `tsconfig` aliases and workspace packages; CommonJS `require`; syntactic dynamic imports.
- Four confidence classes (`confirmed`, `inferred`, `heuristic`, `unresolved`) and a separate `external` import class.
- Symbol search, source and documentation text search, definitions/references lookup.
- Dependency graph with direction and depth, cycle detection via Kosaraju, architecture summary with layers, hubs, entry points, routes and models.
- Change-impact analysis from paths, a symbol, or the git worktree diff: direct and transitive dependents, related tests, affected routes, related models, documentation mentions, confidence counts and explicit blind spots.
- Typer CLI: `init`, `index`, `status`, `search`, `impact`, `graph`, `refs`, `arch`, `serve`, `version`.
- MCP stdio and streamable-HTTP server with six read-only tools: `search_symbols`, `find_references`, `get_dependency_graph`, `analyze_change_impact`, `find_related_tests`, `get_architecture_summary`.
- Security controls: no code execution, symlink policy, fixed default exclusions, secret-shaped filename exclusions, size/file limits, path containment, bound SQL parameters.
- Tests covering extraction, resolution, scanning, incremental indexing, impact, CLI subprocess behavior, MCP stdio behavior and non-execution.
- Reproducible benchmark script and measured results for express, click, requests, vue-core and fastapi.

### Known limitations

- Static analysis only; dynamic targets, reflection, runtime DI and external consumers are not modeled.
- Only Python and TypeScript/JavaScript have first-class support. Express-style CommonJS exports are weakly extracted.
- Test selection and route/model detection are heuristic.
- Diff analysis reads symbols from the index; re-index before analyzing fresh edits.
- No schema migration; a mismatch requires re-indexing.

[0.1.0]: https://github.com/INDEX0-RESEARCH-LABS/repograph/releases/tag/v0.1.0

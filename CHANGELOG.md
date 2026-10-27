# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project follows semantic versioning once it reaches 1.0.

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

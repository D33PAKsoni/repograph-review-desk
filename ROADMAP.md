# Roadmap

No dates. Items move when they are tested, not when they are announced.

## 0.1 — current alpha

- [x] Python, TypeScript, TSX, JavaScript and Prisma extraction via tree-sitter.
- [x] Incremental SQLite index with SHA-256 verification.
- [x] Python relative/absolute imports, `src` layouts, TypeScript aliases, workspace packages, `require` and syntactic dynamic imports.
- [x] Symbols, imports, references, routes and model tags.
- [x] Lexical symbol/source/documentation search.
- [x] File graph, cycles (Kosaraju), architecture summary.
- [x] Impact analysis with direct/transitive dependents, related tests, routes, models, confidence and blind spots.
- [x] Git worktree diff mapping.
- [x] Typer CLI and six-tool MCP server.
- [x] Unit, integration, CLI, MCP and security tests.
- [x] Reproducible benchmarks on five public repositories.
- [x] Edge-accuracy evaluation on development and unseen repositories (`research/EDGE_ACCURACY_RESULTS.md`).

## 0.2 — precision before breadth

- [ ] Reduce unresolved imports on real repositories; publish unresolved-rate metrics per benchmark.
- [ ] Better CommonJS/ESM export handling, including `export *` chains and `package.json` `exports`.
- [ ] Improve TypeScript symbol extraction for arrow-function exports and default exports.
- [ ] Store and expose reference evidence for framework route handlers, not only the route line.
- [ ] Add changed-symbol impact when no resolved reference exists (currently a known blind spot).
- [ ] Add `--fail-on-unresolved` style CI guardrails for teams that want a strict mode.
- [ ] Add schema migration tooling instead of the current version-mismatch error.
- [x] Publish a precision/recall evaluation on a labeled set of import edges, including false positives.
- [ ] Close measured recall gaps: Python `tests/`/`examples/` roots, Node `#imports`, JSON/config imports, conditional `exports`.

## 0.3 — language and repository coverage

- [ ] Go extraction and module resolution.
- [ ] Rust extraction and Cargo workspace resolution.
- [ ] Java/Kotlin extraction for Spring-style routes and models.
- [ ] Nested/multi-root monorepo support with per-package configs.
- [ ] Configuration for generated directories and custom route patterns.
- [ ] Explicit cross-repository boundaries (no implicit merge).

## Later / exploratory

- [ ] LSP or long-running index server for editor integration.
- [ ] Tree-sitter query packs so language support can be extended without touching core Python.
- [ ] Call-graph depth beyond file imports, with clearly separate confidence.
- [ ] Change-impact reports as SARIF or GitHub annotations.
- [ ] Optional semantic retrieval, clearly separated from the deterministic graph.

## Explicit non-goals

- Executing or building the analyzed repository.
- Required cloud services or API keys.
- Claiming that a change is safe because the graph is empty.
- Replacing tests, type checkers or code review.
- A general-purpose RAG/vector database.

## Known gaps that block a 1.0

- No human-labeled or adjudicated accuracy set; current labels are from independent AI agents.
- Measured recall gaps remain in test/example import roots, `#imports`, config files and conditional exports.
- Dynamic and reflective code remains a blind spot by design, but its practical frequency is not measured.
- Only three first-class languages.
- No migration story for schema changes beyond `--force`.
- Single-machine SQLite only; no tested upper bound beyond the benchmark repositories.

See [docs/LIMITATIONS.md](docs/LIMITATIONS.md) for the full list.

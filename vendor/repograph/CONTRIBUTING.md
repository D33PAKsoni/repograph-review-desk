# Contributing

RepoGraph is an alpha-stage, local-first tool. Small, evidence-backed changes are preferred over broad rewrites.

## Setup

```bash
python -m venv .venv
.venv/bin/pip install -e '.[dev]'
.venv/bin/python -m pytest
```

Python 3.10+ is required. The project uses tree-sitter, SQLite, Typer and the official MCP Python SDK. There is no network access requirement at runtime.

## Quality bar

A change is ready when:

1. `pytest` passes.
2. New behavior has a test that would fail without it.
3. Every new relationship type carries a source location, method and confidence.
4. Blind spots are still reported. Do not turn an empty result into "safe".
5. No benchmark or performance number is added unless it was measured and reproducible.
6. No new dependency is added for something the standard library or an existing dependency handles.

Run the full suite and coverage before opening a pull request:

```bash
.venv/bin/python -m pytest --cov=repograph --cov-report=term-missing
```

Coverage is a diagnostic, not a target. The CLI and MCP server are exercised through subprocesses, so they show low direct line coverage even when behavior is tested.

## Architecture rules

- **Never execute repository code.** Parsing must operate on bytes. Tests enforce this.
- **Keep the graph honest.** Distinguish `confirmed`, `inferred`, `heuristic`, `unresolved` and `external`. Do not collapse them.
- **Keep paths inside the root.** Use `safe_path` and the resolver; do not hand-roll path joins on user input.
- **No dynamic SQL identifiers.** Bind values. Only generated `?` lists may be interpolated.
- **Preserve uncertainty.** If a relationship cannot be resolved, store evidence of the attempt and expose it in `blind_spots`.
- **No schema changes without migration.** Bump `SCHEMA_VERSION` and provide an explicit upgrade path or a clear error.
- **No network in indexing or query paths.**
- **No required API keys.**

## Adding a language

1. Add extensions to `scanner.LANGUAGES` and a tree-sitter grammar dependency.
2. Add extraction in `extract.py` for symbols, imports, references and routes.
3. Add import resolution in `resolve.py`, including external/unresolved classification.
4. Add a fixture under `tests/fixtures/` with a real import graph, a cycle, a parse error and a dynamic edge.
5. Document known blind spots in `docs/LIMITATIONS.md`.
6. Run the benchmark script before and after; report actual numbers.

## Adding a resolver rule

Include at least one positive and one negative test. Negative tests matter more: a false edge changes impact analysis and confidence. Show the evidence fields in the assertion.

## Tests

```bash
.venv/bin/python -m pytest tests/unit
.venv/bin/python -m pytest tests/integration
```

The fixture repository is copied to a temporary directory per test. It includes Python `src` layout, TypeScript path aliases and workspace packages, CommonJS `require`, dynamic imports, a file cycle, routes, models, tests, an ADR and an intentionally broken file.

## Commits and pull requests

- Use focused commits with an imperative subject.
- Explain *why* in the body, and name the limitation or trade-off.
- Include before/after output for user-visible behavior.
- Do not include generated indexes, virtual environments or benchmark clones.
- Do not push to `main` or publish packages without maintainer approval.

## Reporting bugs

Include the RepoGraph version, Python version, operating system, a minimal repository or synthetic reproduction, the exact command, and the output with `--json` where available. If the bug involves impact analysis, include `blind_spots`.

Security issues go through [SECURITY.md](SECURITY.md), not the issue tracker.

## Code of conduct

Be direct about code and respectful to people. Harassment, discrimination and disclosure of private information are not acceptable. Maintainers may remove comments or contributions that violate this standard.

# Status report

**Date:** 2026-10-27
**Version:** 0.1.0 alpha
**Repository:** `/home/darion-dev/repograph` — published source at `https://github.com/INDEX0-RESEARCH-LABS/repograph` (no release, package publication or announcement)

## Bottom line

RepoGraph is a working local tool: it indexes real Python/TypeScript/JavaScript repositories, exposes a CLI and six MCP tools, and produces evidence-backed impact reports with explicit blind spots. The engineering baseline is tested, and **edge accuracy is measured**: 100% precision on 150 sampled resolved edges across three unseen repositories, with 94.3% estimated recall for that measured build. A later post-fix recheck resolved 25 of the 29 known misses on the same sample with no regression on previously correct sampled edges; that recheck is not a new recall estimate.

The **product claim is still only partly validated**. There is no user study and no evidence that the tool changes agent behavior. A five-pair agent pilot compared control against a prompt offering the RepoGraph CLI: both arms were perfect on grep-solvable rename tasks, and session transcripts show no treatment run actually invoked the tool, so the pilot measured prompt wording rather than graph access. Missing edges remain the main risk, not wrong ones. The competitive field is crowded, including projects already claiming evidence/confidence and impact analysis.

## Implemented

### Indexing

- Repository scanner with fixed default exclusions, secret-shaped filename exclusions, symlink policy, size cap and file cap.
- tree-sitter extraction for Python, TypeScript, TSX, JavaScript, JSX and Prisma.
- Symbols, imports, references, decorators, HTTP routes, model tags.
- Static import resolution:
  - Python relative/absolute imports and `src` layouts;
  - TypeScript `tsconfig`/`jsconfig` aliases and workspace `package.json` names;
  - CommonJS `require`, dynamic `import()` and syntactic `importlib` calls.
- Incremental SQLite index (size/mtime then SHA-256), WAL, per-file transactions, parse-error retention.
- External, dynamic and unresolved imports kept distinct.

### Query and analysis

- Lexical symbol search and source/documentation text search.
- Definitions and resolved references with confidence/method.
- File dependency graph (`in`/`out`/`both`, depth 1–5).
- Cycle detection via iterative Kosaraju.
- Architecture summary: languages, layers, directories, hubs, entry points, routes, models.
- Impact analysis from paths, a symbol, or git worktree diff:
  - direct dependents (imports + references);
  - transitive dependents with chains;
  - related tests (import + naming rules);
  - affected routes and models;
  - documentation mentions;
  - confidence counts and structured blind spots;
  - caveats that state absence is not safety.
- Path containment for user-supplied impact paths.

### Interfaces

- Typer CLI: `init`, `index`, `status`, `search`, `impact`, `graph`, `refs`, `arch`, `serve`, `version`.
- JSON output for read commands.
- MCP stdio server and optional streamable HTTP (localhost default, no auth).
- Six tools: `search_symbols`, `find_references`, `get_dependency_graph`, `analyze_change_impact`, `find_related_tests`, `get_architecture_summary`.
- `REPOGRAPH_ROOT` support for `python -m repograph.mcp_server`.

### Safety

- Indexing never imports or executes repository code; enforced by a test that would create a marker if executed.
- Symlinks skipped by default; opt-in targets must resolve inside the root.
- Default exclusions cannot be removed by project config.
- Secret-shaped filenames excluded.
- Bound SQL parameters.
- Read-only MCP tools.

## Verification

### Tests

```
56 passed
```

Coverage (direct in-process measurement):

```
TOTAL 2144 statements, 671 missed, 69%
```

The CLI and MCP server show 0% direct coverage because they are tested through subprocesses (`python -m repograph`, stdio MCP client). Their behavior is exercised; the coverage tool does not attribute it to those modules. Core modules: `impact.py` 93%, `indexer.py` 96%, `store.py` 94%, `resolve.py` 90%, `extract.py` 89%.

Reproduce:

```bash
.venv/bin/python -m pytest
.venv/bin/python -m pytest --cov=repograph --cov-report=term-missing
```

### Benchmarks

Measured 2026-10-27, Linux x86_64, Python 3.14.8, one run per repository. Raw JSON in `benchmarks/results/`.

| Repo | Files | Symbols | Internal imports | Parse errors | Cold | Incremental | DB | Impact |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| express | 142 | 63 | 46 | 0 | 0.282 s | 0.082 s | 176 KiB | 2.1 ms |
| click | 91 | 2,077 | 350 | 0 | 0.573 s | 0.056 s | 960 KiB | 18.4 ms |
| requests | 37 | 807 | 130 | 0 | 0.259 s | 0.041 s | 508 KiB | 8.2 ms |
| vue-core | 528 | 2,273 | 1,875 | 2 | 1.791 s | 0.244 s | 1,496 KiB | 22.4 ms |
| fastapi | 1,223 | 7,125 | 1,939 | 0 | 5.257 s | 1.101 s | 4,048 KiB | 82.1 ms |

Impact is the highest-inbound file at depth 2. Express (63 symbols from 142 JS files) and two Vue parse errors are documented weaknesses, not hidden.

Self-index: 21 Python files, 182 symbols, 1,497 refs, 0 parse errors, 0.15 s, 248 KiB.

### Edge accuracy

Pre-registered protocol, two independent AI labelers per round. Final test repositories (flask, vite, svelte) were not used to develop the resolver.

| Repo | Resolved sample | Precision | Recall |
| --- | ---: | ---: | ---: |
| flask | 30 | 100% | 94.9% |
| vite | 60 | 100% | 85.5% |
| svelte | 60 | 100% | 97.6% |
| **overall** | **150** | **100%** | **94.3%** |

- `confirmed` 90/90 and `inferred` 60/60 correct in the final sample.
- Baseline before fixes: 24 false stdlib edges, 96 missed Express root imports, 17 missed `.d.ts` imports, broken `tsconfig` globs, Express recall 32.4%.
- 12 measured defects fixed; 23 labeler disagreements in the final sample, all non-code assets or one conditional-exports fixture.
- Residual recall gaps: JSON/config imports, bundler-virtual specifiers, deep fixture packages, and conditional `exports` beyond the package entry.
- Post-fix recheck: Python project/conftest import roots and Node `#imports`/`exports` maps corrected 25 of the 29 final-test misses with no change to the 150 previously correct sampled edges. Not a new estimate.
- Audit of the new inferred methods (Amendment 2): 38/40 correct, 95.0% (Wilson 83.5%–98.6%). The two wrong edges were type-only `#compiler` imports; the `types` condition is now preferred for `import type`, rechecked within the sample.
- Agent behavior: five paired rename tasks, both arms perfect. Transcripts show 0 of 5 treatment runs invoked RepoGraph and both arms used grep, so the pilot tested prompt wording, not graph access. No behavioral claim. See `research/AGENT_BEHAVIOR_PILOT.md`.

Full method and threats to validity: `research/EDGE_ACCURACY_RESULTS.md`. Raw artifacts: `benchmarks/eval/`.

## Research conclusions

- The agent and MCP ecosystem is large and active.
- The generic code-graph category is saturated; several competitors claim impact analysis, change-aware tests, evidence/confidence, and "every edge explained".
- RepoGraph has **no proven differentiation yet**. The defensible hypothesis remains narrow: auditable impact with explicit uncertainty. Accuracy data now supports the "auditable" part; user value is untested.
- No competitor was installed or benchmarked. All competitor capabilities are claims from GitHub descriptions.

## Documentation and materials

- `README.md` — usage, confidence model, benchmarks, limitations.
- `docs/ARCHITECTURE.md` — modules, schema, indexing, resolution, algorithms.
- `docs/MCP.md` — tool contracts and agent policy.
- `docs/LIMITATIONS.md` — analysis gaps, benchmark caveats, threat model.
- `SECURITY.md`, `CONTRIBUTING.md`, `ROADMAP.md`, `CHANGELOG.md`, `LICENSE`.
- `research/` — evidence, competitive analysis, technical landscape, opportunity analysis, hypotheses, validation plan, decision log, edge-accuracy protocol and results, agent-behavior pilot.
- `benchmarks/` — reproducible script, raw results, method.
- `launch/` — strategy and draft announcement (not published).
- `.github/` — CI, issue templates, PR template.

## Not done

- User interviews, agent task evaluation, willingness-to-pay evidence.
- Closing the measured recall gaps (Python test/example roots, Node `#imports`, JSON/config imports).
- Independent human labeling or adjudication of the accuracy sample.
- Go/Rust/Java/Kotlin support.
- LSP/compiler-backed resolution.
- Call graphs, data flow, type compatibility.
- Semantic search or embeddings.
- Schema migrations.
- GitHub Action/pre-commit integration.
- Watch mode, daemon, editor integration.
- Public release, package publication or announcement (source is on GitHub).
- Windows/macOS testing.

## Known issues and limitations

- Static analysis only; dynamic targets, reflection, DI and external consumers are blind spots.
- CommonJS extraction is weak (Express benchmark).
- Test selection and route/model detection are heuristic.
- Diff analysis uses symbols already in the index; re-index first.
- Measured precision is high but sampled; recall has known gaps. Do not use as a blocking CI gate; re-index and verify before relying on an empty dependent list.
- One machine, one run benchmarks; not tested beyond 1,223 files.
- Coverage report understates CLI/MCP behavior due to subprocess testing.
- `parse_errors` retry behavior: a file with unchanged content and a prior parse error is skipped until content changes or `--force` is used.
- MCP HTTP mode has no authentication.

## Launch readiness

**Ready for an experimental, feedback-seeking release if the maintainer authorizes it.** Not ready for a "complete dependency coverage" or blocking-CI claim.

Done:

1. Edge precision/recall on labeled development and unseen test corpora.
2. Clean wheel install in a fresh virtual environment.
3. Reproducible benchmark results.
4. CI passing on Python 3.10, 3.12 and 3.13 for commit `11b7bb7`.

Still blocking a stronger launch:

1. Agent-behavior evaluation (12 pre-registered tasks, with and without MCP).
2. At least one design partner using it on a real repository.
3. Explicit authorization to publish an announcement or package.

## Reproduce the prototype

```bash
cd /home/darion-dev/repograph
.venv/bin/python -m pytest
.venv/bin/python -m repograph index .
.venv/bin/python -m repograph status .
.venv/bin/python -m repograph impact src/repograph/impact.py --root .
.venv/bin/python -m repograph serve --root .
```

## Next action

Run Phase 2 of `research/VALIDATION_PLAN.md` with tasks that are not word-search-solvable, a treatment that requires the tool's use, and transcript verification that it was used. Token and tool-call counts are recoverable from session exports. The rename-based pilot never invoked the tool and is not sufficient. Before any new accuracy claim, collect a fresh unseen corpus; the post-fix recheck was within-sample. Do not add languages until then.

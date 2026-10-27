# Technical hypothesis

## Core claim

A deterministic tree-sitter + SQLite pipeline can produce **advisory** change-impact analysis that is accurate enough to be useful on small and medium repositories, without a language server, build system, LLM or network.

"Advisory" is part of the claim. The output is not a proof of safety and should not block a merge until precision is measured.

## Supporting observations

Measured on 2026-10-27 with `benchmarks/benchmark.py`:

| Repository | Files | Cold index | Symbols | Internal imports | Parse errors |
| --- | ---: | ---: | ---: | ---: | ---: |
| requests | 37 | 0.26 s | 807 | 130 | 0 |
| click | 91 | 0.57 s | 2,077 | 350 | 0 |
| express | 142 | 0.28 s | 63 | 46 | 0 |
| vue-core | 528 | 1.79 s | 2,273 | 1,875 | 2 |
| fastapi | 1,223 | 5.26 s | 7,125 | 1,939 | 0 |

These establish that the pipeline runs on real code and that query latency is small at this scale (impact ≤ 82 ms, search ≤ 5.4 ms). They do **not** establish edge correctness.

## Falsifiable predictions

| # | Prediction | Threshold | How to falsify |
| --- | --- | --- | --- |
| T1 | Resolved internal import edges are mostly correct | ≥ 95% precision on a hand-labeled sample | Label 200 edges; any lower precision fails |
| T2 | Most internal imports resolve | ≥ 85% recall of static internal imports on Python/TS corpora | Count unresolved edges and inspect them |
| T3 | Impact analysis finds direct dependents that a grep baseline misses | Higher recall than grep at comparable false positives | Run both on the same change tasks |
| T4 | Confidence labels are calibrated | `confirmed` edges have fewer errors than `inferred`, which have fewer than `heuristic` | Error rate per class |
| T5 | Incremental indexing is much cheaper than cold | ≥ 5× faster on a no-op re-index | Benchmark; currently 4.5–6× on measured repos |
| T6 | One parse failure does not corrupt the index | Remaining files still query correctly | Inject malformed files; compare before/after |
| T7 | Dynamic/reflective edges are a material blind spot | At least some real changes would be misclassified without them | Audit changes in dynamic-heavy repos |

T5 is already supported by the benchmark (for example FastAPI: 5.26 s cold vs 1.10 s incremental). T1–T4 are not yet measured.

## Design assumptions

1. **Static imports are the dominant dependency signal** in Python/TS application code. Untested.
2. **File-level edges plus symbol-level references are enough** for an advisory answer. Call graphs and data flow are unnecessary for the first wedge. Untested against user needs.
3. **Lexical symbol search is sufficient** when the agent already knows a name. Semantic search is a different job.
4. **SQLite is adequate** up to the target repository size. The upper bound is unknown; 1,223 files is not a stress test.
5. **A small tool surface is better than many tools** for agent reliability. Six tools is a product choice, not a measured optimum.
6. **Reporting uncertainty is more useful than hiding it.** This is the core product bet, not a technical fact.

## Known failure modes

- **False negatives from unresolved imports.** A file can depend on the target through an edge RepoGraph failed to resolve. Impact under-reports.
- **False positives from name collisions.** Same-file/import binding rules reduce this, but shadowing can still mislead.
- **Re-export chains.** Some `export *` and barrel files stop traversal early.
- **CommonJS extraction.** Express is the evidence: 63 symbols from 142 files.
- **Test selection.** Import-based tests may miss integration/e2e tests; naming rules may add irrelevant tests.
- **Route/model heuristics.** Framework-specific patterns produce both false positives and negatives.
- **Stale index.** Diff analysis maps to indexed symbols. Without re-indexing, new symbols are absent.
- **Parser drift.** Grammar updates or language features can change extraction without a schema change.

## Why not LLM-assisted resolution?

An LLM could guess unresolved imports, but it would:

- add a network/key dependency;
- make results non-deterministic;
- blur evidence with speculation;
- invite prompt injection from repository text.

If added later, LLM guesses must be a separate, clearly labeled class and never mixed with static evidence.

## Why not a language server first?

Precision would improve, but the operational surface (per-language installs, build configs, long-running processes) conflicts with the local-first, auditable wedge. A future LSP backend can implement the same evidence schema.

## Success condition

The technical hypothesis is supported if:

1. T1 and T2 pass on a labeled Python/TS corpus.
2. T4 shows ordered error rates across confidence classes.
3. An agent task evaluation shows benefit without unacceptable context cost.
4. No security regression in the non-execution and path-containment tests.

If T1 fails, do not market impact analysis as trustworthy, even as an advisory. Fix resolution or narrow the claim to "import graph with caveats."

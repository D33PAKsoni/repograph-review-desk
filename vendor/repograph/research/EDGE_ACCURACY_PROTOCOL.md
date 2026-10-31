# Edge accuracy protocol (pre-registered)

**Date fixed before labeling:** 2026-10-27
**Sample seed:** `20261027`
**Tool:** `benchmarks/edge_accuracy.py`

This protocol is written before any label is assigned. Changing it after seeing results must be recorded in `DECISION_LOG.md`.

## Question

Are RepoGraph's import edges correct, and what fraction of statically resolvable internal imports does it find?

## Corpora

| Name | Repository | Why |
| --- | --- | --- |
| fastapi | `fastapi/fastapi` (Python, src layout) | Large Python, relative and absolute imports, many tests |
| vue-core | `vuejs/core` (TypeScript monorepo) | Workspace packages and path aliases |
| express | `expressjs/express` (CommonJS JavaScript) | Known weak extraction; tests the failure mode |

Clones are shallow in `/tmp/opencode/repograph-bench/`. Each repository was indexed by RepoGraph 0.1.0. The sample records the index rows, not a re-derived graph.

## Sampling

- **Resolved edges:** all `imports` rows with `kind='internal'` and a target file. Stratified by repository and confidence (`confirmed`, `inferred`) with up to 30 per stratum. This oversamples rare `inferred` edges; metrics use stratum weights.
- **Unresolved imports:** up to 30 per repository, random.
- **External imports:** up to 20 per repository, random. This catches internal imports wrongly classified as external.
- Sampling is random within stratum using Python `random.Random(20261027)` after sorting by row id.
- The sample file is immutable. Labelers copy it.

Expected sample size: ≤ 180 resolved + 90 unresolved + 60 external = ≤ 330.

## Label rubric

Each row contains `file`, `line`, `source` (source text), `module`, `names`, `target` (for resolved rows), `confidence`, `method`.

### Rows with a target (resolved)

- **`correct`** — the import at `file:line` refers to the repository file `target`, and the imported names are consistent with that file.
- **`wrong_target`** — the import is internal, but `target` is not the file the import refers to.
- **`not_internal`** — the import refers to an external package, standard library, or generated/virtual module, so it should not have an internal target.
- **`uncertain`** — the evidence is insufficient (ambiguous alias, generated target, unreadable file). Explain in `note`.

### Rows without a target (unresolved / external)

- **`internal_missed`** — a repository file clearly implements this import, but RepoGraph did not resolve it. Name the expected file in `note`.
- **`external_ok`** — an external package or standard-library import, correctly not internal.
- **`unresolved_ok`** — internal-looking, but not statically resolvable without runtime/build information (namespace package, generated module, conditional). Explain.
- **`uncertain`** — insufficient evidence.

Rule: a false internal target is worse than a miss for a trust tool, but both are recorded. Do not mark `correct` merely because the target file exists.

## Blinding

- Two labelers work independently from the same sample file and this rubric.
- Labelers must not read `src/repograph/resolve.py`, `src/repograph/extract.py`, or each other's labels.
- Labelers may read the repository files and `tsconfig`/`package.json`/`pyproject.toml`.
- The adjudicator resolves disagreements without knowing which labeler produced which file until after adjudication.
- Both labelers are AI agents in this run. This reduces single-pass bias but is not equivalent to independent human review. State this limitation in the report.

## Metrics

For rows with targets:

```
precision = correct / (correct + wrong_target + not_internal)
precision_conservative = correct / (correct + wrong_target + not_internal + uncertain)
```

For recall, the denominator is resolved-correct internal edges plus missed internal edges:

```
recall = correct / (correct + internal_missed)
```

`unresolved_ok` and `external_ok` are excluded from recall because they are not statically resolvable or not internal. `internal_missed` from both unresolved and external samples is included.

All counts are weighted by `stratum_size / sample_size_in_stratum`, so oversampling rare confidence classes does not bias the overall estimate. Unweighted precision and per-repo/per-confidence metrics are reported as diagnostics.

Agreement is `1 - disagreements / sample_size`. Disagreements become `uncertain` in the headline metrics and are reported item by item. A second report may use adjudicated labels.

## Decision thresholds

| Result | Interpretation |
| --- | --- |
| Precision ≥ 95%, recall ≥ 85% | Supports advisory impact analysis; proceed to agent/user validation |
| Precision 90–95% | Advisory only; fix top error causes before a launch |
| Precision < 90% | Do not market as reliable; fix resolution or narrow the claim |
| Recall < 70% | Impact analysis may miss many dependents even if precise |

Confidence calibration is supported if error rates are ordered `confirmed < inferred`. If not, the labels are not calibrated and the README must say so.

## Known limitations

- Three repositories, not a random sample of all code.
- One run per repository; resolver version is 0.1.0.
- Labelers see the resolver's `target` and `method`, which can anchor them. The rubric asks them to verify independently, but anchoring cannot be eliminated.
- Sample is only 330 rows; confidence intervals will be wide.
- No human adjudication in this run.

## Artifacts

- `benchmarks/eval/sample.jsonl` — immutable sample.
- `benchmarks/eval/sample.meta.json` — seed and stratum populations.
- `benchmarks/eval/labels-*.jsonl` — independent labels.
- `benchmarks/eval/report.json` — metrics and disagreements.
- `research/EDGE_ACCURACY_RESULTS.md` — human-readable results, including failures.

## Amendment 1 — Development rounds and an unseen test (2026-10-27)

Added after the baseline labels exposed defects, without changing the rubric, thresholds or weighting.

1. **Baseline** (294 rows) measured the pre-fix resolver on fastapi, vue-core, express.
2. **dev2** re-sampled the same three repositories after the first fixes.
3. **devhold** sampled requests, axios and zod to search for defects on repositories not used for the first fixes. It stopped being a holdout once its labels were used to fix defects; it is reported as a development set, not as test evidence.
4. **final test** sampled flask, vite and svelte. These repositories were cloned, indexed and sampled *after* the last code change, with the same seed and settings. Their unresolved imports were not inspected before labeling. They are the only results used for the accuracy claim.

Weights, labels, disagreement handling and thresholds are unchanged. The final test is reported per repository as well as pooled; a pooled pass does not excuse a repository-level failure.

Known protocol deviations:

- No human adjudication exists. Disagreements remain `uncertain`.
- `report-postfix.json` is an intermediate round from a superseded build and is excluded from claims.
- The final test was chosen deliberately (one Python app, one TypeScript monorepo, one JS/TS compiler), not sampled from all GitHub repositories.

## Amendment 2 — Post-fix recheck and targeted precision audit (2026-10-27)

Added after four resolver changes fixed 25 of the 29 agreed final-test misses.
The final-test recall estimate (94.3%) is **not** replaced: the recheck is
within-sample and cannot support a new estimate.

1. **Recheck.** Every agreed miss in the final test was re-resolved through the
   production index path, and every previously labeled resolved row was checked
   for a changed target. Reported as a count, not as precision or recall.
2. **Precision audit.** The four changes add edges whose method did not exist in
   the measured build. All 241 such edges were pooled across flask, svelte and
   vite (the same development corpora). A deterministic random sample of 40
   (seed `20261027`, `benchmarks/edge_accuracy.py`-style records) is labeled by
   two independent AI labelers under the unchanged rubric.
3. **Metric.** Unweighted precision with a Wilson 95% interval. This is a QA
   audit of new code paths, not a population estimate, and it is not combined
   with the final-test precision.

**Decision rule, fixed before labeling:** the new inferred methods ship by
default only if at least 38 of 40 sampled edges are `correct` (unweighted
precision ≥95%). If 3 or more are wrong or not-internal, the offending method is
restricted or removed and the recheck is rerun. `uncertain` labels are excluded
from the numerator but reported.

Sampling code: a one-off query over `imports` where `method IN
('python-project-root','python-syspath-root','package-imports-map')`, materialized
as `benchmarks/eval/sample-audit-newmethods.jsonl`.

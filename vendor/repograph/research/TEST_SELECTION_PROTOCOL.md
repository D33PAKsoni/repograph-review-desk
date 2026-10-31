# Test-selection validation protocol

**Pre-registered:** 2026-10-28, before any mutation was applied.
**Question:** When a real change breaks tests, does `find_related_tests` name the
test files that actually fail?

This is a different question from the agent pilot. It measures whether the tool's
test-discovery output is correct against runtime evidence, not whether an agent
chooses to use it.

## Why this design

The edge-accuracy work measured the graph. The agent pilot could not measure the
product because the tool was never invoked. This protocol measures a user-facing
output — "which tests are related to this symbol" — against an independent,
executable ground truth. No LLM and no agent sits in the loop, so the result is
reproducible and has no ceiling effect from agent competence.

## Corpus

- `pallets/flask` at `d086db8`, pristine clone.
- Python 3.14, `pytest` 9.2.0, Flask installed editable into a dedicated venv.
- Baseline: **494 tests pass** in about 3.5 s.

## Unit of analysis

One **mutation**: delete the body of one top-level symbol from `src/flask/**`
and leave `tests/` untouched. Deletion stands in for a rename, move or removal:
any test that imports or exercises the symbol fails.

## Candidate pool (fixed before selection)

Top-level `def`, `async def` and `class` statements in `src/flask/**` that:

1. do not start with `_`;
2. appear at least twice in `src/` (definition plus at least one other use), so a
   real internal dependency exists;
3. are not dunder names.

The pool is **not** filtered by whether a test imports the symbol. Filtering that
way would select the cases where the tool's simplest rule must fire and inflate
recall.

## Selection

Sort the pool by `(module, name)` and draw **K = 12** with seed `20261028`.
The list is recorded before mutation.

## Prediction (tool)

On a pristine index (`repograph index`, then `repograph impact --root <clone>
--symbol <name> --json`), take `related_tests[].path`. Record `direct` and
`transitive` counts for context. Ambiguity or error is recorded as
`tool_unresolved`, not retried with a different name.

## Ground truth (execution)

Apply the mutation, run
`pytest -q -p no:cacheprovider --tb=no --continue-on-collection-errors -rf`,
collect every test **file** containing at least one `FAILED` or `ERROR` node,
then restore the tree with `git checkout -- .`.

## Arms

### Arm A — deletion (design abandoned, results reported)

Delete the top-level symbol; tests untouched. Applied to all 12 selected symbols.

Outcome: **9 of 12 deletions broke `import flask`** (the package re-exports most
names and some annotations evaluate at import time), so pytest could not start
(`rc=4`, conftest import error). Those cells have no per-test ground truth. Only
3 mutations left the package importable and the suite runnable.

Arm A therefore measures **package-import breakage**, not test selection. Its
results are reported separately, not pooled, and they do not carry the recall
claim. The aborted cells are listed with the number of test files the tool
predicted; no "all tests failed" denominator is invented.

### Arm B — behaviour mutation (the measurement)

For each selected symbol, change the **first literal constant** in its body:

- `str` → the same string with `XX` appended;
- `int`/`float` → value ± 1 (sign follows the value, `0` becomes `1`);
- docstrings, `bool`, `None` and f-strings are skipped;
- if no eligible literal exists, the symbol is recorded as `not_mutable` and
  excluded from the recall denominator (count reported).

Imports stay valid, so the suite runs and individual tests fail. Ground truth is
the set of test files with a failing node. This is the signature/behaviour-change
family the agent pilot lacked, and it removes the import-abort confound.

Mutation is applied to exactly one source span and the tree is restored with
`git checkout -- .` after each run.

## Metrics

File level, because the tool returns files.

- **recall** = |predicted ∩ failed| / |failed|
- **precision** = |predicted ∩ failed| / |predicted|
- pooled micro-average over mutations with at least one failing file.

Two prediction sets are reported, fixed before any mutation ran:

1. **primary** — `related_tests[].path`, the dedicated output a user reads for
   "which tests are related".
2. **secondary** — the union of the primary set with any test file appearing in
   `direct_dependents` or `transitive_dependents`. This separates a weak test
   ranking from a graph that cannot see the impact at all.

### Setup observation (declared before the run)

Running `--symbol` on the pristine tree showed two behaviours that the mutation
run must therefore measure, not avoid:

- three of the twelve names (`Flask`, `Blueprint`, `View`) are **ambiguous**
  because test modules define same-named nested classes; the command returns an
  error rather than a prediction;
- `--symbol` scopes to the defining **file**: `target.symbols` lists every
  symbol in that file with `changed_by_hunk: true`.

No resolver or impact code was changed after seeing this. The as-shipped
behaviour is what gets measured.

Mutations with **zero** failing files are reported as `unobserved` and excluded
from the recall denominator; their predicted-file count is reported separately,
because a prediction with no observed failure is neither confirmed nor refuted.

## Fixed interpretation rule

- **Supported for test selection:** pooled recall ≥ 0.80 and median recall ≥ 0.75.
  In that case launch copy may say the tool "usually names the test files a change
  affects", quoting the measured counts.
- **Not supported:** any lower recall, or a result dominated by a few mutations.
  Then the docs must say test selection is heuristic and must be verified by
  running the suite.

Precision has no pass gate: a predicted test file that does not fail can still be
relevant. Precision is reported as a lower bound on relevance, with the
predicted-but-passed files listed.

## Exclusions and reporting rules

- A mutation that fails the baseline suite is a harness error and is excluded.
- A mutation that changes the tool's index is impossible: prediction is computed
  on the pristine tree before the mutation.
- If the run exposes a defect, it is **not** fixed inside this result. The fix is
  a separate post-hoc change, reported with a within-sample recheck, exactly as
  in Amendment 2 of the edge-accuracy protocol.
- The sample is 12 mutations in one Python repository. It does not generalise to
  TypeScript or to other projects; it is the first measured result for this
  capability, not a population estimate.

Artifacts: `benchmarks/test_selection/` (selected symbols, tool predictions,
pytest outcomes, restore log).

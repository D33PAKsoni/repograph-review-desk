# Test-selection results

**Run:** 2026-10-28. Protocol: `TEST_SELECTION_PROTOCOL.md` (pre-registered, with
both arms declared before the mutations ran).
**Corpus:** `pallets/flask` at `d086db8`; 494 tests pass in ~3.5 s.
**Question:** when a real change breaks tests, does `find_related_tests` name the
test files that actually fail?

## Headline

| Metric | Result |
| --- | ---: |
| Mutations selected | 12 |
| Mutations that changed behaviour and ran | 10 |
| Mutations with at least one failing test | 6 |
| **Pooled file recall** | **6/25 = 24.0%** |
| Median per-mutation recall | 0.57 |
| Pooled file precision | 6/36 = 16.7% |
| Recall if transitive test files are counted | 15/25 = 60.0% |

The pre-registered bar for a test-selection claim was pooled recall ≥ 0.80 and
median ≥ 0.75. **It is not met.** The documented statement must therefore be:
test selection is heuristic, it can omit tests that a change breaks, and the
suite must be run to confirm.

## Arm A — deletion (abandoned design, reported)

Deleting a top-level symbol was the original unit. **9 of 12 deletions broke
`import flask`**, so pytest could not start at all (`rc=4`, conftest import
error). This measures package-import breakage, not test selection, and the
cells have no per-test ground truth.

| Symbol | Package imports after deletion | Tool's related-test files |
| --- | --- | ---: |
| `Flask` | no | 0 (ambiguous name) |
| `AppGroup` | no | 4 |
| `CertParamType` | no | 4 |
| `get_load_dotenv` | no | 13 |
| `Blueprint` | no | 0 (ambiguous name) |
| `SecureCookieSession` | no | 4 |
| `SessionInterface` | no | 4 |
| `Environment` | no | 11 |
| `Request` | no | 12 |
| `prepare_import` | yes | 4 |
| `DebugFilesKeyError` | yes | 3 |
| `View` | yes | 0 (ambiguous name) |

No "all tests failed" denominator is invented for the nine unrunnable cells; they
are excluded from recall and kept here as evidence that the design was wrong for
this corpus.

## Arm B — behaviour mutation

Each mutation changes one literal constant inside the symbol, leaving imports
valid. The full table, with the tool's prediction fixed before mutation:

| Symbol | Mutation | Failed test files | Predicted | Hit | Recall |
| --- | --- | ---: | ---: | ---: | ---: |
| `prepare_import` | `'.py'` → `'.pyXX'` | 1 | 4 | 1 | 1.00 |
| `DebugFilesKeyError` | message text | 2 | 3 | 2 | 1.00 |
| `get_load_dotenv` | `FLASK_SKIP_DOTENV` | 1 | 13 | 1 | 1.00 |
| `Blueprint` | `'.'` → `'.XX'` | 1 | 0 | 0 | 0.00 |
| `SessionInterface` | `SESSION_COOKIE_NAME` | **15** | 4 | 2 | **0.13** |
| `Request` | `MAX_CONTENT_LENGTH` | 5 | 12 | 0 | **0.00** |
| `Flask` | `'DEBUG'` | 0 | 0 | — | unobserved |
| `AppGroup` | `'with_appcontext'` | 0 | 4 | — | unobserved |
| `CertParamType` | `'path'` | 0 | 4 | — | unobserved |
| `Environment` | `'loader'` | 0 | 11 | — | unobserved |
| `SecureCookieSession`, `View` | no eligible literal | — | — | — | not mutable |

The four `unobserved` mutations are not treated as successes or failures: the
changed constant was not observable through the suite, so the tool's predictions
for them are neither confirmed nor refuted.

## What the misses are

**1. Test selection follows direct imports only.** When a change breaks tests
through an intermediate module, `related_tests` misses them:

- `Request` (`wrappers.py`): 12 predicted test files, **none** of the 5 files
  that failed. All 5 are reachable from `wrappers.py` through
  `flask/__init__.py` and `app.py`, so the graph knows the path; the test rule
  does not use it.
- `SessionInterface` (`sessions.py`): 15 files failed, 2 predicted. Counting the
  test files that appear in `direct_dependents`/`transitive_dependents` raises
  the hit count to 6 of 15, and the default traversal depth (2) is why the rest
  stay invisible: most tests reach `sessions.py` at depth 3.

**2. `--symbol` cannot resolve a name that tests reuse.** `Flask`, `Blueprint`
and `View` are defined in `src/`, but test modules define same-named nested
classes. `--symbol Blueprint` returns `ambiguous symbol` instead of a prediction.
The lookup matches `qualified_name` or bare `name`, and nested test symbols carry
qualified names like `test_config.Flask` that still match the bare name.

**3. `--symbol` analyses the whole file.** `target.symbols` lists every symbol in
the defining file with `changed_by_hunk: true`, so `AppGroup`, `CertParamType`
and `prepare_import` (all in `cli.py`) receive identical predictions. The
command's help says "Analyze a symbol instead of files"; in this build it does
not.

## Precision

Precision was 6/36 (16.7%). A predicted test file that still passes is not
necessarily irrelevant — it may import the changed module without exercising the
changed behaviour (`get_load_dotenv` predicts 13 files and 1 fails). Precision is
reported as a lower bound on relevance, not as a defect count. The defect that
matters for users is the **missed** files, because those are the ones an agent
would not know to run.

## Threats to validity

- **Six usable mutations in one repository.** This is a first measurement, not a
  population estimate. Flask's structure (package re-export from `__init__`,
  many tests importing the package rather than modules) makes the transitive
  case common; another project could score differently.
- **Mutation choice.** One constant per symbol, deterministic but arbitrary. Some
  constants are not observable through the suite (4 of 10), which is why the
  usable sample is small.
- **File-level comparison.** The tool returns files; a file counts as hit if any
  test in it fails. Node-level recall would be lower.
- **No agent.** This measures the correctness of test discovery, not whether an
  agent uses it.
- **Ambiguity is a lookup defect, not a test-selection result.** `Blueprint`
  scores 0 recall because no prediction was produced. It is counted in the
  pooled number to avoid hiding the failure.

## Decision

- Do **not** claim that `find_related_tests` reliably finds the tests a change
  affects. The measured numbers say the opposite for this corpus.
- Docs and MCP tool descriptions must state that test selection is heuristic and
  that the suite is the ground truth.
- Two defects are now measured and have clear fixes: symbol-name disambiguation
  (prefer a top-level definition) and transitive test reachability (include test
  files reached through dependents). Both must be fixed and rechecked
  **outside** this result, then measured again on a fresh sample.
- The edge-accuracy claims are unaffected: this run did not test the graph's
  import edges, only the test-selection heuristic built on them.

Artifacts: `benchmarks/test_selection/` — `selected.json` (pool and draw),
`predictions.json` (tool output before mutation), `mutations.json` (Arm A),
`mutations_behaviour.json` (Arm B), `score.json` (per-cell and pooled metrics).

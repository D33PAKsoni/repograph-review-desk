# Affected-tests gate: measured result

**Run:** 2026-10-31
**Protocol:** `TEST_SELECTION_PROTOCOL.md` (pre-registered 2026-10-28)
**Kill criteria:** `BRUTAL_REVIEW.md` §6
**Harness:** `benchmarks/test_selection/gate_measure.py`
**Raw data:** `benchmarks/test_selection/gate-{click,flask,packaging}.json`

## Question

When a real change breaks real tests, does `repograph tests` name the test files
that actually fail — and does it do so without running most of the suite?

Two prediction sets, fixed before the run:

- **direct** — what `repograph tests` returns as `run`.
- **closure** — `run` ∪ every test file the tool discloses as reachable through
  a dependent module but not selected. With the 2026-10-31 change this list is
  printed as `reachable but not selected`, so it is what a careful reader would
  actually run.

The closure arm is not a product change; it is the upper bound of the tool's own
disclosure.

## Method

One top-level function per sample: its body is replaced with
`raise RuntimeError("repograph mutation")`, the real suite runs under pytest with
`--junitxml`, then the file is restored. Failing test files are read from the
JUnit report (paths derived from `classname` where pytest leaves `file` empty).
Files that already fail on the pristine tree are removed from the denominator.

Predictions are computed on the pristine index, as a developer would ask them
from a diff.

- **Corpora:** `pallets/click` (`src/click`, `2247b35`), `pallets/flask`
  (`src/flask`, `49943b5`), `pypa/packaging` (`src/packaging`, `78d8673`), each
  cloned fresh, suite green before mutating.
- **Sample:** 10 / 10 / 6 functions spread evenly over the package's top-level
  functions.
- **Excluded:** a mutation whose suite cannot run (`rc` 2–4) is `unusable`; a
  mutation that breaks nothing observable is `unobserved` and stays out of the
  recall denominator.
- **Scored:** 22 mutations, 180 failing test files.

The baseline suites, for reference: click 2,287 tests in 8.5 s; flask 494 tests
in 2.1 s; packaging 63,413 tests in 76 s.

## Result

| Metric | direct | closure |
| --- | ---: | ---: |
| Measured mutations | 22 | 22 |
| Unusable / unobserved | 3 / 1 | 3 / 1 |
| Failing test files | 180 | 180 |
| **Pooled file recall** | **41/180 = 0.2278** | **179/180 = 0.9944** |
| **Median per-mutation recall** | **0.381** | **1.0** |
| Pooled precision | 41/69 = 0.5942 | 179/737 = 0.2429 |
| **Median selection fraction** | **6.67%** of test files | **98.87%** of test files |

Per mutation:

| corpus | mutated function | failing files | direct recall | direct sel. | closure recall | closure sel. |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| click | `is_ascii_encoding` | 21 | 0.38 | 9 | 1.00 | 44 |
| click | `get_text_stdout` | 21 | 0.38 | 9 | 1.00 | 44 |
| click | `augment_usage_errors` | 20 | 0.20 | 6 | 1.00 | 43 |
| click | `command` | 21 | 0.05 | 1 | 1.00 | 43 |
| click | `version_option` | 1 | 0.00 | 1 | 1.00 | 43 |
| click | `get_current_context` | 29 | 0.03 | 1 | 0.97 | 43 |
| click | `get_completion_class` | 1 | 1.00 | 3 | 1.00 | 43 |
| click | `echo_via_pager` | 3 | 0.67 | 2 | 1.00 | 43 |
| click | `edit` | 1 | 1.00 | 2 | 1.00 | 43 |
| flask | `prepare_import` | 1 | 1.00 | 3 | 1.00 | 30 |
| flask | `show_server_banner` | 2 | 0.00 | 3 | 1.00 | 30 |
| flask | `after_this_request` | 1 | 0.00 | 1 | 1.00 | 30 |
| flask | `explain_template_loading_attempts` | 1 | 1.00 | 2 | 1.00 | 30 |
| flask | `url_for` | 8 | 0.25 | 4 | 1.00 | 30 |
| flask | `flash` | 2 | 0.00 | 4 | 1.00 | 30 |
| flask | `dumps` | 16 | 0.12 | 2 | 1.00 | 30 |
| flask | `jsonify` | 4 | 0.50 | 2 | 1.00 | 30 |
| flask | `find_package` | 21 | 0.10 | 2 | 1.00 | 30 |
| packaging | `platform_tags` | 2 | 0.50 | 2 | 1.00 | 26 |
| packaging | `is_valid_pylock_path` | 1 | 1.00 | 2 | 1.00 | 2 |
| packaging | `ios_platforms` | 1 | 1.00 | 4 | 1.00 | 25 |
| packaging | `create_compatible_tags_selector` | 2 | 1.00 | 4 | 1.00 | 25 |

Excluded: 1 click mutation whose suite could not run, 2 packaging mutations
likewise, 1 flask mutation that broke nothing observable.

## Verdict against the pre-registered bar

The bar: **pooled recall ≥ 0.80 and median recall ≥ 0.75**, fixed before any
mutation ran.

- **direct: 0.2278 pooled / 0.381 median. Not supported.** Misses more than
  three quarters of the test files a change actually breaks.
- **closure: 0.9944 pooled / 1.0 median.** Recall is met, but it is met by
  running **98.9%** of the test files. Recall of ~1.0 while selecting ~all of
  the suite is a full-suite run with extra steps, not a gate.

Against the §6 kill criteria:

| Criterion | Threshold | Measured | State |
| --- | --- | --- | --- |
| Recall | selected set contains the failing test ≥95% (floor 90%) | direct misses 139/180 = 77.2% of failing files; closure misses 1/180 | direct **fails**, closure passes |
| Cost | median selected runtime ≤25% of full suite | median 6.7% of files selected (direct) vs 98.9% (closure) | direct passes, closure **fails** |
| Undetermined | ≤20% of all tests | 0 entries in these runs (no parse errors, no unresolved internal imports in the sample) | passes |
| Adoption | 3 of 10 cold users run it twice | not measured | unmeasured |

No single operating point satisfies recall and cost at once. The two arms are
the two ends of one dial, and both ends are wrong.

Two honest qualifications:

1. **This is not the per-PR measurement §6 describes.** It is per-mutation,
   file-level, with one function body replaced at a time. A real PR touching
   several files would move both arms toward more selection, so the direct arm
   would likely improve somewhat. It would not close a 0.23 → 0.95 gap.
2. **`packaging` is the one corpus where direct selection works** (0.833, 5/6,
   selecting 6–13%). That is 4 mutations and 6 failing files on a package whose
   tests are mostly independent unit tests. It is a hypothesis for a follow-up,
   not a result: the same tool on click and flask selects 6.7% and misses 77.2%.

Runtime was not timed for the selected subsets; test files differ in cost, so
file share is a proxy for the cost criterion, not the criterion itself. The
conclusion does not depend on the proxy: 43 of 44 click test files is the suite.

## What this means

Static import-graph test selection at file level is **not viable as a gate** on
these corpora. The graph knows which modules a test imports; it does not know
which tests exercise which behaviour. `tests/test_complex.py` imports
`click.core` and fails when `command()` is gutted; `tests/test_commands.py`
imports it too and does not. No import edge encodes that difference.

The measured, defensible statement is the one the protocol fixed in advance:

> Test selection is heuristic. It can omit test files that a change breaks, and
> the suite must be run to confirm.

That sentence is now in the README next to the feature.

What the tool is actually good at is the honest half of the output: it names
37 of 44 click test files as reachable-but-unselected rather than hiding them.
That is a complete disclosure with no runtime saving. It is worth keeping
because it is true; it is not worth marketing as a gate.

## Disclosed asymmetry worth recording

Before this run the disclosure existed only in `analyze_impact`'s `blind_spots`,
not in `repograph tests`' own output. The gate therefore printed
`run these (6, 14% of 44)` and said nothing about the other 37 files. Measuring
found that; `select()` now returns `reachable_not_selected` and the CLI prints
it. The tool no longer hides the gap it cannot close.

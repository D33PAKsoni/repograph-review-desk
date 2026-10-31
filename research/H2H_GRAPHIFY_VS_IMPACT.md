# Head-to-head: `graphify affected` vs `repograph impact`

**Run:** 2026-10-31
**Question:** on the same changes, with the same ground truth, does Graphify's blast radius
catch the test files that actually fail — and does it say what it missed?
**Answer:** at matched maximum depth the two are close on pooled recall (0.71 vs 0.70 on bare
names; 0.99 vs 0.88 when the seed is the changed file). The difference is not recall. It is
cost and silence: ours names more of the suite and discloses almost every miss; theirs names
less and discloses none.

## Provenance

- Graphify: `graphifyy` **0.9.99** from PyPI, code-only extraction (`extract --code-only
  --no-cluster`), the same CLI a user gets from `uv tool install graphifyy`.
- RepoGraph: **0.1.2** (PyPI artifact, same wheel verified in `STATUS.md`).
- Corpora: the gate study's trees, re-cloned at the pinned commits —
  `pallets/click@2247b35`, `pallets/flask@49943b5`, `pypa/packaging@78d8673`.
- Ground truth: `benchmarks/test_selection/gate-{click,flask,packaging}.json` — 22 measured
  mutations, 180 failing test files, produced earlier by running the real suites under
  mutation. **No test suite was run for this study.**
- Raw per-run output: `research/evidence/h2h-affected.json`. Harness:
  `benchmarks/test_selection/h2h_measure.py`.

Transparency: two invocations of each tool were run before this protocol was frozen, only to
learn the CLI's output shape (`is_ascii_encoding`, `src/click/decorators.py`). They are not
scored; the scored runs were executed once, after the arms below were declared.

## Arms

Both tools answer on the pristine tree before a diff, seeded with the mutated function.

| Arm | Tool | Seed | Depth |
| --- | --- | --- | --- |
| G2 / G5 / G10 | graphify | function name | 2 / 5 / 10 |
| GF / GF10 | graphify | changed file path | 5 / 10 |
| R2 / R5 | repograph | `--symbol` name | 2 / 5 (our maximum) |
| RF | repograph | changed file path | 5 (our maximum) |

`GF` and `RF` exist because four bare names are ambiguous; both tools refuse them at the name
seed (graphify: "No unique node match", ours: `ambiguous symbol` plus candidates). The file
seed is what a user does next, applied to all 22 mutations rather than only the refusals so the
arm is not selected after seeing results.

Depth 10 was added for graphify after the depth-5 run because it has no depth cap while ours
stops at 5; it changed pooled recall by two files (128 → 130).

## Metrics

A failing test file counts as **caught** if its path appears anywhere in the tool's output for
that mutation. **Cost** is the median share of the repository's test files that the output
names. A **silent miss** is a failing file that was not caught and was not named in any
disclosure field. A **refusal** is an explicit no-answer (ambiguous seed), which is not the same
as claiming nothing is affected.

## Result

| Arm | Caught / 180 | Pooled recall | Median recall | Median test-file cost | Refusals | Silent misses |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| G2 (graphify, name, d2) | 42 | 0.233 | 0.000 | 0.000 | 3 | 114 |
| G5 (graphify, name, d5) | 128 | 0.711 | 0.787 | 0.354 | 3 | 28 |
| G10 (graphify, name, d10) | 130 | 0.722 | 0.787 | 0.366 | 3 | 26 |
| **GF** (graphify, file, d5) | **158** | **0.878** | 1.000 | 0.743 | 0 | **22** |
| R2 (repograph, name, d2) | 84 | 0.467 | 0.975 | 0.195 | 5 | 0 (42 misses disclosed) |
| R5 (repograph, name, d5) | 126 | 0.700 | 1.000 | 0.902 | 5 | 0 |
| **RF** (repograph, file, d5) | **179** | **0.994** | 1.000 | 0.902 | 0 | **1** |

Per repository, best arms:

| Corpus | GF | RF |
| --- | ---: | ---: |
| click | 117/118 = 0.992 | 117/118 = 0.992 |
| flask | 35/56 = 0.625 | 56/56 = 1.000 |
| packaging | 6/6 = 1.000 | 6/6 = 1.000 |

The entire advantage in the file-seed arm is Flask: 21 failing files across `url_for`, `dumps`
and `find_package` that graphify's reverse traversal does not reach, and that our
test-naming/import disclosure does.

## Per mutation

| Repo | Mutation | Failing | G5 | GF | R5 | RF |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| click | `is_ascii_encoding` | 21 | 20 | 21 | 21 | 21 |
| click | `get_text_stdout` | 21 | 21 | 21 | 21 | 21 |
| click | `augment_usage_errors` | 20 | 19 | 20 | 20 | 20 |
| click | `command` | 21 | 0 | 21 | 0 | 21 |
| click | `version_option` | 1 | 1 | 1 | 1 | 1 |
| click | `get_current_context` | 29 | 28 | 28 | 0 | 28 |
| click | `get_completion_class` | 1 | 1 | 1 | 0 | 1 |
| click | `echo_via_pager` | 3 | 3 | 3 | 3 | 3 |
| click | `edit` | 1 | 0 | 1 | 0 | 1 |
| flask | `prepare_import` | 1 | 1 | 1 | 1 | 1 |
| flask | `show_server_banner` | 2 | 0 | 1 | 2 | 2 |
| flask | `after_this_request` | 1 | 1 | 1 | 1 | 1 |
| flask | `explain_template_loading_attempts` | 1 | 0 | 0 | 1 | 1 |
| flask | `url_for` | 8 | 5 | 5 | 8 | 8 |
| flask | `flash` | 2 | 1 | 1 | 2 | 2 |
| flask | `dumps` | 16 | 9 | 10 | 16 | 16 |
| flask | `jsonify` | 4 | 4 | 4 | 4 | 4 |
| flask | `find_package` | 21 | 12 | 12 | 21 | 21 |
| packaging | `platform_tags` | 2 | 0 | 2 | 0 | 2 |
| packaging | `is_valid_pylock_path` | 1 | 1 | 1 | 1 | 1 |
| packaging | `ios_platforms` | 1 | 0 | 1 | 1 | 1 |
| packaging | `create_compatible_tags_selector` | 2 | 1 | 2 | 2 | 2 |

## What this supports, and what it does not

**Supported.** On this corpus and interface, RepoGraph's file-seeded impact names more of the
failing test files than graphify's `affected` (179/180 vs 158/180) and leaves one undisclosed
miss against graphify's 22. The "we tell you what we could not see" claim has a number, and the
number is not zero — ours missed `tests/test_imports.py` for `get_current_context` without
listing it in `blind_spots`.

**Not supported.** "Ours is more precise." It is not: RF names a median 90% of the test files
against graphify's 74%, and R2 — our most selective arm — catches less than half the failing
files. The gate study's conclusion still holds: this is disclosure, not selection. Graphify is
also cheaper in context on the best-recall arm, which matters for the token argument it sells.

**Not measured.** Answer quality, ranking, whether an agent acts correctly on either output,
Graphify's semantic (LLM) path, other languages, repositories where our resolver is weak, and
Graphify Cloud. One version of each tool, three repositories, 22 mutations, one run each. The
ground truth was produced against the same commits but not re-verified for this study.

**Fairness caveats.** Our `related_tests` uses naming conventions in addition to imports; a
variant with dependents only still scores 179/180, so the naming heuristic is not carrying the
result. Graphify was given code-only extraction; its docs/images path was not exercised. Depth 5
is our product maximum; graphify was allowed 10 and barely moved. Both tools refused 3–5 bare
names; graphify answers with a single "No unique node match" line, ours returns the ambiguous
candidates so the seed can be resolved without another lookup.

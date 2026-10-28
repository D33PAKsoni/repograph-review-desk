# Agent-behavior pilot (Phase 2, incomplete)

**Date:** 2026-10-27 (resource data recovered 2026-10-28)
**Status:** pilot only. No behavioral claim is supported. The treatment arm never
invoked RepoGraph, so this is not a test of the tool's effect.

Phase 1 measured whether the graph is correct. This pilot asked a different
question: does access to RepoGraph change what an agent does on a repository
change task? It was run before any launch claim about agent performance.

## Question and pre-registration

**Question:** Given the same change task and the same agent, does RepoGraph
availability change the set of files the agent edits?

**Unit:** a task instance in an isolated copy of `pallets/flask` (`d086db8`).
Copies were made from the same clone; the treatment copies were indexed with
RepoGraph before the run.

**Design:** paired (randomized block), five tasks. Both arms ran once per task.
The order of the two arms was randomized per task with seed `20261027`.

**Intervention:** the treatment prompt added one paragraph naming the RepoGraph
CLI and an example command. The control prompt was identical without that
paragraph. Both agents had the same file and shell tools, the same model, and
the same instructions not to run tests or create files.

**Task family:** rename one Python symbol everywhere it appears: definitions,
imports, re-exports, tests, examples and documentation. Tasks were chosen
because the correct file set can be computed mechanically and independently of
RepoGraph.

| Task | Old name | New name | Ground-truth files |
| --- | --- | --- | ---: |
| t1 | `SecureCookieSessionInterface` | `RgSecureCookieSessionInterface` | 5 |
| t2 | `get_debug_flag` | `rg_get_debug_flag` | 5 |
| t3 | `render_template_string` | `rg_render_template_string` | 9 |
| t4 | `SessionInterface` | `RgSessionInterface` | 6 |
| t5 | `FlaskCliRunner` | `RgFlaskCliRunner` | 6 |

## Grading

Ground truth was computed from a pristine copy with word-boundary search over
code and documentation files; it does not use RepoGraph. Scoring:

- **recall** — ground-truth files that contain the new name, divided by all
  ground-truth files;
- **old_left** — remaining occurrences of the old name in ground-truth files;
- **stray** — changed files outside the ground-truth set;
- **parse** — changed Python files that no longer parse.

## Results

| Task | Control recall | Treatment recall | Old name left (C/T) | Stray files (C/T) | Parse failures |
| --- | ---: | ---: | ---: | ---: | ---: |
| t1 | 5/5 | 5/5 | 0 / 0 | 0 / 0 | 0 |
| t2 | 5/5 | 5/5 | 0 / 0 | 0 / 0 | 0 |
| t3 | 9/9 | 9/9 | 0 / 0 | 0 / 0 | 0 |
| t4 | 6/6 | 6/6 | 0 / 0 | 0 / 0 | 0 |
| t5 | 6/6 | 6/6 | 0 / 0 | 0 / 0 | 0 |

Both arms were perfect on all five pairs. There is no measured difference in the
edited file set, in either direction.

### Tool use and cost (recovered after the run)

Per-session tokens and tool calls were recovered from the agent harness's
session export (`opencode session export`) after the fact; the earlier note that
this data was unavailable was wrong. Counts are the harness's per-session
totals, and both arms carry the same subagent wrapper prompt. `repograph_calls`
counts commands matching a real RepoGraph subcommand (`grep
--exclude-dir=.repograph` does not count).

| Task | Tool calls (C/T) | RepoGraph calls (C/T) | Input tokens (C/T) | Cache read (C/T) | Output tokens (C/T) |
| --- | ---: | ---: | ---: | ---: | ---: |
| t1 | 4 / 12 | 0 / 0 | 2,969 / 4,081 | 182,144 / 300,800 | 415 / 1,228 |
| t2 | 3 / 5 | 0 / 0 | 2,077 / 3,530 | 147,200 / 186,240 | 354 / 482 |
| t3 | 4 / 17 | 0 / 0 | 2,864 / 18,371 | 187,264 / 417,664 | 519 / 1,552 |
| t4 | 4 / 5 | 0 / 0 | 2,130 / 3,634 | 185,216 / 187,776 | 406 / 517 |
| t5 | 2 / 3 | 0 / 0 | 1,048 / 2,707 | 109,824 / 148,352 | 262 / 484 |
| **total** | **17 / 42** | **0 / 0** | **11,088 / 32,323** | **811,648 / 1,240,832** | **1,956 / 4,263** |

**The treatment arm never invoked RepoGraph.** Zero of the five treatment runs
ran the CLI; the agents solved the tasks with `grep`, `sed`, `read` and `edit`
exactly as the control arm did. Only the excluded `Request` run invoked it
(twice). The intervention as designed was an offer in the prompt ("use it if
you find it helpful"), and the offer was declined every time.

Treatment sessions used more tool calls and tokens, but the difference cannot
be attributed to RepoGraph: nothing in the treatment arm queried it. With one
run per cell and large between-cell variance (2 to 17 tool calls within the
same arm), these counts are descriptive, not a cost estimate.

Raw counts: `research/AGENT_BEHAVIOR_PILOT_DATA.json`.

## Interpretation

Two facts are measured, and they are separate:

1. **The task family is grep-solvable.** The control arm scored 100% using only
   `grep`/`sed`/`read`/`edit`, with zero RepoGraph calls. Rename tasks do not
   require a dependency graph.
2. **Offering the tool did not cause it to be used.** No treatment run invoked
   RepoGraph. The prompt's "use it if you find it helpful" was ignored, so the
   comparison is *control versus a longer prompt*, not *without graph versus
   with graph*.

The pilot therefore supports one conclusion only: **do not claim that RepoGraph
improves agent task success.** It does not support a claim of harm, and it is
not evidence that the graph would not help — the graph was never consulted. A
tool that is available and unused cannot show an effect.

This also removes the earlier explanation that a ceiling effect alone caused the
tie. The ceiling is real (both arms were perfect), but the treatment arm did not
test the instrument, so the tie says nothing about the instrument's value.

## Excluded task (disclosed)

A sixth task (`Request` → `RgRequest`) was run in the treatment arm but is not
analyzed. Word-boundary ground truth counted 29 files, but many occurrences
refer to Werkzeug's `Request`, which must **not** be renamed. A mechanical
ground truth would therefore reward an incorrect global rename. The arm was
excluded before scoring the pair, and no control run exists for it. Its single
run is not evidence.

## Threats to validity

- **Ceiling / task validity.** Rename tasks are grep-solvable; they do not test
  impact reasoning, uncertainty, or test discovery.
- **Sample size.** Five paired tasks, one run per cell. No variance estimate, no
  confidence interval, no power calculation.
- **Agents are AI, not humans.** Both arms used the same in-house agent and
  model. Results may not transfer to another harness or model.
- **Intervention not delivered.** No treatment run invoked RepoGraph. The
  measured contrast is prompt wording, not graph access. Any future comparison
  must require the tool's use (or make the answer unobtainable without it) and
  verify in the transcript that it was used.
- **Resources are descriptive.** Tokens and tool calls were recovered from
  session exports, but each cell is a single run on a free model with no cost
  estimate; the treatment/control difference in effort is confounded with
  ordinary run-to-run variance.
- **Order.** Arm order was randomized, but the two waves still differ in machine
  load; the tasks are file-local and short, so the expected effect is small.

## Decision

Launch copy may claim measured **edge accuracy** and explicit **blind spots**.
It must not claim improved agent outcomes, fewer missed dependents, or token
savings. Phase 2 remains open and blocking for any such claim.

A credible Phase 2 needs tasks that are not word-search-solvable (signature
changes, moves, deletions, route and model changes), repeated runs per cell, and
ideally independent external agents. It also needs a delivered intervention: the
treatment must require the tool's use, or pose a question the repository text
does not answer, and the transcript must confirm the call. Token and tool-call
counts are already recoverable from `opencode session export`; that part of the
harness exists.

Until then, the honest product statement is: RepoGraph gives an agent a
structured, evidence-bearing view of the repository; whether that improves
outcomes is unmeasured.

Artifacts: `research/AGENT_BEHAVIOR_PILOT_DATA.json` holds the per-cell token,
tool-call and RepoGraph-call counts. Isolated copies and `grade.py` remain under
`/tmp/opencode/phase2/` on the measurement machine; they are not committed
because they contain full repository copies. The grader and task table above are
sufficient to reproduce the scoring.

## Frozen prompts

Control:

```
You are working in the repository at {dir}.

Task: rename the Python symbol `{old}` to `{new}` everywhere it appears in this
repository: definitions, imports, re-exports, tests, examples and documentation.

Rules:
- Edit files in place. Do not create, delete, move or rename any file.
- Do not run the test suite (dependencies are not installed).
- Rename only this symbol; do not change behavior or unrelated text.
- When you are done, reply with one short sentence naming how many files you changed.
```

Treatment inserts:

```
RepoGraph is installed and this repository is indexed. You can query the index
with `/home/darion-dev/repograph/.venv/bin/repograph impact --root {dir}
<repo-relative path>` (also `graph`, `refs`, `search`); use it if you find it
helpful.
```

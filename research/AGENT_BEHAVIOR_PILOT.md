# Agent-behavior pilot (Phase 2, incomplete)

**Date:** 2026-10-27
**Status:** pilot only. No behavioral claim is supported.

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

Both arms were perfect on all five pairs. There is no measured difference, in
either direction.

## Interpretation

This is a **ceiling effect**, not evidence that RepoGraph is useless. A rename
is solvable by word search, and current coding agents are already good at word
search. The task family could not distinguish a graph-backed agent from one
without it.

The pilot therefore supports one conclusion only: **do not claim that RepoGraph
improves agent task success.** It also does not support a claim of harm.

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
- **Tool-use compliance is unverified.** The treatment prompt advertised the
  CLI; the run logs do not prove whether it was invoked.
- **Token and tool-call counts are unavailable.** The agent harness used here
  does not expose per-run token usage, so the most plausible benefit (less
  searching) could not be measured.
- **Order.** Arm order was randomized, but the two waves still differ in machine
  load; the tasks are file-local and short, so the expected effect is small.

## Decision

Launch copy may claim measured **edge accuracy** and explicit **blind spots**.
It must not claim improved agent outcomes, fewer missed dependents, or token
savings. Phase 2 remains open and blocking for any such claim.

A credible Phase 2 needs tasks that are not word-search-solvable (signature
changes, moves, deletions, route and model changes), a harness that records
tokens and tool calls, repeated runs per cell, and ideally independent external
agents. Until then, the honest product statement is: RepoGraph gives an agent a
structured, evidence-bearing view of the repository; whether that improves
outcomes is unmeasured.

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

Artifacts: isolated copies and `grade.py` under `/tmp/opencode/phase2/` on the
measurement machine; they are not committed because they contain full repository
copies. The grader and task table above are sufficient to reproduce the scoring.

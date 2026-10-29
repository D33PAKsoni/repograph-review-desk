# Brutal review: does RepoGraph matter, and should the direction change?

**Date:** 2026-10-29
**Inputs:** four parallel research agents (demand, technical moat, red team, alternatives), repo source, measured results in this repo.
**Not an input:** the distribution-base-rates agent — it died on a free-usage limit and was not replaced. Every distribution number below is either absent or marked as unmeasured.

This document is deliberately harder on the project than the README is. Anything I could re-verify myself, I did, and where a claim failed verification I say so.

---

## Verdict

**The current positioning does not matter, and it is not defensible.**

"Blast-radius analysis for AI-generated PRs" is a real pain with no room: the vendors reviewers already pay for ship a version of it, and the delivery channel — bot comments on a diff — is the single worst-performing channel in the literature. RepoGraph's engineering is sound; its *thesis* is a feature that three companies already bundle.

What survives is narrower, harder to fake, and measurable: **a deterministic pre-merge gate that answers "which tests must run, which cannot be determined, and prove it"** — no comments, no prose, an exit code, and a hard oracle (real pytest results) that can falsify the tool's own claims.

---

## 1. Demand: the pain is real, the product is already bundled

The verification bottleneck is not a hypothesis. High-AI-adoption teams show +98% merged PRs, +91% review time, +154% PR size (Faros AI telemetry, 2025 cohort), and METR's RCT measured experienced developers **19% slower** while believing they were 20% faster.

That is the demand. It is also why the space is crowded:

| Vendor | What they ship | Status of the claim |
| --- | --- | --- |
| CodeRabbit — *Change Stack* | cross-file change impact in review | agent-sourced (Aug 2026, 17k customers, $1.5B valuation); **not re-verified in this session** |
| Qodo | "blast radius" surfaced as a PR label | agent-sourced, not re-verified |
| Greptile | code graph + impacted callers | agent-sourced, not re-verified |
| GitHub Copilot code review | full-repo context at review time | agent-sourced (GA 2025-04), not re-verified |
| CodeSee | same product category | agent-sourced shutdown 2024-02-22 |

Two of those are corroborated in *kind* even without re-fetch: CodeRabbit's and Qodo's own marketing uses the exact phrase this project was going to use. When the category leader names your feature in its release notes, you are not entering a category; you are entering a roadmap.

**Why "we do it with evidence and confidence classes" is not a moat:** every one of those vendors can add a `confidence` field to a JSON block in a sprint, and none of them needs to, because reviewers do not buy epistemics. The evidence model is good engineering, and it is a documentation style, not a defensibility.

**Counter-evidence worth keeping:** the pain is not going away, and all of these are single-language or JS-first. The gap is not "impact analysis"; it is *cross-language, offline, deterministic, and honest about the unknown*.

## 2. The channel problem: PR comments are where tools go to be muted

I re-verified these from the paper's own tables (arXiv:2508.18771, v2 2026-04; 16 review actions, 22,326 comments, 178 repos):

- The largest action (anc95/ChatGPT-CodeReview, **2,831 comments**) placed **84.21%** of its comments on files the PR never touched.
- In the paper's 50-comment manual audit, human comments were **80%** "fully addressed"; file-level bot comments **26%**; hunk-level **36%**.
- **55.2%** of that action's comments fall in the paper's *valid but not addressed* bucket.

A tool that posts one comment per PR into that stream is competing for the attention that this data says is already being wasted. The plan's own honest-risk section in `DIRECTION_2026-10.md` says it: *if it cannot be silent, it will be muted.*

This is the strongest argument in the whole review, and it kills the PR-comment artifact, not just the wording.

## 3. Technical truth: what is commodity, and what our code cannot see

**Commodity** (a competent team ships it in weeks): tree-sitter parsing, import→file resolution incl. `tsconfig` paths and workspace names, SQLite incremental index, reverse BFS, cycle detection, MCP stdio shim, `--json` output.

**Hard and unsolved**: symbol binding across re-export chains; conditional `exports` maps; `pnpm workspace:*`; mapping a source change to *build targets* (Nx/Bazel/Turbo project refs); DI/`Depends`/plugin registries; and a diff→test-set mapping with *calibrated* recall.

I verified one limitation directly against this codebase rather than taking an agent's word for it. `extract.py` emits refs for exactly four kinds — `call`, `attr_call`, `inherits`, `new`. A symbol used as a *value* is invisible. Demo (`/tmp/opencode/cb-demo`), three files using `load_user`:

```python
# app/run.py              load_user()                        -> ref recorded
# app/routes.py           handler(user=Depends(load_user))  -> no ref
# app/registry.py         HANDLERS = {"user": load_user}    -> no ref
```

`repograph refs load_user` reports **1 of 3** use sites. So the symbol layer is a **call graph, not a reference graph**. Consequences, stated precisely:

- `find_references` under-reports for FastAPI, decorators, pytest fixtures, registries, JSX props, and any callback passed as an argument. That is most modern Python.
- It does **not** break file-level impact: all five importing files still appear because the import edge is separate. `impact --symbol X` resolves X to its file and then uses that file's importers, so the file answer is unaffected — I confirmed five dependents in both modes.

**Accuracy claims, at their real size.** 98.3% precision on 120 edges is 2 errors. At ~5 edges per changed file and a 50-file PR, that is ~250 rows and ~4 false rows per PR — in a *comment*, four wrong lines is enough to get the tool muted. Recall 93.7% on a corpus whose largest repo is 483 files; zustand's five core files (`react.ts`, `vanilla.ts`, `traditional.ts`, `middleware/subscribeWithSelector.ts`, `tests/ssr.test.tsx`) fail to parse and contribute **zero** edges. The benchmark ceiling is 1,223 files. No measurement exists at monorepo scale.

**Correction to an agent's claim:** the "aliased import breaks `--symbol`" defect is **not real**. `indexer.py:145` stores `target_name = imported` (the original name) while keying the binding map by the local alias, so `from .deps import load_user as lu` still records `target_name="load_user"`. Likewise `_condition_target` (`resolve.py:342`) is a documented, deliberate ordering, not a bug. Both claims are dropped.

## 4. What actually survives

1. **A deterministic graph is a different thing from an LLM reviewer.** It is reproducible, offline, auditable, costs nothing per PR, and — crucially — it can be *scored*. An LLM reviewer cannot tell you its false-negative rate on your repo.
2. **The cross-language edge is genuinely rare.** Routes and models extracted on the Python side, imports on the TS side, in one index, local. Every incumbent above is single-language or requires a hosted service.
3. **Silence is a feature, not a limitation.** "Undetermined" as a first-class output with a reason is the one design decision incumbents structurally cannot copy — their business model is engagement per PR.
4. **Nobody has a calibrated test-selection number.** That is the open, measurable problem in the space.

## 5. Three candidate pivots, scored

Scores 1–5. "Oracle" = whether the claim can be checked against ground truth instead of self-labeled.

| Pivot | Pain | Defensibility | Oracle | Build cost from today | Verdict |
| --- | --- | --- | --- | --- | --- |
| **A. Affected-tests gate** — `repograph tests --diff` prints the tests to run and the tests it cannot rule out; CI job runs exactly those; exit code | 4 | 4 | **5** (real pytest pass/fail) | low | **recommended** |
| **B. Cross-stack contract drift** — infer backend routes/models ↔ frontend call sites, fail on silent consumer breakage | 4 | 5 | 3 | high | highest ceiling, highest risk |
| **C. Committed `impact.md`** — the impact report as a reviewed artifact in the PR | 2 | 2 | 2 | very low | a report nobody asked for |

**Why A wins on expected value:** it fixes this project's actual disease. Every claim RepoGraph has made is *self-measured* — the edge audit was labeled by its own author; the agent pilot was 5 runs; the test-selection experiment showed 24% file recall and 6/36 precision and was then documented as a heuristic. A's ground truth is not a labeler, it is `pytest`: run the selected tests, then run the full suite, and count what the selection missed. That number cannot be argued with, and it is the only artifact in this repo that could ever be marketed honestly.

**Known competition, stated plainly:** pytest-testmon (coverage-based selection), Nx/Bazel affected (JS monorepos), Datadog TIA and Launchable (commercial, instrumented). The wedge is *zero instrumentation*: coverage-based tools need a prior full run and a coverage DB; this works on a fresh clone and says "I cannot determine these 12 tests" instead of silently skipping them. That is a thin wedge. It is thinner than a PR comment and it is the only one with an oracle.

**Why B is tempting and why I did not pick it:** the cross-language asset is real and unowned, but "implicit contract" inference is a precision problem on top of a parsing problem; at 98% edge precision a contract checker would be noise. Revisit it after A produces a credible accuracy record.

## 6. Kill criteria (write these down before building)

A is falsifiable in 30 days. If any of these fail, the honest move is to stop, not to re-position again:

- **Recall:** across 20 real PRs where the full suite had at least one failure, the selected set contains the failing test **≥ 95%** of the time. (Below 90%, the gate is unsafe and cannot ship as a gate.)
- **Cost:** median selected-suite runtime **≤ 25%** of full suite.
- **Undetermined:** the "cannot rule out" list is **≤ 20%** of all tests. A gate that says "run half the suite" has no value.
- **Adoption signal:** at least **3 of 10** cold users who install it run it twice. Current baseline is 0 users, so this is the only number that matters after correctness.

## 7. What to stop doing

- **Stop the PR-comment artifact.** The channel is measured to fail.
- **Stop the agent-first story.** 0/5 pilot invocation, LSP shipped natively in Claude Code, and Claude Code's own grep+read loop beat a 6-tool MCP server in every observed run. `repograph setup` is still the right installer, but as a convenience for the CLI, not as a growth thesis.
- **Stop adding languages.** Five frontends already cost more than one person can maintain, and the marginal language adds no new evidence about the thesis.
- **Stop quoting 98.3% as if it were a product metric.** It is 118 audited edges on three small repos with a self-labeled sample.

## 7a. Decision (2026-10-29)

Pivot **A** was chosen and built: `repograph tests --diff` returns the selected tests, the tests it
cannot rule out, and a pytest command; `--strict` exits `3` so a gate fails closed. The undetermined
set is computed, not narrated: a test file that did not parse, that has an unresolved internal
import, that is downstream of a changed `conftest.py`, or a changed file absent from the index.

No recall claim is made yet. The kill criteria in §6 are the measurement to run next, and they are
the whole point of the pivot.

## 8. One-paragraph answer

RepoGraph does not currently matter, and the direction should change. The tool is real and unusually honest, but "impact analysis for AI PRs" is a bundled feature of the review products the target user already pays for, delivered through a channel the literature shows is ignored. The asset worth keeping is a deterministic, offline, cross-language graph that is cheap per query and can be scored against ground truth. Point it at the one question with a hard oracle — *which tests must run for this diff, and which can't you rule out* — publish the measured recall and the runtime saving, and let the number do the marketing. If that measurement fails, the project should end rather than pivot a fourth time.

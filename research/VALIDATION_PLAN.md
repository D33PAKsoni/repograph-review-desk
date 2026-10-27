# Validation plan

The repository currently validates that the pipeline works. It does not validate that the analysis is accurate enough to trust, or that anyone wants it. This plan separates those questions.

## Phase 0 — Engineering baseline (done)

- Unit and integration tests pass.
- CLI and MCP stdio paths are exercised end to end.
- Indexing never executes repository code.
- Benchmarks are reproducible on five real repositories.
- Results and failures are documented.

Artifacts: `tests/`, `benchmarks/results/`, `docs/LIMITATIONS.md`.

## Phase 1 — Edge accuracy (next, blocking)

**Question:** Are the import edges and reference bindings correct?

**Method:**

1. Select three repositories: one Python application, one TypeScript application, one mixed/workspace repository. Use the benchmark clones or similar.
2. Sample 200 resolved internal import edges and 100 unresolved imports, stratified by confidence class.
3. Two reviewers label each edge as correct, wrong target, or not-an-edge. Resolve disagreements; report agreement.
4. Compute precision/recall per language and confidence class.
5. Publish the labels (with paths/lines, no private code) and the script.

**Metrics:**

- Internal-edge precision and recall.
- `confirmed` / `inferred` / `heuristic` error rates.
- Unresolved rate and top causes.
- False-positive and false-negative impact for 20 changes.

**Pass:** ≥95% precision on resolved internal edges and ≥85% recall on static internal imports. If precision is below 90%, do not market the analysis as reliable.

**Kill:** Precision cannot be raised without a language server or a much larger effort. Re-scope to a visualization tool or stop.

## Phase 2 — Agent behavior

**Question:** Does the MCP server change what an agent does?

**Method:**

1. Define 12 change tasks across two repositories: a rename, a signature change, a move, a deletion, a route rename, a model field change, and a test-only change.
2. Pre-register expected affected files and required tests.
3. Run each task with an agent that has file/search tools only, and with the same agent plus RepoGraph.
4. Score task completion, unrelated edits, missed tests, and total tokens.
5. Freeze prompts and model versions. Report variance across repeats.

**Metrics:** Completion rate, unrelated-edit count, missed-test count, context tokens, tool calls.

**Pass:** A statistically credible improvement in at least one meaningful metric without lower completion.

**Kill:** No difference, or context cost dominates.

## Phase 3 — User value

**Question:** Do target users care about provenance and blind spots?

**Method:**

- 5–10 semi-structured interviews with platform/DevEx, payments/auth, or maintainers of agent-generated PRs.
- Show two artifacts for the same change: a plain dependent list and an evidence report with blind spots.
- Ask them to decide whether to approve, and to explain their reasoning.
- Ask what would make them run it twice.

**Signals:** Unprompted mention of blind spots; request for CI integration; willingness to install; a concrete past incident involving an unexpected dependency.

**Kill:** Users prefer the plain list, cannot interpret confidence, or see no workflow fit.

## Phase 4 — CI gate (conditional)

Only after Phase 1 precision passes.

- Ship an advisory GitHub Action or pre-commit hook.
- Run on 3–5 design-partner repositories for two weeks.
- Track: reports viewed, review decisions changed, false positives reported, disable rate.
- Do not make it blocking until a team asks.

## Phase 5 — Launch decision

Launch publicly only if:

1. Edge precision meets the threshold.
2. Security tests pass and the threat model is documented.
3. At least one user workflow shows repeat use.
4. Claims in README/launch copy are limited to measured behavior.

If 1 fails, publish the tool as an experimental graph explorer with explicit accuracy caveats, not as a trustworthy impact analyzer.

## Measurement hygiene

- Keep raw results and scripts.
- Report medians and ranges, not only best runs.
- State the machine and versions.
- Include failures and parse errors.
- Never compare against a competitor unless it was run on the same corpus with the same task.
- Do not infer demand from GitHub stars.

## Open questions for the validation owner

- Which repositories represent the target users, not just popular open source?
- Who can label edges independently?
- What false-positive rate will a reviewer tolerate?
- Is the wedge CI, agent preflight, or human review?
- What evidence would justify adding a fourth language?

# Product hypotheses

Each hypothesis is a bet with a measurable signal and a kill criterion. None are validated by the current repository. H1–H3 are the core wedge; H4–H5 are supporting bets.

## H1 — Users value provenance and uncertainty in impact analysis

**Claim:** When deciding whether an agent's change is safe, developers prefer a report that cites file:line and names its blind spots over a confident list of dependents.

**Why it might be true:** Agent outputs are hard to trust; reviewers need to justify approvals; empty "no dependents" answers are dangerous.

**Why it might be false:** Users want a fast yes/no; confidence labels add cognitive load; competitors already claim evidence; the report may be ignored.

**Test:** Show 5–10 target users the same change analyzed by RepoGraph and a plain graph export. Ask which they would attach to a review and why. Measure whether they can explain a confidence label correctly.

**Signal:** Majority choose the evidence report for review; they cite blind spots unprompted; no one describes the labels as noise.

**Kill:** Users consistently prefer the simpler output or cannot map confidence to a decision.

## H2 — A preflight impact tool changes agent behavior

**Claim:** An agent that calls `analyze_change_impact` before editing touches fewer unrelated files and reports missing tests more often than an agent with only search/read tools.

**Why it might be true:** The tool surfaces reverse dependencies the agent would not grep for; blind spots prompt verification.

**Why it might be false:** Agents ignore tool output; context cost crowds out the task; agents already run tests and linters.

**Test:** A small benchmark of 10–20 change tasks on 2–3 repositories, with and without RepoGraph exposed over MCP. Score unrelated edits, missed test runs, and task completion. Pre-register the tasks and scoring.

**Signal:** A measurable reduction in unrelated edits or missed tests, without lower task completion.

**Kill:** No difference, or worse completion due to context overhead.

## H3 — There is a usable CI change gate

**Claim:** Teams will run an advisory impact check in CI and eventually make it blocking for selected paths.

**Why it might be true:** CI is where review policy lives; a gate creates repeat usage; evidence can be attached to a PR.

**Why it might be false:** False positives destroy trust; teams already have tests and CODEOWNERS; integration cost is high.

**Test:** Build a read-only report first. Ask teams to run it for two weeks and record whether it changed a review decision. Only then test a blocking mode.

**Signal:** Reviewers act on the report at least once; false-positive rate is acceptable on the labeled corpus.

**Kill:** Reports are ignored, or precision is too low for advisory use.

## H4 — Local-first, zero-key installation is a real advantage

**Claim:** A subset of users will choose a slower local tool over a faster cloud/semantic tool because it requires no key, no upload, and no service.

**Why it might be true:** Regulated code, air-gapped environments, privacy policies, personal projects.

**Why it might be false:** Most users accept cloud tools; local tools are harder to support; performance matters more.

**Test:** Landing-page or README CTA with install instructions; interviews about procurement constraints.

**Signal:** Users cite data residency or setup simplicity as the reason for trying it.

**Kill:** No one mentions either; installs are dominated by curiosity, not constraints.

## H5 — Three languages are enough for the wedge

**Claim:** Python/TypeScript/JavaScript cover enough high-blast-radius repositories that language breadth is not the first blocker.

**Why it might be true:** These dominate agent-assisted web/backend work; the wedge is a workflow, not a universal index.

**Why it might be false:** Target teams are polyglot; Go/Rust/Java are common in platform and payments code; missing languages make the graph misleading.

**Test:** Interview target teams about repository languages. Measure how often the tool would be incomplete in their primary repo.

**Signal:** A majority can use it on their main repository today.

**Kill:** Every serious prospect needs Go/Java/Rust before a trial.

## H6 — Explicit blind spots reduce false confidence

**Claim:** Showing "no static dependents; this may still be used dynamically" prevents at least some unsafe approvals.

**Why it might be true:** It directly counters the most dangerous failure mode of graph tools.

**Why it might be false:** It becomes boilerplate users learn to ignore.

**Test:** Decision task with and without blind spots; measure whether participants incorrectly approve a change with hidden dynamic use.

**Signal:** Fewer unsafe approvals, or better explanations of residual risk.

**Kill:** No behavioral difference; users dismiss the section as noise.

## Priority

Validate H1, H2 and H6 first. They justify the wedge. H3 depends on precision. H4 and H5 are positioning bets that can be tested cheaply in interviews.

## What would change the strategy

- If H1 fails, reposition toward CI policy or architecture visualization.
- If H2 fails, stop investing in MCP preflight and focus on human review artifacts.
- If H5 fails, either add one language deliberately (Go or Java) or narrow the target to Python/TS teams explicitly.
- If precision is poor, fix resolution before any launch.

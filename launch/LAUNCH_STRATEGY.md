# Launch strategy

**Do not publish, push, or announce without explicit maintainer authorization.** This document is a plan, not an executed launch.

## Position

> RepoGraph is a local-first codebase index for AI agents that reports **what depends on a change, how it knows, and what it cannot see**.

Avoid:

- "the best code graph"
- "understand any codebase"
- "supports N languages" (three)
- "safe changes" or "proven impact"
- "test selection works" (measured 0.23 pooled file recall; documented as a heuristic)
- unverified competitor comparisons
- fabricated performance numbers

## Launch readiness checklist

### Must be true

- [x] Tests pass locally.
- [x] Security model documented; non-execution tested.
- [x] Benchmarks reproducible and failures disclosed.
- [x] README has honest limitations.
- [x] Edge precision measured on a labeled corpus: 98.3% precision on 120 audited edges, 93.7% estimated recall (`research/EDGE_ACCURACY_RESULTS.md`). Labels are AI, not human.
- [x] A clean install from a fresh copy succeeds: `pip install repograph-codeintel` verified in an empty venv from the PyPI index.
- [x] CI passes on a public branch.
- [x] Repository has issue templates, a security policy and CI; no named maintainer beyond the GitHub account.
- [ ] At least one design partner has run it on a real repository. **Still false — this is the only item that matters now.**
- [x] No private paths, credentials or generated indexes are committed (a fixture index leaked once and was removed; `.gitignore` now covers it at any depth).

Precision data now exists; the only unmet item is a person outside this project running it. Until that changes, any announcement goes out as an **experimental graph explorer** — never as a change-safety or CI-gate product.

## Audience and channels

The concrete plan is **`OUTREACH_TARGETS.md`**: ten named repositories, ten 1:1 asks, and a decision rule for the result.

| Audience | Message | Channel |
| --- | --- | --- |
| Agent users (Claude Code, Codex, opencode, Cursor) | "Give your agent a dependency check before it edits." | MCP directories, agent docs, short demo |
| Python/TS maintainers | "See what your last edit touched, with evidence." | Show HN, Reddit r/Python, r/typescript |
| Platform/DevEx | "An auditable, local impact report you can put in CI." | Blog post, direct outreach |
| Security/regulated | "No code execution, no upload, no API key." | Security-minded communities |

## Demo script (2 minutes)

1. Clone a real Python repository; run `repograph index .` (show time).
2. `repograph impact src/<high-inbound-file>.py` — show confirmed dependents, related tests, and blind spots.
3. Edit a file; `repograph index . && repograph impact --diff` — show changed symbols and affected route.
4. Start the MCP server in an agent; ask "what breaks if I change `X`?" — show the tool call and the blind-spot section.
5. Show a cycle with `repograph graph --cycles`.
6. End with the limitation: "It is static. Here is what it could not see."

Do not demo on a repository that produces many unresolved imports without explaining them.

## Launch post outline

1. The problem: an agent edits one file; "no dependents" is not a safety proof.
2. The insight: separate evidence from interpretation; report blind spots.
3. What it does: index, six MCP tools, CLI, diff impact.
4. What it does not do: static only, three languages, heuristic tests/routes.
5. Measured numbers: five repositories, cold/incremental/query; Express weakness and Vue parse errors included.
6. How to try: install, index, two commands.
7. Ask: run it on your repo and tell us where the graph is wrong. Edge accuracy is the next milestone.

## Objection handling

| Objection | Response |
| --- | --- |
| "There are already 20 of these." | Agreed. We focus on auditable impact and explicit uncertainty, not breadth. Validation is ongoing. |
| "Only three languages?" | Yes. It is a wedge, not a universal index. Tell us which language blocks you. |
| "Is it fast?" | At 1,223 files, 5.3 s cold and 1.1 s incremental on our machine. Not tested at 100k files. |
| "Does it run my code?" | No. It parses bytes. There is a test for this. |
| "Can I trust the impact list?" | Not yet as a merge gate. Edge precision is being measured. Use it as an advisory with blind spots. |
| "Why not embeddings?" | They answer "what looks relevant," not "what statically depends on this." Different job. |
| "Is this AI?" | No LLM is used. The index is deterministic. Your agent consumes it over MCP. |

## Post-launch metrics

- Installs or clones (no telemetry; use package/GitHub counts).
- Issues reporting wrong edges, with reproductions.
- Number of repositories where unresolved imports exceed 30%.
- Repeat usage in design partners.
- Agent task improvement in a controlled evaluation.

Do not optimize for stars.

## Timing

Do not launch before Phase 1 edge accuracy. A premature "impact analysis" launch invites a correct "it missed my dependency" response and burns the wedge. If a launch is needed for feedback, label it **experimental** and ask specifically for wrong-edge reports.

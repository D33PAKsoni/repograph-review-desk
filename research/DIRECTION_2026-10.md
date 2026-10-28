# Direction review — where the pain actually is

**Date:** 2026-10-28
**Question:** developers are stuck. Where, exactly — and does RepoGraph belong there?
**Method:** primary sources only where possible (randomized trial, telemetry studies, vendor postmortems, protocol specs), GitHub API snapshots for market counts. Numbers are dated; nothing here is a forecast.

---

## 1. The evidence: the bottleneck moved from writing to verifying

Five independent measurements, 2025–2026, all pointing the same way.

| Finding | Number | Source |
| --- | --- | --- |
| Experienced devs on their own mature repos were **slower** with AI, while believing they were faster | **+19% task time**; expected +24%, perceived +20% after | [METR RCT](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study), 2025-07 |
| AI-heavy teams produce more, but review absorbs it | **+98% PRs merged**, **+91% review time**, **+154% PR size**, **+9% bugs/dev** | [Faros AI](https://www.faros.ai/blog/ai-software-engineering), 10,000 devs / 1,255 teams, 2025-07 |
| AI adoption is near-universal, trust is not | **90%** use AI; **30%** little or no trust; instability up | [DORA 2025](https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report), ~5,000 respondents |
| Refactoring collapsed while copy-paste rose | moved lines **25% → <10%**; copy/paste **8.3% → 12.3%**; clones **~4x** | [GitClear](https://www.gitclear.com/ai_assistant_code_quality_2025_research), 211M changed lines, 2020–2024 |
| Review is now a funded category | **44%** of teams run an AI reviewer; adoption **14.8% → 51.4%** in ~10 months; CodeRabbit raised **$143M** at **$1.5B** | IdeaPlan / Jellyfish via [tech-insider](https://tech-insider.org/coderabbit-vs-greptile-vs-qodo-2026); Reuters, 2026-08-12 |

Read together: **the code got bigger, the author understood it less, and a human still has to approve it.** METR's four named friction points include "context gaps" and "code cleanup burden" — both are comprehension costs, not generation costs.

That is a different problem from "the agent cannot find the file". It is: *nobody can tell what this diff touches.*

### The specific failure that costs money

A reviewer opening a 154%-larger PR has to answer: which files outside this diff depend on it, which tests actually cover it, which routes and models change behaviour, and what could not be determined statically. A diff view answers none of those. An AI reviewer comments on the lines it can see; it does not compute the blast radius.

RepoGraph already produces exactly that object. It is just pointed at the wrong consumer.

## 2. Why the current positioning loses

Recap of the market brief ([`MARKET_DEBATE.md`](MARKET_DEBATE.md)):

- `topic:change-impact-analysis`: **40 repositories**, ceiling **400 stars**. The category is not a discovery channel.
- Claude Code 2.0.74 ships a native `LSP` tool: `findReferences`, `workspaceSymbol`, call hierarchy, live diagnostics. Two of six RepoGraph tools, compiler-accurate, free, already installed.
- Agents do not call tools they were not told to call: **0/5** in RepoGraph's own pilot; **12/1,082 (1.1%)** LSP calls in one independent log.
- 100K stars ≈ top 30 on GitHub, above Aider. Not a niche tool's outcome.

Conclusion: **"code intelligence for agents" is a feature the platform absorbs and the agent ignores.** Continuing to sell it means competing with a free built-in on the axis the buyer already solved.

## 3. The direction change

**New thesis, one sentence:**

> RepoGraph is the blast-radius check for AI-generated pull requests: it tells a reviewer which files, tests, routes and models a diff can affect — and which parts it could not see.

Three consequences, in order of importance:

1. **The consumer changes from agent to human + CI.** A review comment and a JSON exit code are artifacts people act on. An MCP tool is an artifact the model may skip.
2. **The product moment changes** from "before the agent edits" to "before the human merges". That is where the measured 91% review-time increase lives.
3. **The differentiator becomes legible.** "Every edge has evidence and a confidence label, and the report states its own blind spots" is a *review* property. In a PR comment it reads as an audit trail; in an agent tool it reads as overhead.

This does not discard the graph, the CLI or the MCP server. It re-points them at a consumer with a measured, expensive problem.

### Why this is defensible where the agent story was not

- Reviewers cannot get blast radius from LSP: no language server returns "affected tests, routes, and unknown regions".
- AI reviewers (CodeRabbit, Greptile, Qodo) comment on the diff. Impact radius is complementary, not competitive — and they have distribution RepoGraph can borrow rather than fight.
- CI needs a static, offline, language-agnostic answer. LSP needs a working toolchain per language.
- The blind-spot report is an audit artifact for regulated code, which no bundled tool produces.

### The honest risk

Review comment tools are crowded and buyers may see this as "another bot on my PR". The defense is that this bot does not comment on code quality; it answers one question per PR and stays silent when nothing is affected. If it cannot be silent, it will be muted.

## 4. Reliability: what to fix, in order, and why the obvious answer is wrong

### Do not build on stack graphs

GitHub's stack-graphs — the natural "precise name resolution from tree-sitter" upgrade — was **archived on 2025-09-09** (`github/stack-graphs`, archived=true). GitHub abandoned the approach after failing to sustain per-language `.tsg` grammars. Any plan that says "adopt stack graphs" is a plan to adopt an abandoned dependency.

### The viable precision path: optional SCIP ingestion

SCIP is a language-agnostic index format, now independently governed (Meta, Uber, Sourcegraph), with **actively maintained** indexers — `scip-python` and `scip-typescript` both pushed within the last 48 hours as of this review.

Proposed model, in the existing confidence vocabulary:

| Edge source | Label | Meaning |
| --- | --- | --- |
| SCIP index agrees with tree-sitter resolution | `confirmed` | Two independent extractors agree |
| SCIP index present, tree-sitter disagrees | `unresolved` + blind spot | Disagreement is reported, not silently resolved |
| tree-sitter only (no index available) | `confirmed` (today's meaning) | Unchanged behaviour |
| SCIP only | `inferred` | Precise but tool-generated |

This is a real differentiator nobody in the category claims: **confidence by cross-extractor agreement**, not by heuristic self-assessment. It also fixes the failure mode where advanced TypeScript syntax defeats tree-sitter — zustand had 5 core files contribute zero edges.

Cost: SCIP needs a project that builds (`tsc`, `scip-python`), so it must stay optional. The fallback is today's resolver. Do not gate the product on it.

### Recall is the real risk, not precision

Measured: 98.3% precision, 93.7% recall, mocha at 78.9%. A reviewer forgives a missing graph edge less than a wrong one, but a *silent* miss is what makes the report untrustworthy. All eight agreed round-5 misses were JSON `require`s — a single, closable category. Close it before adding languages.

### What not to do

- Do not add Go/Rust/Java. Breadth multiplies blind spots faster than it multiplies users.
- Do not claim "safe to merge". The product's value is the checklist, not a verdict.
- Do not gate CI on `heuristic` edges. `--fail-on=confirmed` only.

## 5. Growth: the mechanics that actually moved repos in this market

Observed ceiling and shape, same day:

| Tool | Stars | Why it spread |
| --- | ---: | --- |
| `punkpeye/awesome-mcp-servers` | 96,978 | a list — zero install |
| `upstash/context7` | 63,829 | one URL, works in every client, solves stale docs |
| `Aider-AI/aider` | 49,792 | default install, repo map included |
| `oraios/serena` | 30,801 | `uvx` one-liner, LSP-backed, many clients |
| `yamadashy/repomix` | 29,054 | one command, one visible artifact |
| `trailhq/Trail-Code` | 10,836 | "make your agent better" one-liner |
| `giancarloerra/SocratiCode` | 3,356 | 40M LOC claims + token-savings numbers |
| top `change-impact-analysis` repo | 400 | analysis-first, no install path |

The pattern is consistent: **zero config, one command, immediate visible artifact, works in the client the user already has.** RepoGraph currently requires a venv, an index step, a config edit, a prompt rule, and a re-index habit.

Claude Code plugins solve steps 1–4 in one unit: a plugin directory can bundle an MCP server (`.mcp.json`), a skill that instructs the agent when to call it, and a hook that runs after edits — installed with `/plugin` from a marketplace ([docs](https://code.claude.com/docs/en/plugins)). That is the shortest legitimate path from "exists" to "running".

## 6. The plan, ranked by expected return

| # | Move | Why | Success test (falsifiable) |
| --- | --- | --- | --- |
| 1 | **`repograph pr`** — one comment per PR: affected files, tests, routes, blind spots; silent when empty | Attacks the measured 91% review-time problem with an artifact reviewers already read | 5 real repos, 20 PRs: ≥80% of reviewer-confirmed impacted files present; ≤1 comment per PR |
| 2 | **Claude Code plugin + MCP Registry listing** — bundles server, skill rule, post-edit hook | Removes the 5-step install tax; being installed beats being found | 50 installs in 30 days (opt-in counter or marketplace analytics) |
| 3 | **Close the JSON/config import gap; publish unresolved rate per benchmark** | The only measured miss category left; makes recall legible | mocha recall ≥90%; unresolved rate published for all five benchmarks |
| 4 | **Optional SCIP ingestion with agreement-based confidence** | Precision differentiator no competitor claims; fixes tree-sitter TS failures | On zustand: parse-error files ≤1; disagreement count reported |
| 5 | **Publish one rerunnable benchmark**: review time / tokens for 10 real PRs with and without the comment | The only claim that travels without a methods section | A third party reproduces within 20% |

Explicitly not on the list: more languages, semantic search, embeddings, a web UI, 100K stars.

## 7. What would falsify this direction

1. Five design partners say the PR comment is noise, or mute it within two weeks.
2. Reviewers report the affected-file list is usually empty or wrong on real diffs.
3. GitHub Copilot code review ships impact radius natively (then the product must move to the CI/audit side or stop).
4. Agents start calling LSP by default (then the graph is a commodity and only the report survives).

Any of these should end the direction rather than be explained away. That is the point of writing them down first.

---

## Sources

- METR, *Measuring the Impact of Early-2025 AI on Experienced Open-Source Developer Productivity* — <https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study>
- Faros AI, *The AI Productivity Paradox Report 2025* — <https://www.faros.ai/blog/ai-software-engineering>
- Google Cloud, *2025 DORA report* — <https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report>
- GitClear, *AI Copilot Code Quality 2025* — <https://www.gitclear.com/ai_assistant_code_quality_2025_research>
- Reuters, *AI code review platform CodeRabbit valued at $1.5 billion in latest funding round* (2026-08-12), as reported; headline and figure cross-checked against [tech-insider](https://tech-insider.org/coderabbit-vs-greptile-vs-qodo-2026)
- Claude Code, *Plugins overview* — <https://code.claude.com/docs/en/plugins>
- SCIP — <https://scip-code.org>; `sourcegraph/scip-python`, `sourcegraph/scip-typescript` (both active, 2026-10-28)
- `github/stack-graphs` — archived 2025-09-09 (GitHub REST API)
- GitHub REST search API — topic counts and star counts, 2026-10-28
- RepoGraph internal: [`MARKET_DEBATE.md`](MARKET_DEBATE.md), [`EDGE_ACCURACY_RESULTS.md`](EDGE_ACCURACY_RESULTS.md), [`TEST_SELECTION_RESULTS.md`](TEST_SELECTION_RESULTS.md)

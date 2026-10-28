# The case against RepoGraph

**Date:** 2026-10-28
**Purpose:** red-team the product thesis before spending another week on it. This document argues the strongest defensible case that **RepoGraph does not have an audience, and that no README, topic list or SEO pass changes that**. It is written to be wrong in specifics and useful in structure. Every number below was taken on 2026-10-28 and is reproducible with the command or link given.

Read it as an opponent's brief, not a forecast.

---

## The claim under test

> "There are many open-source tools, but developers need auditable change-impact analysis for AI agents. With the right README and discovery work, RepoGraph can reach 100,000 stars."

Two separate claims hide in that sentence: **(a) the need is real and unmet**, and **(b) distribution can carry a niche analyzer to 100K stars**. The data is unkind to both, and much kinder to a third claim the project has not made: *the tooling around agents is where attention is, not the analysis underneath it.*

---

## Exhibit 1 — The category is almost empty

GitHub topic counts, `search/repositories?q=topic:<name>`, 2026-10-28:

| Topic | Repositories |
| --- | ---: |
| `change-impact-analysis` | **40** |
| `codebase-intelligence` | 67 |
| `impact-analysis` | 290 |
| `code-graph` | 328 |
| `dependency-graph` | 1,202 |
| `static-analysis` | 11,260 |
| `mcp-server` | 40,362 |

Two readings are possible and only one is comfortable. Either this is an untapped category, or **40 repositories in two years of the largest AI-coding boom in history is what "nobody is looking for this" looks like**.

Searching names and descriptions is less flattering still: `code graph mcp` returns 1,349 repositories, `impact analysis mcp` returns 160. RepoGraph would be the 161st entry in a queue nobody is standing in.

The counter-argument — "categories are created by the product that wins them" — is true, and it is also what every one of those 160 repositories told itself.

## Exhibit 2 — The ceiling of this exact product shape is about 400 stars

Top repositories by stars inside `topic:change-impact-analysis`:

| Repository | Stars |
| --- | ---: |
| `AxiomCodeAI/axiomcodegraph` | 400 |
| `enola-labs/enola` | 278 |
| `openqa-cn/codexqa` | 236 |
| `SubmuxHQ/CodeDecay` | 8 |

Adjacent categories, same day, for scale:

| Repository | Stars | What it actually is |
| --- | ---: | --- |
| `punkpeye/awesome-mcp-servers` | 96,978 | a list |
| `upstash/context7` | 63,829 | docs lookup for agents |
| `Aider-AI/aider` | 49,792 | an agent with a repo map built in |
| `oraios/serena` | 30,801 | LSP-backed semantic retrieval |
| `yamadashy/repomix` | 29,054 | packs a repo into one file |
| `zilliztech/claude-context` | 12,654 | semantic code search |
| `trailhq/Trail-Code` | 10,836 | "contextual understanding" for agents |
| `giancarloerra/SocratiCode` | 3,356 | dependency graphs + symbol-level impact analysis |

The pattern is not subtle. **The winners are the ones you install once and never configure** — a list, a docs proxy, a packer, an agent. The losers are analyzers, and the best analyzer in the category sits at 400 stars.

A 100K target is not "ambitious" in this table; it is a different product.

## Exhibit 3 — The main customer already ships your feature for free

Claude Code added a native `LSP` tool in 2.0.74 and now documents code-intelligence plugins as an official install: `goToDefinition`, `findReferences`, `workspaceSymbol`, `documentSymbol`, call hierarchy, plus live diagnostics after every edit ([docs](https://code.claude.com/docs/en/plugins/code-intelligence)).

That covers two of RepoGraph's six tools outright (`search_symbols`, `find_references`) and does it with compiler-grade resolution instead of tree-sitter heuristics. It is faster, it is maintained by the vendor, and it is already in the tool the target user is running.

Meanwhile Aider has shipped a repo map with graph ranking over file dependencies since 2023 — free, in the default install, 49.8k stars ([docs](https://aider.chat/docs/repomap.html)). Cursor indexes the codebase automatically. The "agent doesn't understand your repo" problem is being solved inside the agent, by the agent vendors, at their cost.

RepoGraph's answer is to be an extra process the user must start, configure, and remember to re-index. That is a tax on a problem the platform is absorbing.

## Exhibit 4 — Agents do not call tools they were not told to call. Yours proved it.

This is the most damaging evidence, because RepoGraph produced it itself.

The five-pair agent pilot gave the treatment arm a prompt offering the RepoGraph CLI. **Zero of five treatment runs invoked it.** Both arms solved the tasks with grep. The pilot compared prompt wording, not graph access ([`AGENT_BEHAVIOR_PILOT.md`](AGENT_BEHAVIOR_PILOT.md)).

An independent measurement points the same way: after enabling LSP and instructing the agent to prefer it in `CLAUDE.md`, one developer logged **12 LSP calls out of 1,082 navigation calls — 1.1%** — because the harness system prompt prefers grep ([Scott Spence, 2026-09](https://scottspence.com/posts/enable-lsp-in-claude-code)). Anecdotal, single-user, but it matches the pilot exactly.

So the install story is not "build it and they will query". It is:

1. install the server,
2. edit a client config,
3. add a rule that forces the tool,
4. keep the index fresh,
5. and hope the model obeys.

Every one of those steps is a drop-off, and step 5 is not under your control. A README cannot fix this. A `/plugin` marketplace listing might.

## Exhibit 5 — The differentiator is already someone else's bullet point

RepoGraph's pitch is "evidence and uncertainty per edge, explicit blind spots". Fair, tested, and rare in the honest sense.

But the market does not compare honesty. It compares feature lists, and this one is already taken:

> "Enterprise-grade (40m+ LOC) codebase intelligence … hybrid semantic search, polyglot dependency graphs, symbol-level impact analysis & call-flow … **61% less tokens, 84% fewer calls, 37x faster**." — `SocratiCode`, 3,356 stars

RepoGraph's measured claims are 98.3% precision on 120 edges and 24% test recall. SocratiCode's are token and latency deltas — the numbers a developer feels in a bill and a wall clock. Precision on a sample is a claim you have to read a methods section to trust; "84% fewer calls" is a claim you can screenshot.

This is not an argument that SocratiCode is better. It is an argument that **the axis RepoGraph chose to win on is not the axis the market scores.**

## Exhibit 6 — The project's own gate says it is not ready

`research/VALIDATION_PLAN.md` Phase 5 allows a launch only if four conditions hold. Three do. The fourth — "at least one user workflow shows repeat use" — has zero evidence, and Phase 3 (5–10 user interviews) has not started.

And Phase 1b failed its own bar: **24% file recall against an 80% target**, even after the fixes raised precision to 6/14. The plan's own consequence is that test selection may not be marketed as reliable, which is why the README calls it heuristic and tells you to run the suite.

A product whose two headline capabilities are "a graph the platform gives you for free" and "a test list that misses three of four failing files" does not have a README problem.

## Exhibit 7 — Stars are not a usage metric, and 100K is a different league

Two facts worth keeping in the room:

- Stars correlate only moderately with real usage. A 2024 analysis found stars-to-downloads correlation of **0.14–0.33** across ecosystems ([Koch et al.](https://madweb.work/papers/2024/madweb24-koch.pdf)), and the ICSE 2026 fake-star measurement shows the signal is actively gamed because outsiders use it to pick dependencies ([StarScout](https://cmustrudel.github.io/papers/icse2026fakestars.pdf)).
- README quality does correlate with popularity — 1,950 READMEs across ten languages found lists, images, external links, contribution guidelines and references associated with more popular projects ([arXiv:2206.10772](https://arxiv.org/abs/2206.10772)). Correlational, not causal, and the effect is a few percent of the variance, not a category jump.

So: improving the README was correct and cheap. Expecting it to move a 0-star repository into six figures is a category error. **100K stars would put RepoGraph near the top 30 repositories on GitHub**, above Aider, above the MCP server list. That is not a niche tool's outcome; that is a default-install outcome.

---

## Where this brief is wrong

An opponent who cannot name his own weak points is just heckling. Six arguments survive contact with RepoGraph's actual behavior:

1. **Polyglot repositories break LSP economics.** A repo with Python and TypeScript needs two language servers, two configs, and a working toolchain for each. RepoGraph is one install and one database. In a monorepo with mixed languages, "one thing that mostly works" beats "two things that work perfectly after an afternoon".
2. **LSP answers symbols, not consequences.** No language server returns "these four files, this route and these tests are affected, and here is what the analysis could not see". The impact report is a different object from go-to-definition, and Claude Code's LSP tool does not produce one.
3. **CI does not have an editor.** A pre-merge check needs a static, offline, JSON answer with an exit code. It cannot boot Pyright and tsserver for every job. `repograph impact --json` is a shape LSP does not offer.
4. **Resolution is measured, not asserted.** 98.3% precision on unseen repositories with published labels is stronger evidence than most tools in Exhibit 2 provide. SocratiCode's token savings come with no published sample I could find.
5. **Blind spots are an audit artifact.** For payments, auth and migration code, "here is what the analysis could not see" is a review-checklist item a team can sign. That is a real, narrow, defensible use case — and the one place RepoGraph is genuinely differentiated rather than merely honest.
6. **The agent-inertia finding cuts at the install path, not the value.** Agents default to grep because grep is in the system prompt. A repo-level `CLAUDE.md` rule shipped *by the tool*, plus a plugin that registers the server in one command, removes steps 1–3 of the five-step tax above.

## Scoreboard

| Question | Verdict |
| --- | --- |
| Is there unmet need for auditable change-impact analysis? | **Yes, narrowly** — polyglot repos, CI pre-merge, regulated review. Not proven at scale. |
| Is the category a discovery channel? | **No.** 40 repositories, 400-star ceiling. |
| Do agents use added tools voluntarily? | **No.** 0/5 in your own pilot; ~1% in an independent log. |
| Can README/SEO deliver 100K stars? | **No.** README helps conversion, not reach. 100K is a default-install number. |
| Realistic ceiling from here, unchanged product | **300–3,000 stars**, with a launch event. |
| What would move it an order of magnitude | Being installed by default in a harness, or a benchmark others rerun. |

## What would have to be true

Three falsifiable moves, in order of expected return:

1. **Become a plugin, not a server.** Ship a Claude Code plugin/Cursor rule that registers the MCP server and writes the "call `analyze_change_impact` first" instruction into the repo. Publish to the official MCP Registry and the client marketplaces. Being one command from installed beats being one search result from found. Success test: 50 installs in 30 days, measurable by a `repograph init` telemetry flag — opt-in only.
2. **Ship the CI check and measure the thing buyers pay for.** Phase 4 was conditional on Phase 1, and Phase 1 passed. `repograph impact --diff --fail-on=confirmed` in a GitHub Action, run on five real repositories, with the false-positive rate published. Success test: one team leaves it on for two weeks.
3. **Publish one number a stranger can rerun.** Token cost and wall time for 12 change tasks, with and without the tool, harness and prompts frozen. That is the only claim that travels without a methods section. Success test: a third party reproduces it.

Until one of those lands, the honest pitch is the one already in the README: a local, auditable impact report with measured precision and stated blind spots. That is a good tool. It is not a 100K-star story, and pretending otherwise will produce worse decisions than the disappointment.

---

## Reproduce

```bash
gh api "search/repositories?q=topic:change-impact-analysis&per_page=1" --jq .total_count
gh api "search/repositories?q=topic:change-impact-analysis&sort=stars&order=desc&per_page=5" \
  --jq '.items[] | "\(.stargazers_count)\t\(.full_name)"'
gh api repos/oraios/serena --jq .stargazers_count
```

## Sources

- GitHub REST search API, queried 2026-10-28 — topic and repository counts, star counts.
- Claude Code docs, *Code intelligence plugins* — <https://code.claude.com/docs/en/plugins/code-intelligence>
- Aider docs, *Repository map* — <https://aider.chat/docs/repomap.html>
- RepoGraph pilot and accuracy results — [`AGENT_BEHAVIOR_PILOT.md`](AGENT_BEHAVIOR_PILOT.md), [`EDGE_ACCURACY_RESULTS.md`](EDGE_ACCURACY_RESULTS.md), [`TEST_SELECTION_RESULTS.md`](TEST_SELECTION_RESULTS.md)
- Venigalla & Chimalakonda, *An Empirical Study On Correlation between Readme Content and Project Popularity*, arXiv:2206.10772 (2022)
- Koch et al., *An Analysis of GitHub Stars as an Importance Metric* (2024) — <https://madweb.work/papers/2024/madweb24-koch.pdf>
- *A Growing Spiral of Popularity Contests, Spam, and Malware* (ICSE 2026, StarScout) — <https://cmustrudel.github.io/papers/icse2026fakestars.pdf>
- Spence, *Enable LSP in Claude Code* (2026-09), single-user measurement, 12/1,082 navigation calls — <https://scottspence.com/posts/enable-lsp-in-claude-code>

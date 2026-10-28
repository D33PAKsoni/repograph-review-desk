# REA teardown — what a 400k-star repo in one niche actually did

**Date:** 2026-10-28
**Subject:** `morluto/rea` — "Reverse engineer anything from your terminal or agent with one CLI and MCP server."
**Method:** full clone (`gh repo clone morluto/rea`, 114 MB), source and docs read directly, plus GitHub REST, npm registry, and Hacker News Algolia snapshots taken the same day. Nothing below is estimated unless labelled.

---

## 1. The numbers, as measured today

| Metric | Value | Source |
| --- | ---: | --- |
| Stars | **400,371** | GitHub REST, 2026-10-28 |
| Forks | 100,421 | GitHub REST |
| Contributors | 347 | `contributors` Link rel=last |
| Pull requests (all time) | 4,057 | search API |
| Issues (open + closed) | 3,588 | search API; 1,413 open |
| npm downloads, last 30 days | **954,247** | `api.npmjs.org`, to 2026-10-26 |
| npm downloads, last 7 days | 404,838 | same |
| npm versions published | 34 | registry `time` map |
| Created | 2026-04-14 | GitHub REST |
| License | MIT | — |
| Repo size | 114 MB, 3,303 TS files in `src/`, 2,182 test files | clone |

GitHub's own search ranks it **5th among repositories with more than 300k stars** — above `freeCodeCamp`, below `build-your-own-x`. That is not a niche outcome; that is a top-ten all-time repository.

**Downloads per star per month: 2.4.** For comparison, from the same week's measurement in `GROWTH_TEARDOWN.md`: Trail-Code 0.57, Serena 4.8, repomix 11.6, Context7 39.7. REA sits at the healthy end — the stars are not purely decorative.

Two signals I cannot explain and will not spin:

- **100,421 forks is a 25% fork rate.** Normal is 5–10%. Either people fork it as a template, or some of the growth is mechanical.
- **The stargazers endpoint returns 404**, so I could not read per-day star history to date the spike. Everything below about *when* growth happened is inferred from other timestamps, and labelled as such.

## 2. The timeline — six months of narrow work, then a rename, then one day

| Date | Event | Evidence |
| --- | --- | --- |
| 2026-04-14 | Repo created as **`betterBinaryMCP`** — "Enhanced MCP server for Hopper Disassembler" | initial commit message |
| 2026-07-12 | First npm publish, `rea-agents@0.2.1` | npm registry |
| 2026-07-13 | `1.0.0` published, one day later | npm registry |
| 2026-07-14 | `Show HN: A MCP for Agents to reverse engineer binary code` → **3 points** | HN Algolia |
| 2026-10-10 | `REA Reverse – Engineer Anything` → **814 points, 340 comments** | HN Algolia |
| 2026-10-12 | `Reverse engineer anything with agents…` → **101 points** | HN Algolia |
| 2026-10-25 | `6.8.0` released | CHANGELOG |
| 2026-10-28 | 400k stars, 954k downloads/month | APIs |

The shape is unmistakable and it is the opposite of the usual advice:

1. **Three months building a narrow tool** (Hopper-only) before it had a package.
2. **A rename from a mechanism to a category** — `betterBinaryMCP` → "Reverse Engineer Anything". Same thing that Serena did with "The IDE for Your Coding Agent".
3. **Two months of registry distribution and releases** (34 versions).
4. **One viral day.** The earlier, accurate, technical HN post scored 3 points. The later, category-level one scored 814.

Note what did *not* happen on 2026-10-10: no new capability was launched that day. `6.3.0` shipped the same day and its notes are ordinary. The product was already there; the *claim* changed.

## 3. The ten mechanics worth stealing

Ranked by how much of RepoGraph's actual problem each one solves.

### (1) The installer configures the agent, not just the package

`npx rea-agents setup` does not install a binary and print a config snippet. It:

- registers the MCP server with each detected client (Claude Code, Codex, Cursor, Gemini CLI, Grok, and more),
- **installs matching workflow instructions** — a skill that tells the agent when to reach for REA,
- writes backups of every file it touches,
- shows the planned changes and requires approval before writing,
- refuses to install or upgrade unrelated software (Node, Java, Ghidra are explicitly out of scope).

This is the direct fix for RepoGraph's measured failure: **0 of 5 agent pilot runs invoked RepoGraph**, and an independent log showed 1.1% LSP adoption. Agents do not call tools they were not told to call. Shipping the instruction *with* the server, in the same command, is the mechanism that closes that gap. REA's `SKILL.md` is not documentation — it is runtime behaviour: "If REA tools are available and their registration is not known to be stale, proceed directly to the target."

**RepoGraph action:** add `repograph setup` that writes `.mcp.json` / `claude_desktop_config.json`, drops a `repograph` skill file with the four trigger questions ("what breaks if I change X", "which tests cover X"), and prints a diff before writing. Effort: ~1 day. This is the highest-leverage change available.

### (2) Category claim instead of mechanism description

| Repo | Sentence |
| --- | --- |
| REA | Reverse engineer **anything** |
| Serena | The **IDE** for your coding agent |
| Repomix | Pack your codebase into AI-friendly formats |
| RepoGraph today | "local code graph and change impact analysis tool" |

REA's rename did not add capability; it moved the product from "a thing that does X to file Y" to "the thing you use for this whole job". The README's second line is a promise, the third is a proof pointer: "See a feature you like. Understand how it works, down to the binary level."

**RepoGraph action:** one category sentence, one proof line, above the fold. Candidate: *"See what a change breaks before you merge it."* The word "anything" is not needed; the *shape* is: job, not machinery.

### (3) Coverage is a first-class field, separate from confidence

This is the most technically interesting thing in the repo, and it maps exactly onto RepoGraph's blind-spot claim.

REA's Evidence records carry, independently:

- `relationship_coverage`: `complete` | `unknown` — did the provider return the whole set, or hit a read limit?
- `coverage.scope` and `coverage.status` on inventories — what was traversed, and was traversal finished?
- `facet_availability`: per-facet `{available: true}` or `{available: false, reason}` — pseudocode, assembly, callers, callees, references, strings, CFG.
- `limitations`: explanatory text that **must not be used to infer coverage**. Their contract says it explicitly: "limitations are explanatory and do not supply or infer coverage."

The rule they enforce across the whole codebase: **missing coverage is unknown, not absence.** A failed Ghidra decompile still returns a dossier — with `pseudocode` marked unavailable and the reason attached — rather than an error or an empty field.

RepoGraph has `confirmed | inferred | heuristic | unresolved` per edge. That answers *how sure am I about this edge*. It does not answer *did I look everywhere*. Those are orthogonal, and reviewers need both. A report can be 100% confident about every edge it has and still have skipped a directory.

**RepoGraph action:** add a per-report `coverage` block (`files_scanned`, `files_skipped`, `skipped_reasons`, `resolution_complete: bool`) and a `facets` map (`imports`, `tests`, `routes`, `models` → available/unavailable + reason). Never let prose limitations imply coverage; make the field authoritative. Effort: ~1 day, and it is a genuine differentiator no competitor states.

### (4) Retained evidence + paging, so a big answer does not eat the context

`analyze_function` deliberately **does not return the full dossier by default**. It retains it in the session and returns a summary whose `parent_evidence_id` points at the complete record. The agent pages the dossier with `inspect_analysis_view`, or passes `{"kind": "retained-evidence", "evidence_id": …}` to a comparison tool. `detail: "complete"` still exists for callers that need it inline.

The release notes call this out as a headline feature: "Keep large investigations focused with retained summaries, selected fact queries, configurable recovery limits, and row-oriented CLI exports. Complete Evidence remains available."

RepoGraph returns a whole dependency graph or impact set inline. On a 5,000-file repo that is thousands of tokens the agent did not ask for — and the reason a "just use the graph" pitch loses to grep.

**RepoGraph action:** `analyze_change_impact` returns counts + top N + `report_id`; a `get_impact_page(report_id, offset)` tool fetches the rest. Same data, bounded default. Effort: ~1 day. Also makes the MCP surface cheaper to describe.

### (5) The tool catalog is generated and digested at build time

`compile` runs `record-mcp-catalog.mjs`, which imports the *compiled* server, connects a real MCP client over an in-memory transport, and records what the server actually advertises. Tests compare against it. `docs:generate` emits `product-catalog.json`, and the docs serve the same file.

The consequence: the docs cannot claim a tool that the server does not register, and a schema change that breaks a client is caught at build, not by a user.

**RepoGraph action:** `scripts/dump_catalog.py` that starts the MCP server, lists tools, and writes `docs/catalog.json`; one test asserts the file matches. Effort: 2 hours. It also gives you a public artifact to point at.

### (6) Documentation claims are checked, not trusted

`npm run docs:check` runs, among others:

- `check-doc-facts.mjs` — verifies documented facts against source,
- `generate-error-schema.mjs --check` — error catalog generated from the error algebra,
- `generate-completion-ledger.mjs --check`,
- `generate-third-party-inventory.mjs --check`,
- `readmeConsistency.test.ts` — a test that the README matches the product.

This is the same discipline RepoGraph already applies to accuracy numbers, extended to every public claim. It is the reason REA can publish an enormous README table of 40 target formats and have it be true.

**RepoGraph action:** one test that asserts the numbers in `README.md` (precision, recall, test count) match `benchmarks/eval/report.json` and the pytest run. Effort: 1 hour. Cheap insurance against the exact failure mode you have been guarding against.

### (7) Executable architecture rules

`scripts/verify/architecture-guards.mjs` fails the build on specific, named regressions:

- no `localeCompare` in `src/domain` (ICU varies by host; use code-point ordering),
- no NUL-joined composite keys with variable-length middle fields,
- transparent wrappers unwrap in exactly one place,
- AST walks go through one traversal helper.

Each guard encodes a bug they actually shipped. `verify:module-boundaries` enforces the layer rule (domain ← providers ← application ← CLI/MCP). `knip:production` reports code unreachable from the shipped entry point.

**RepoGraph action:** a `tests/test_architecture.py` with three asserts — `domain`/`resolve` must not import `mcp` or `typer`; extraction must not call `subprocess`; no SQL string interpolation outside `store.py`. Effort: 30 minutes. It is the cheapest way to keep the evidence layer honest as the codebase grows.

### (8) Plugin manifests for both client families, plus a versioned skill

They ship `.claude-plugin/plugin.json` **and** `.codex-plugin/plugin.json`, each declaring the skill directory and an `mcpServers` entry that launches the bundled server at `${CLAUDE_PLUGIN_ROOT}/scripts/plugin-mcp-launcher.mjs`. Version is synced by `release-please` across `package.json`, `server.json`, `plugin.json`, and generated metadata.

Also `server.json` — the official MCP Registry manifest, with the npm identifier, version, stdio transport and the `mcp` positional argument. That is how the server becomes discoverable in the registry clients read.

**RepoGraph action:** a `.claude-plugin/plugin.json` with `skills: "./skills"` and an `mcpServers.repograph` entry running the installed console script; a `server.json` for the registry once the PyPI name exists. Effort: half a day.

### (9) Showcases with reproducible evidence, not benchmarks

`website/evidence/` holds one markdown file per case study, and each links a **reconstruction repository**:

- DX-Ball: "passes 3,205 original-x86 cases and reproduces all 63 compiled function bytes",
- TH04: recovered 16-bit DOS bullet-ring math, compared against the historical compiler's output,
- Notion: traced the Electron clipboard bridge from renderer through preload and IPC.

These are falsifiable claims with artifacts attached. That is why a 400k-star README can say "down to the binary level" and not be laughed at.

**RepoGraph action:** three case studies on real merged PRs — the diff, the impact report, what the reviewer missed or caught. Numbers from actual runs, linked to the commit. This is also move #5 in `DIRECTION_2026-10.md`, so it does double duty.

### (10) Release machinery that keeps 34 versions coherent

`release-please` with `versioning: "always-bump-minor"`, changelog sections per commit type, and version propagation into six files including `server.json` and both plugin manifests. `prepack` verifies the native artifact; `verify:published` checks the published package rather than the local build.

**RepoGraph action (later):** a `scripts/bump.py` writing the version to `pyproject.toml`, `__init__.py`, `server.json`, and `plugin.json`, plus a CI check that they agree. Do not adopt 34 releases; adopt the *sync*.

## 4. What not to copy

| Tempting | Why not, for RepoGraph |
| --- | --- |
| 40 target formats, ~136 tool registrations | Their moat is that binary formats are open-ended. Yours is correctness on five languages. Breadth multiplies blind spots faster than users. |
| 3,303 source files, 2,182 test files | That is the shape of a funded team after traction. It is not a prerequisite. |
| 22 README translations | Real reach, but it followed the spike. Translating before anyone reads it is pure cost. |
| Mutation testing with hand-picked semantic mutants | Excellent idea, wrong time. Revisit when the resolver has a stable contract. |
| A 114 MB repo with `third_party/`, `patches/`, `native/` | Their install path ships prebuilt artifacts. Yours is pure Python — keep it that way. |
| The 25% fork rate | Not a mechanic. Possibly not organic. Do not chase it. |

## 5. The honest read on 400k stars

Three things are true at once:

1. **The usage is real.** 954k npm downloads/month, 347 contributors, 4,057 PRs, 3,588 issues. This is not a star farm with an empty repo.
2. **The spike was event-driven.** 814 points on Hacker News on 2026-10-10, a second 101-point post two days later, and a self-posted "now #1 trending repo on GitHub". RepoGraph cannot schedule that, and neither can anyone else.
3. **The runway was six months.** The repo existed from April, shipped a package in July, and published 34 versions before the spike. The viral day landed on a product that was already installable, already documented and already had a catalog. A spike on an uninstallable repo converts to nothing.

So the copyable part is not the spike. It is: **narrow build → rename to the job → one-command install that also teaches the agent → evidence-grade docs → be ready when attention arrives.**

## 6. Amended plan (supersedes weeks 1–4 of `GROWTH_TEARDOWN.md`)

`GROWTH_TEARDOWN.md` had PyPI first. REA's timeline says the installer matters more than the registry, because it fixes the measured adoption failure rather than just the install friction. Revised:

| # | Move | Why now | Done when |
| --- | --- | --- | --- |
| 1 | **`repograph setup`** — writes MCP config + skill instructions for Claude Code / Cursor / Codex, backup + diff + approval | Directly fixes 0/5 agent invocation; no registry needed to ship it | A cold machine runs one command, restarts the agent, and the agent calls `analyze_change_impact` unprompted |
| 2 | **Coverage + facets in the impact report** | The differentiator that survives any competitor; makes "blind spots" a field, not prose | JSON report has `coverage.status` and per-facet availability; tests assert unknown ≠ empty |
| 3 | **Category sentence + proof line above the fold** | The rename is free and was the single largest lever in REA's history | README screen one: job, one number, one command |
| 4 | **Publish `repograph-codeintel` 0.1.0** | Still required for `uvx`; still needs your explicit "publish" | `uvx --from repograph-codeintel repograph version` in a clean container |
| 5 | **`repograph pr` + Action** | The artifact reviewers act on | One comment on a real PR, ≤1 per PR, silent when empty |
| 6 | **Plugin manifests + `server.json`** | Distribution inside the clients people already run | `/plugin` install works; registry listing resolves |
| 7 | **Generated catalog + doc-facts test** | Stops every public claim from drifting | CI fails if README numbers ≠ measured report |

Note the ordering change: **#1 before #4.** REA's own history shows the installer carrying adoption, and RepoGraph's pilot shows the agent-invocation gap is the binding constraint — not the pip command.

## 7. What would falsify this read

1. If `repograph setup` + skill ships and agents still do not call the tools, the agent-invocation thesis is wrong and the PR-comment path is the only one left.
2. If coverage/facets do not change a reviewer's behaviour in five trials, the "unknown ≠ absence" differentiator is unearned.
3. If a category-level README sentence produces no change in install conversion across a month, positioning was not the constraint.

---

## Sources

- `morluto/rea` clone at `/tmp/opencode/rea`, 2026-10-28: `README.md`, `AGENTS.md`, `CHANGELOG.md`, `package.json`, `server.json`, `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, `docs/tool-design.md`, `docs/mcp-contracts.md`, `docs/testing.md`, `docs/design/limits-and-recovery.md`, `docs/architecture.mermaid`, `src/domain/evidence*.ts`, `src/server/EvidenceMcpServerCore.ts`, `scripts/record-mcp-catalog.mjs`, `scripts/verify/architecture-guards.mjs`, `website/README.md`, `website/evidence/`.
- GitHub REST API: repository metadata, contributors (`Link` rel=last), issue/PR search counts, star-count ranking search `stars:>300000`.
- npm registry: `rea-agents` version `time` map (34 versions, 2026-07-12 → 2026-10-25); downloads API for 30-day and 7-day windows ending 2026-10-26.
- Hacker News Algolia API: story search for `rea reverse engineering`, `reverse engineer anything`, `morluto`, `rea-agents`.
- Unavailable: GitHub stargazers endpoint (404) — no per-day star history could be read.

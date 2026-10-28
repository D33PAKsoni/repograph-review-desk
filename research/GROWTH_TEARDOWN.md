# Growth teardown — the repos that actually grew

**Date:** 2026-10-28
**Question:** what did the fast-growing repos in this exact niche actually do?
**Method:** GitHub REST API (creation date, stars, topics, releases, homepage), monthly download counts from npm and PyPI, README teardowns, and launch traces via the Hacker News Algolia API. No estimates: every figure below is a dated snapshot or a download counter.

---

## 1. Velocity, not totals

| Repository | Created | Stars | Stars/day | Downloads/month | Downloads per star | Releases | Homepage |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| `upstash/context7` | 2025-03-26 | 63,830 | **110** | 2,534,516 (npm) | **39.7** | 100+ | context7.com |
| `oraios/serena` | 2025-03-23 | 30,801 | 53 | 147,731 (PyPI) | 4.8 | 18 | oraios.github.io/serena |
| `yamadashy/repomix` | 2024-07-13 | 29,054 | 35 | 336,389 (npm) | 11.6 | 100+ | repomix.com |
| `trailhq/Trail-Code` | 2026-07-03 | 10,837 | **93** | 6,173 (npm) | **0.57** | 0 | trailhq.com/graft |
| `vitali87/code-graph-rag` | 2025-06-16 | 5,293 | 12 | — | — | — | code-graph-rag.com |
| `giancarloerra/SocratiCode` | 2026-02-26 | 3,356 | 14 | — | — | — | socraticode.cloud |

Two different games are visible in the same table.

**Context7** is the real outlier: ~110 stars/day sustained for 19 months *and* 2.5M downloads a month. That is adoption.

**Trail-Code** grew at 93 stars/day with **zero GitHub releases** and **6,173 downloads a month** — 0.57 downloads per star. It is a star-growth project more than a usage project. Worth understanding precisely, because the mechanics are legible and repeatable, and because it shows stars can be produced without proportional adoption.

RepoGraph's table row: 0 stars, created 2026-10-27, not on PyPI, not on npm, no homepage.

## 2. The seven mechanics they share

### (1) A one-line install, from a package registry

| Repo | Command |
| --- | --- |
| Trail-Code | `npm install -g @trailhq/trail-code && trail init` |
| Context7 | `npx -y @upstash/context7-mcp` (no install step at all) |
| Serena | `uvx --from git+https://github.com/oraios/serena serena start-mcp-server` |
| Repomix | `npx repomix` |

Not one of them asks the visitor to clone, create a virtualenv, and `pip install -e .`. RepoGraph's current first instruction is four commands before the product does anything.

### (2) A landing page on a real domain

Every one of the six has a homepage. `context7.com`, `repomix.com`, `trailhq.com/graft`, `oraios.github.io/serena`, `socraticode.cloud`, `code-graph-rag.com`. The README is not the marketing site; it is the technical page that links to it.

### (3) A benchmark table above the fold

Trail-Code's README, third screen:

> **46% fewer tool calls**, **60% less time**, and more real issues solved.
> Tool calls 162 runs: baseline → **46% fewer**. Uncached input tokens: **42% fewer**. Time: **60% less**. SWE-bench Verified, 50 real issues: 27 (54%) → **33 (66%)**.

Method, sample size and baseline are all in the table. That is the single most copied element in the set, because it is the only thing a visitor can evaluate in ten seconds.

### (4) Badges that signal "this is alive"

npm version and **downloads**, Discord invite, license, Node version, OSSF scorecard, and a **telemetry disclosure** badge. Trail-Code also carries a Trendshift badge linking to its trending rank.

### (5) A community surface

Discord links in both Trail-Code and Serena. Issues are not a community; a chat room is.

### (6) Trending-site participation

Trail-Code's README links `trendshift.io/repositories/92209` with current ranks (14, 25, 18 in the fetched page). Trendshift tracks GitHub Trending; being listed and badge-linked is an explicit growth loop.

### (7) Product-shaped positioning, not technology-shaped

- Serena: "**The IDE for Your Coding Agent**" — a category, in five words.
- Repomix: "Pack your codebase into AI-friendly formats."
- Trail-Code: "The self-learning context layer for coding agents."

RepoGraph's current frame is "local code graph and change impact analysis tool" — accurate, and a description of the machinery rather than the outcome.

## 3. What they did *not* do

**Hacker News was not the channel.** Every submission I could find scored single digits:

| Query | Best HN result |
| --- | --- |
| Trail-Code | 1 point |
| serena mcp | 3 points |
| context7 | 4 points |
| repomix | 4 points |

Four separate "Show HN"-style posts, none above 4 points. The growth in this niche did not come from an HN front page. It came from package registries, landing pages, Discord, trending lists, and whatever distribution the parent company already had — Trail-Code is the renamed `graft` project from Nanonets, and the README still keeps `@nanonets/graft` download badges.

That is the most useful correction to the usual launch advice: **be findable where the install happens** (npm/PyPI, client marketplaces, trending lists), not where the applause happens.

## 4. What this means for RepoGraph, concretely

| Mechanic | State today | Gap |
| --- | --- | --- |
| One-line install | `.venv/bin/pip install -e .` after clone | **Blocked:** not on PyPI; `repograph` on PyPI is a dormant 2017 package (v0.1, "Visualize GitHub submodule dependencies"). The name cannot be used without a PEP 541 request. |
| Registry presence | none | Must publish as `repograph-codeintel`, and lead with `uvx --from repograph-codeintel repograph` |
| Landing page | GitHub README only | Needs `repograph.dev`-style page or GitHub Pages with the benchmark and the install line |
| Benchmark above the fold | accuracy table at line ~150 | Move one number to the top: 98.3% precision, or the review-time delta once measured |
| Badges | CI, Python, license, alpha | Add download badge after publishing; add Discord only when there is a room to join |
| Community | issues + templates | Discussions, not a new platform, until there are users |
| Trending loop | none | Trendshift submission after a real launch; it is a mirror, not a launch |
| Positioning | machinery | Outcome: "see what a change touches before you merge" |

### The uncomfortable part

Trail-Code's numbers suggest the star-maximising playbook works even when downloads do not follow (0.57 downloads/star/month versus Context7's 39.7). If the goal is literally stars, the playbook is: company-backed rebrand, landing page, benchmark table, Discord, trending badge, and a launch push. RepoGraph has none of the distribution assets and no marketing team.

If the goal is a tool people use, the order inverts: publish installable, prove one number, then promote.

Both goals start with the same blocker: **there is no one-line install and no PyPI release.**

## 5. Thirty-day plan

| Week | Action | Done when |
| --- | --- | --- |
| 1 | Publish `repograph-codeintel` 0.1.0 to PyPI (build, twine, trusted publishing); verify `uvx --from repograph-codeintel repograph version` in a clean container | One command installs from a cold machine |
| 1 | README first screen: install line, one benchmark number, demo output | A stranger can run it in under 60 seconds |
| 2 | GitHub Pages landing page: positioning, install, benchmark, limitations link | URL citable in the repo description |
| 2 | Enable Discussions; add download badge once counters move | Badge renders with a non-zero number |
| 3 | `repograph pr` + GitHub Action, measured on 20 real PRs across the five benchmark repos | Comment posted on a real PR with affected files and blind spots |
| 4 | Claude Code plugin bundling MCP server + skill rule + hook; list on the MCP Registry | `/plugin` install works end to end |

Publishing to PyPI is a release action under the project's own rules: **explicit authorization required**. Nothing above is started until that is given.

## 6. What this buys, and what it does not

- Publishing and a landing page remove the largest conversion loss. They do not create reach.
- The star-maximising loop is available, and it produces stars with weak usage (measured above). Say which goal you want, because optimising for the number and optimising for adoption are different plans after week 2.
- 100K remains a different-league outcome (top ~30 on GitHub, above Aider). 3,000–10,000 is what this mechanic set plausibly produces for a solo, unbacked project with a real launch.

---

## Sources

- GitHub REST API — repository metadata, creation dates, topics, release lists, 2026-10-28.
- npm registry download API — `@trailhq/trail-code`, `repomix`, `@upstash/context7-mcp`, last 30 days to 2026-10-26.
- PyPI stats API — `serena-agent`, last 30 days.
- PyPI JSON API — `repograph` 0.1, uploaded 2017-08-28.
- Hacker News Algolia API — story search for each project name, 2026-10-28.
- READMEs of `trailhq/Trail-Code`, `oraios/serena`, `yamadashy/repomix`, fetched 2026-10-28.
- trendshift.io repository page for `trailhq/Trail-Code`.

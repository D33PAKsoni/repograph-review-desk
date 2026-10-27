# Research evidence

Snapshot date: **2026-10-27**. All counts below come from the saved GitHub REST API responses in `research/evidence/`. They are timestamped observations, not quality judgments.

## Sources

| File | Method | What it contains |
| --- | --- | --- |
| `evidence/github_snapshot.json` | GitHub REST `/repos/{owner}/{repo}` | Fixed set of adjacent tools and ecosystems |
| `evidence/github_search.json` | GitHub repository search API | Five queries, top results per query |
| `evidence/github_mcp_landscape.json` | GitHub REST repo metadata | MCP/code-intelligence projects discovered during search |

Two requested repositories returned 404 and are recorded in `github_snapshot.json.errors`: `sourcegraph/sourcegraph` and `sourcegraph/cody`. The snapshot contains `scip-code/scip` instead of the old `sourcegraph/scip` path.

## Fixed snapshot

| Repository | Stars | Created | Last push | License | Description (truncated) |
| --- | ---: | --- | --- | --- | --- |
| `openai/codex` | 131,088 | 2025-04-13 | 2026-10-27 | Apache-2.0 | Lightweight coding agent that runs in your terminal |
| `sst/opencode` | 222,106 | 2025-04-30 | 2026-10-27 | MIT | The open source coding agent |
| `google-gemini/gemini-cli` | 108,564 | 2025-04-17 | 2026-10-27 | Apache-2.0 | Gemini-powered terminal agent |
| `Aider-AI/aider` | 49,770 | 2023-05-09 | 2026-05-22 | Apache-2.0 | AI pair programming in the terminal |
| `cline/cline` | 70,910 | 2024-07-06 | 2026-10-27 | Apache-2.0 | Autonomous coding agent (SDK/IDE/CLI) |
| `All-Hands-AI/OpenHands` | 91,970 | 2024-03-13 | 2026-10-27 | MIT | AI-driven development |
| `continuedev/continue` | 36,344 | 2023-05-24 | 2026-10-27 | Apache-2.0 | Open-source coding agent |
| `modelcontextprotocol/python-sdk` | 24,681 | 2024-09-24 | 2026-10-25 | MIT | Official Python SDK for MCP |
| `oraios/serena` | 30,747 | 2025-03-23 | 2026-10-26 | NOASSERTION | MCP toolkit for semantic retrieval/editing |
| `ast-grep/ast-grep` | 16,368 | 2022-07-01 | 2026-10-26 | MIT | Structural search/lint/rewrite |
| `tree-sitter/tree-sitter` | 27,291 | 2013-11-06 | 2026-10-27 | MIT | Incremental parsing system |
| `scip-code/scip` | 847 | 2022-05-10 | 2026-10-22 | Apache-2.0 | Code intelligence protocol |
| `github/codeql` | 10,252 | 2018-07-31 | 2026-10-26 | MIT | CodeQL libraries and queries |

## Search queries

Five queries were executed: `code intelligence mcp server`, `codebase graph mcp`, `repository context mcp`, `code graph rag`, `impact analysis code llm`.

Selected results with explicit impact/graph claims:

| Repository | Stars | Language | Claim from description |
| --- | ---: | --- | --- |
| `Graphify-Labs/graphify` | 136,425 | Python | Deterministic AST knowledge graph, "every edge explained", no vector store |
| `DeusData/codebase-memory-mcp` | 47,599 | C | Persistent code/docs/infra graph, "change-aware test selection" |
| `tirth8205/code-review-graph` | 32,419 | Python | Local-first code graph, "benchmarked context reductions" |
| `vitali87/code-graph-rag` | 5,287 | Python | Monorepo RAG with knowledge graphs |
| `fallow-rs/fallow` | 5,255 | Rust | TypeScript/JS health, boundaries, circular dependencies, unused code |
| `giancarloerra/SocratiCode` | 3,356 | TypeScript | "Symbol-level impact analysis & call-flow", 40M+ LOC claim |
| `zzet/gortex` | 1,920 | Go | 257 languages, graph, MCP/CLI/API, "100% local" |
| `aovestdipaperino/tokensave` | 679 | Rust | 40+ tools, 30+ languages, semantic knowledge graphs |
| `Cranot/roam-code` | 517 | Python | SQLite code graph, 28 languages, "change-safety gates", "audit evidence" |
| `SimplyLiz/ckb` | 111 | Go | Symbol navigation, impact analysis, architecture mapping |
| `0ximu/mu` | 70 | Rust | Semantic graph, BM25, impact analysis |
| `quantamixsol/graqle` | 32 | Python | Knowledge graph with "evidence + confidence" |
| `ArchiCore-Team/archicore` | 9 | TypeScript | 40+ languages, impact analysis, no LLM |

## Interpretation limits

- A GitHub description is marketing copy. It is not evidence that a feature exists, is correct, or is maintained.
- Star counts for very young repositories are unusually high in this snapshot (for example `Graphify-Labs/graphify`: 136,425 stars, created 2026-04-03). Record them as observed, not as adoption proof.
- The search API returns at most a small top slice per query. Popular or niche projects may be absent.
- No competitor was installed, run, or benchmarked for this research. Claims about their behavior are explicitly labeled as claims.
- No revenue, user, download, or retention data was collected.

## What is solid

1. The agent ecosystem is large and active (`openai/codex`, `sst/opencode`, `google-gemini/gemini-cli`, `cline/cline`, `OpenHands`, `continue`).
2. MCP is the common integration surface; the official Python SDK is mature enough to be a dependency.
3. Code intelligence for agents is crowded. Impact analysis, "every edge explained", change-aware test selection, evidence/confidence and local-first operation are all already claimed by multiple projects.
4. Static parsing is a proven foundation (`tree-sitter`, `ast-grep`, `CodeQL`, `SCIP`), and no single tool dominates all languages or all question types.

## What is not solid

- That RepoGraph's confidence model is better in practice than competitors.
- That users will pay for auditability or uncertainty reporting.
- That a Python implementation can compete on speed with Rust/Go tools at large repository sizes.
- That an MCP server alone is sufficient distribution.

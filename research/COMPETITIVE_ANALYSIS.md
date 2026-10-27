# Competitive analysis

**Evidence base:** GitHub descriptions and metadata captured 2026-10-27 in `research/evidence/`. No competitor was installed or benchmarked. Treat every competitor capability below as a *claim*, not a verified behavior.

## The field is crowded

The "code graph + MCP for agents" category already has many entrants across mainstream and niche ecosystems. Several overlap directly with RepoGraph's stated wedge:

| Competitor | Verified metadata | Claimed overlap |
| --- | --- | --- |
| Graphify | Python, Apache-2.0, 136k stars (snapshot) | Deterministic AST graph, every edge explained, no vector store |
| codebase-memory-mcp | C, MIT, 47.6k stars | Persistent graph, change-aware test selection |
| code-review-graph | Python, MIT, 32.4k stars | Local-first graph, review context reduction |
| SocratiCode | TypeScript, AGPL-3.0, 3.3k stars | Symbol-level impact analysis and call-flow |
| roam-code | Python, Apache-2.0, 517 stars | SQLite graph, change-safety gates, audit evidence, zero keys |
| ckb | Go, 111 stars | Impact analysis, architecture mapping, MCP/CLI/HTTP |
| mu | Rust, Apache-2.0, 70 stars | Semantic graph, BM25, impact analysis |
| graqle | Python, 32 stars | Impact analysis with "evidence + confidence" |
| CodeCortex | Python, Apache-2.0, 8 stars | Repository graph, impact analysis, guarded edits |
| fallow | Rust, MIT, 5.2k stars | TS/JS architecture boundaries, cycles, unused code |

"Evidence + confidence" and "impact analysis" are **not unique**. Any positioning that implies otherwise would be false.

## Adjacent, non-competing foundations

| Project | Role |
| --- | --- |
| tree-sitter | Incremental parsing. RepoGraph depends on it. |
| ast-grep | Structural search/rewrite. Complementary; not an index. |
| CodeQL | Semantic code database and query language. Much deeper, much heavier, different operational model. |
| SCIP | Code intelligence protocol/index format. A potential interoperability target, not a consumer product. |
| Serena | MCP semantic retrieval/editing toolkit. Overlaps on agent integration, not on RepoGraph's audit focus. |
| Sourcegraph (404 in snapshot) | Historical code intelligence platform; not evaluated here. |

## Honest comparison

### Where RepoGraph is weaker

- **Language coverage.** Three first-class languages versus claims of 28–371.
- **Maturity.** 0.1.0, no release history, no users, no ecosystem integrations.
- **Performance at scale.** Python + SQLite. Benchmarks stop at 1,223 files. Rust/Go competitors likely win on very large repositories, though this was not measured.
- **Search.** Lexical only. Competitors claim semantic/hybrid retrieval.
- **Distribution.** No install base, no marketplace listing, no benchmark reputation.
- **Feature breadth.** No call graph, no editing, no review automation, no semantic clustering.

### Where RepoGraph may be stronger

These are hypotheses, not proven advantages. Each needs a head-to-head test.

1. **Uncertainty is a first-class output, not a footnote.** Four confidence classes, separate unresolved/external classes, and structured `blind_spots` in every impact report.
2. **"No dependents" is explicitly not "safe."** The output states the limitation instead of returning an empty list.
3. **Auditable implementation.** ~1,900 statements of Python, one SQLite file, no embeddings, no LLM, no network. A reviewer can trace every edge to an extractor branch.
4. **Read-only by construction.** Indexing parses bytes; there is no write path to the analyzed repository.
5. **Low operational surface.** No API key, no server, no vector store, no background daemon.
6. **Diff-aware impact with evidence.** Git hunks map to symbols, and direct dependents cite file:line and method.

### What customers might actually buy

Not "a code graph." Maybe:

- A **CI change gate** that fails when a change touches a high-inbound file with no related test, and prints the blind spots.
- An **agent preflight** that forces the agent to read `blind_spots` before editing.
- A **review artifact** for regulated or safety-critical teams that need to show *why* a change was considered low-risk.
- A **teaching/debugging tool** that makes dependency cycles and layers visible.

No willingness-to-pay evidence exists for any of these.

## Positioning options

| Option | Upside | Risk |
| --- | --- | --- |
| Generic local code graph | Large market, familiar | Undifferentiated; outgunned on languages and speed |
| Auditable impact analysis | Distinct, defensible narrative | Buyers may not care; hard to prove superiority |
| CI change-safety gate | Clear workflow and value moment | Crowded; needs CI integrations and precision |
| Agent preflight / MCP policy | Fits agent wave | Depends on agent vendors; easy to copy |
| Polyglot index | Larger addressable use | Expensive; loses the small auditable surface |

**Recommendation:** validate the auditable-impact wedge with a precision/recall evaluation and 5–10 user interviews before expanding language coverage. If users do not value uncertainty or CI gating, do not compete on breadth; the current project has no advantage there.

## Kill criteria

Stop or pivot if, after validation:

- RepoGraph's import-edge precision is materially worse than a simple `grep`/language-server baseline on the labeled set.
- Users consistently prefer a faster polyglot tool even when RepoGraph surfaces blind spots.
- The six MCP tools do not change agent behavior in a measurable task.
- Maintaining Python/TS resolution consumes more effort than the wedge justifies.

# Decision log

Architecture and product decisions, newest context first. Status values: **accepted**, **provisional**, **revisit**.

---

## D-012 — Do not claim competitive uniqueness

**Date:** 2026-10-27 · **Status:** accepted

**Context:** Snapshot evidence shows many projects claiming graphs, impact analysis, evidence/confidence and change-aware tests.

**Decision:** Position around *auditable impact with explicit uncertainty*, and state that the category is crowded. Do not claim the approach is unique.

**Consequences:** Marketing is less punchy. Claims remain defensible. Validation must show an advantage, not assume one.

---

## D-011 — Report "no dependents" as a blind spot, not safety

**Date:** 2026-10-27 · **Status:** accepted

**Context:** An empty result is the most dangerous output of a dependency tool.

**Decision:** When a target has no static dependents, emit `no-static-dependents` with an explanation. Include global caveats in every impact response.

**Consequences:** More verbose output. Harder to misread as proof of safety.

---

## D-010 — Use four confidence classes plus separate external/unresolved kinds

**Date:** 2026-10-27 · **Status:** accepted

**Alternatives:** Single numeric score; binary resolved/unresolved; no confidence.

**Decision:** `confirmed`, `inferred`, `heuristic`, `unresolved`, with imports additionally classified as `static`, `dynamic`, `external`, `unresolved`. Store method and evidence location.

**Rationale:** Failure modes differ. A numeric score implies calibration that does not exist.

**Consequences:** Consumers must understand five labels. Calibration is still unmeasured (see `TECHNICAL_HYPOTHESIS.md`).

---

## D-009 — MCP SDK 2.3.0 with `MCPServer`

**Date:** 2026-10-27 · **Status:** accepted

**Context:** The installed SDK exposes `mcp.server.mcpserver.MCPServer`; `FastMCP` is not available in this version.

**Decision:** Use `MCPServer`, stdio by default, optional streamable HTTP, six tools.

**Consequences:** No auth in HTTP mode; documented. API is pinned to `mcp>=2.0,<3`.

---

## D-008 — No NetworkX; traverse in Python

**Date:** 2026-10-27 · **Status:** accepted

**Alternatives:** NetworkX; SQL recursive CTEs; a graph database.

**Decision:** Reverse-import BFS and iterative Kosaraju over SQLite edges.

**Rationale:** Avoid a dependency for a small graph; keep traversal auditable; avoid recursion limits.

**Consequences:** Reimplemented graph logic; adequate for measured sizes; unproven at very large scale.

---

## D-007 — SQLite single-file index, WAL mode

**Date:** 2026-10-27 · **Status:** accepted

**Alternatives:** JSON files; DuckDB; embedded graph DB; server database.

**Decision:** SQLite with bound parameters, WAL, foreign keys, per-file transactions.

**Consequences:** Easy local operation and inspection. No concurrent multi-writer story. Schema migration is manual.

---

## D-006 — Index source bytes; never execute repository code

**Date:** 2026-10-27 · **Status:** accepted

**Context:** Indexing untrusted repositories is a security boundary.

**Decision:** Read bytes, parse with tree-sitter, never import modules or run build tools. Enforce with a test that writes a file which would create a marker if executed.

**Consequences:** Lower precision than compiler/LSP analysis. Smaller attack surface. Some projects cannot be fully analyzed without build-time generation.

---

## D-005 — Static-only import resolution

**Date:** 2026-10-27 · **Status:** accepted, revisit

**Alternatives:** Execute imports; use language servers; ask an LLM.

**Decision:** Resolve static forms; classify dynamic/external/unresolved honestly. No runtime target discovery.

**Consequences:** Known blind spots. Deterministic, offline, auditable. Revisit if edge accuracy blocks the wedge.

---

## D-004 — Initial languages: Python, TypeScript, JavaScript (+TSX/JSX, Prisma models)

**Date:** 2026-10-27 · **Status:** provisional

**Rationale:** Covers common agent-assisted backend/web work; tree-sitter grammars are mature.

**Consequences:** Polyglot repositories are incomplete. CommonJS extraction is weak. Language breadth is a roadmap item, not a current strength.

**Revisit:** After validation, if target users need Go/Java/Rust on their primary repository.

---

## D-003 — Local-first, no API keys, no cloud

**Date:** 2026-10-27 · **Status:** accepted

**Rationale:** Privacy, reproducibility, low operational cost, differentiation against cloud/semantic tools.

**Consequences:** No semantic search, no hosted distribution, no usage telemetry. Users bring their own agent.

---

## D-002 — Apache-2.0 license

**Date:** 2026-10-27 · **Status:** accepted

**Alternatives:** MIT; AGPL; source-available.

**Rationale:** Permissive, patent grant, compatible with commercial adoption and most agent ecosystems.

**Consequences:** Competitors can reuse the code. That is acceptable for an infrastructure tool.

---

## D-001 — Build a repository intelligence engine for agents

**Date:** 2026-10-27 · **Status:** accepted, under validation

**Context:** Agent adoption is broad; MCP is the integration surface; the code-graph category is crowded.

**Decision:** Build a local-first index with six read-only MCP tools, focused on evidence-backed impact analysis.

**Consequences:** Success depends on a differentiated wedge that is not yet proven. See `OPPORTUNITY_ANALYSIS.md` for go/no-go criteria.

---

## D-004 — Measure edge accuracy before broadening scope

**Date:** 2026-10-27 · **Status:** accepted, first measurement complete

**Context:** The alpha had speed benchmarks but no accuracy data. A code graph that is fast and wrong is worse than no graph.

**Decision:** Pre-register an edge-accuracy protocol, label samples with two independent agents, fix measured defects before launch claims, and hold out unseen repositories for the final number. Prefer source entries over unbuilt publish shims for workspace packages.

**Consequences:** The final test measured 150/150 correct resolved edges and 94.3% estimated recall. Residual gaps are Python `tests/`/`examples/` import roots, Node `#imports`, JSON/config assets, conditional `exports`, and non-code assets. Language breadth is deferred until those gaps and agent-behavior validation are addressed.

# Opportunity analysis

## What the evidence supports

1. **Agent adoption is broad.** The snapshot includes six agent projects with 36k–222k stars, all active within days of the snapshot.
2. **MCP is the integration layer.** The official Python SDK has ~24.7k stars and recent pushes. Multiple code-intelligence projects ship MCP servers.
3. **The code-graph niche is saturated at the generic level.** At least a dozen projects claim repository graphs, impact analysis, or change-aware tests, across Python, Rust, Go, TypeScript, Zig and C.
4. **Static parsing is commoditized.** tree-sitter and ast-grep are mature; CodeQL and SCIP exist for deeper or standardized analysis.
5. **Differentiation is not established.** RepoGraph's confidence/blind-spot design resembles claims already made by `graqle` ("evidence + confidence"), `Graphify` ("every edge explained") and `roam-code` ("audit evidence"), among others.

## The gap RepoGraph can plausibly target

Not "understand the codebase." That is crowded and vaguely defined.

A narrower job:

> *Before an agent or developer changes a file, show what statically depends on it, how each relationship was established, and what the analysis cannot see — in a form that can be attached to a review or CI gate.*

This is a **decision-support** job, not a retrieval job. It has a clear output, a clear failure mode, and a natural buyer: teams that already use coding agents and are nervous about unreviewed edits.

### Who feels this pain most

- Platform/DevEx teams rolling out coding agents across many repositories.
- Teams with high-blast-radius code (payments, auth, data migrations) where "the agent changed one file" is not reassuring.
- Regulated or safety-critical teams that need an auditable rationale, not a chat transcript.
- Open-source maintainers reviewing agent-generated PRs.

### Why current tools may not satisfy them

- Chat-based retrieval gives an answer without provenance.
- Generic graphs show edges but not uncertainty or blind spots.
- Semantic search is good at "find relevant code," not "prove what depends on this."
- Language servers are precise but operationally heavy and language-specific.
- Review bots comment on diffs but often lack a repository-wide dependency model.

Each of these is a hypothesis. No interviews have been conducted.

## Wedge options

| Wedge | Output | Adoption path | Evidence needed |
| --- | --- | --- | --- |
| CI change gate | Pass/fail plus evidence report | GitHub Action / pre-commit | Precision high enough not to block merges falsely |
| Agent preflight | Structured impact + blind spots before edit | MCP config | Measurable change in agent behavior |
| Review artifact | Markdown/SARIF impact report | PR comment | Reviewers find it useful |
| Local audit CLI | JSON report | Direct install | Users run it more than once |

The CI gate has the clearest value moment but the highest precision bar. The agent preflight has the lowest integration cost but depends on agent vendors and may add context without changing behavior. Start with the CLI/MCP report, validate, then productize the gate.

## Distribution

- **MCP directories and agent docs.** Low cost, crowded.
- **GitHub Action / pre-commit.** Natural for the CI wedge.
- **Benchmarks and reproducible evaluation.** Credible only if methodology and failures are published.
- **Design-partner interviews.** Needed before language expansion.
- **Open-source launch.** Necessary but not sufficient; the category already has loud projects.

No distribution advantage exists today.

## Risks

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Category too crowded | High | Narrow to auditable impact; do not compete on breadth |
| Users do not value uncertainty | Medium–high | Test with interviews and task evals; be willing to pivot |
| Precision too low for CI | High initially | Labeled evaluation; start advisory, not blocking |
| Python performance at scale | Medium | Measure; add caching/parallelism only if needed |
| Agent vendors build it in | Medium | Stay local and tool-agnostic; integrate rather than compete |
| Maintenance of per-language resolution | High | Limit languages; consider SCIP/tree-sitter query packs |
| Trust/safety incident | Low–medium | Read-only design, no code execution, security policy |

## Go / no-go

Proceed to validation, not to a broad launch.

Go if:

- A labeled evaluation shows import-edge precision high enough for advisory impact reports.
- At least a few target users describe the blind-spot report as useful.
- The MCP tools measurably affect an agent task without unacceptable context cost.

No-go or re-scope if:

- A simpler language-server or grep baseline matches the impact results.
- Users want semantic search and do not care about provenance.
- Maintaining three languages already exceeds the value of the wedge.

## Honest bottom line

The market is large and active, but RepoGraph has no proven advantage. The only defensible path is a narrow, measurable claim: **auditable change impact with explicit uncertainty**. That claim must be tested against real repositories and real users before adding languages or features.

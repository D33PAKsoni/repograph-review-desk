# Technical landscape

This document separates established technical facts from project-specific choices. RepoGraph's own measurements are in `benchmarks/results/`.

## Parsing approaches

| Approach | Strength | Cost | RepoGraph position |
| --- | --- | --- | --- |
| Regex/grep | Trivial, fast | No structure; false positives | Not used |
| tree-sitter | Incremental, error-tolerant, many grammars, MIT | Syntax only; no types | Used |
| Language server / compiler API | Types, symbols, references | Per-language toolchain, build setup, execution risk | Not used |
| CodeQL | Deep semantic database and queries | Heavy extraction, CodeQL language, licensing/ops | Not used |
| SCIP | Standard code-intelligence index | Requires per-language indexers | Not used; future interoperability |
| AST + heuristics | Fast, explainable | Resolution gaps | Used |

tree-sitter's error recovery is why RepoGraph can index a repository with a broken file. The same property means a syntactically valid but semantically wrong file produces plausible-looking edges. Confidence labels and blind spots are the mitigation.

## Why not a language server?

An LSP would improve Python and TypeScript precision, but it introduces:

- a per-language installation and version matrix;
- project build/configuration requirements;
- long-running processes and resource use;
- the temptation to execute project code or plugins;
- harder reproducibility for a local-first CLI.

RepoGraph favors a deterministic byte-in/index-out pipeline. This is a deliberate trade: lower precision, much smaller audit surface. It is not universally better. A future `--lsp` backend could be added without changing the evidence schema.

## Graph storage

SQLite in WAL mode is used because:

- single-file, local, inspectable;
- transactional per-file updates;
- indexed lookups for names, files and edge targets;
- no server or additional dependency;
- adequate for the measured repository sizes.

It is not a graph database. Traversal is implemented in Python:

- reverse-import BFS for impact;
- iterative Kosaraju for cycles;
- dictionary-based inbound/outbound counts for architecture.

At 1,223 files and ~1,900 internal imports (FastAPI), impact completes in ~82 ms on the benchmark machine. This says nothing about 100k-file monorepos.

## Reference resolution

Static resolution is the hardest part and the main source of error.

**Python** has dynamic imports, conditional imports, namespace packages, `sys.path` manipulation, metaclasses and decorators. RepoGraph handles the common static forms and labels the rest. A missing edge is more dangerous than an extra edge for impact analysis, so unresolved imports are retained and reported rather than guessed.

**TypeScript/JavaScript** has path aliases, workspace packages, conditional exports, bundler resolution, `export *`, CommonJS interop and dynamic `import()`. RepoGraph reads `tsconfig`/`jsconfig` and workspace `package.json` names. Bundler-specific behavior is out of scope.

**CommonJS** is a demonstrated weakness. Express yielded 63 symbols for 142 JavaScript files. Function-expression exports and prototype assignments are not extracted well. This is documented, not hidden.

## Confidence taxonomy

| Class | Basis | Failure mode |
| --- | --- | --- |
| `confirmed` | Direct syntax within the file or a statically resolved import binding | A shadowed/reassigned name can still fool it |
| `inferred` | Project convention or module-object attribute | Alias or runtime rebinding can break it |
| `heuristic` | Pattern match (routes, model bases, tests) | Framework variation causes false positives/negatives |
| `unresolved` | Attempted but no target | Edge is missing from traversal |
| `external` | Outside the repository | Consumer behavior unknown |

This taxonomy is more useful than a single numeric score because the failure modes differ. It is also harder to consume; agents may ignore the labels.

## Agent integration

MCP is the de facto integration surface in the snapshot. The official Python SDK (`mcp`) is used at `2.3.0`, with `MCPServer` from `mcp.server.mcpserver`. Six tools keep the interface small enough to evaluate.

Trade-offs:

- MCP tool output is text/JSON; large graphs consume context. RepoGraph caps lists and depth.
- The server is read-only; agents still need their own edit tools.
- There is no authentication in HTTP mode. Stdio is the default.
- Tool errors are returned as data, so a bad path does not kill the session.

## Competitive technical claims

Descriptions in the snapshot claim: 28–371 languages, semantic/hybrid search, call graphs, change-aware tests, "every edge explained", evidence + confidence, and 40M+ LOC scale. None were independently verified.

What can be said safely:

- Multi-language coverage and Rust/Go implementations are plausible advantages at scale.
- Semantic retrieval solves a different question (intent) than RepoGraph's impact question.
- "Every edge explained" is a design claim; the quality of explanations is not observable from metadata.
- A small Python implementation is unlikely to win a raw-speed contest. It can win on auditability and install simplicity if users value those.

## Open technical questions

1. What is the import-edge precision/recall on a labeled multi-language corpus?
2. How often do dynamic/reflective edges change impact conclusions in real repositories?
3. Does explicit uncertainty change agent behavior or only add tokens?
4. At what repository size does SQLite + Python traversal become unacceptable?
5. Can tree-sitter queries replace per-language Python extraction without losing evidence quality?

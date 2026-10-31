# RepoGraph Review Desk — System Architecture

RepoGraph Review Desk is an automated, evidence-backed code review companion and visualization suite. It maps repository impact deterministically and synthesizes code review briefings using Google Gemma 4 (via Google Gemini API), presenting an interactive, accessible dashboard deployable to Cloudways by DigitalOcean.

---

## Architecture Overview

```mermaid
flowchart TB
  subgraph Analysis[Offline / Pipeline Analysis Engine]
    Repo[Pinned Repository Baseline] --> Parser[RepoGraph AST Indexer: Tree-sitter & SQLite]
    Parser --> Impact[Impact & Blast Radius Computation]
    Repo --> Graphify[Graphify Architecture Bridge]
    Impact --> Bundle[Validated Artifact Bundle: artifact-bundle.json]
    Graphify --> Bundle
  end

  subgraph Service[AI Briefing & Review Service]
    Bundle --> Loader[Artifact Loader & Schema Validator]
    Loader --> API[Node.js API Server: /api/v1/]
    API --> Gemma[Gemma 4 Multimodal / Text Reasoning via Gemini API]
    Gemma --> EvidenceCheck[Evidence & Limitation Verifier]
    EvidenceCheck --> Formatter[Structured Review Briefing & Markdown Checklist]
  end

  subgraph UI[Interactive Review Dashboard]
    Formatter --> Web[React / TypeScript / Vite Dashboard]
    Web --> GraphView[Architecture & Blast Radius Visualizer]
    Web --> CitationNav[Direct Source Anchor Citations]
    Web --> MarkdownExport[Actionable Checklist Export]
  end

  subgraph Infra[Production Deployment]
    API --> Cloudways[Cloudways by DigitalOcean]
    Web --> Cloudways
  end
```

---

## Functional Layers

### 1. Analysis Engine (`analysis/`)
- **AST Parsing**: Multi-language Tree-sitter grammars (Python, JS/TS, Go, Rust) create SQLite indexes of symbol declarations, calls, imports, and definitions.
- **Impact Computation**: Computes exact blast radii for changed files via reverse dependency graph traversal.
- **Graphify Bridge**: Generates standardized architectural relationships (`graphify` nodes and links) to provide high-level contextual awareness.
- **Artifact Bundle**: Emits immutable, schema-validated bundles (`contracts/artifact-bundle.schema.json`) detailing cases, static citations, and blind spots.

### 2. Briefing Service (`service/`)
- **Schema Contracts**: Strictly enforces input/output schema conformity (`contracts/briefing.schema.json`).
- **Gemma 4 Reasoning**: Connects with `gemma-4-26b-a4b-it` or `gemma-4-31b-it` to analyze change intent against verified static dependencies.
- **Citation Guardrails**: Enforces that all assertions cite verified evidence IDs and all caveats/limitations are preserved verbatim.
- **Markdown Generator**: Compiles downloadable, Markdown review checklists with repository line-anchor links.

### 3. Review Desk Dashboard (`web/`)
- **Frontend Stack**: React 18, TypeScript, and Vite with zero external UI bloat.
- **Scenario Explorer**: Enables reviewers to browse affected modules and dependency blast radii.
- **Source Linkage**: Links every piece of evidence directly to immutable GitHub commit anchors.
- **Accessibility & Responsiveness**: 100% automated accessibility compliance tested via Axe and Playwright across mobile and desktop viewports.

### 4. Infrastructure & Deployment (`deployment/`)
- **Cloudways Deployment**: Full automation and runbooks for automated git-based deployment to Cloudways by DigitalOcean.
- **Preflight & Verification**: Integrated test suites for offline verification, schema validation, and health checks.

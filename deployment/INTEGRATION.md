# Module Integration Checklist

Review Desk adheres to strict interface separation between the Analysis Engine, Briefing Service, and Dashboard UI.

## Integration Checkpoints

### 1. Analysis Engine (`analysis/`)
- [x] Deterministic AST parsing via Tree-sitter and SQLite.
- [x] Real dependency traversal via `repograph.impact.analyze_impact()`.
- [x] Schema-compliant bundle generation (`data/production/artifact-bundle.json`).
- [x] Pinned GitHub source anchors with exact line numbers.

### 2. Briefing Service (`service/`)
- [x] Implement `createApiHandler` matching frozen integration contracts.
- [x] Input validation for all `/api/v1/` routes.
- [x] Integration with Google Gemma 4 models (`gemma-4-26b-a4b-it` / `gemma-4-31b-it`).
- [x] Verbatim preservation of all caveats, limitations, and blind spots.

### 3. Review Desk Web Dashboard (`web/`)
- [x] React 18, TypeScript, and Vite with zero external UI bloat.
- [x] Accessible navigation tested across desktop and mobile viewports.
- [x] Interactive scenario selector and source citation navigation.
- [x] One-click Markdown review checklist export.

### 4. Production Deployment (`deployment/`)
- [x] Preflight checks passing for mock and production modes.
- [x] Cloudways deployment automation scripts and runbook.

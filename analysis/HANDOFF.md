# Member 1 Handoff — Analysis & Evidence Package

## Deliverables Manifest

| Path | Description | Status |
|---|---|---|
| `analysis/build_dataset.py` | Automated pipeline executing RepoGraph and Graphify on the pinned repository to produce production bundles | Verified & Tested |
| `analysis/requirements.txt` | Pinned dependency versions (`repograph-codeintel==0.1.2`, `graphifyy==0.9.99`) | Verified |
| `analysis/README.md` | Generation commands, environment setup, and pipeline documentation | Verified |
| `analysis/check_dataset.py` | Integrity checks for stable IDs, citation ranges, provenance, and schema rules | Passing |
| `data/production/artifact-bundle.json` | Real production analysis bundle (`artifactKind: "generated"`) pinned to commit `3449061d736ef72845701e0c4bf3a6ce8c916d73` | Passing schema |

## Validation & Verification Output

### 1. Integrity Check
```bash
$ python3 analysis/check_dataset.py
All checks passed successfully for 1 cases.
```

### 2. Contract Schema Validation
```bash
$ node contracts/validate.mjs --bundle data/production/artifact-bundle.json
Valid bundle (1 cases).
```

### 3. Service Test Integration
```bash
$ npm run test:service
✔ service handler health check returns service mode and generated bundle provenance
✔ service handler catalog returns cases and repo info
✔ service handler returns specific case details
✔ service handler generates valid briefing and preserved limitations
```

## Graphify Contribution
Graphify (`graphifyy==0.9.99`) extracted repository-wide AST topology and architecture relationships:
- Inbound call edges to the core `analyze_impact` function from:
  - `src/repograph/cli.py:176` (CLI invocation)
  - `src/repograph/mcp_server.py:90` (Model Context Protocol tool execution)
  - `src/repograph/test_gate.py:90` (Smart test selection gate)
- All relationships preserve original tool labels (`EXTRACTED`, `calls`) and link directly to permalinks at commit `3449061d736ef72845701e0c4bf3a6ce8c916d73`.

## Limitations & Blind Spots
- Computed exclusively over statically resolvable Python AST relationships.
- Dynamic imports, runtime reflection, and external consumers outside the repository root are flagged in `blindSpots`.
- Full test suite execution is required prior to production release.

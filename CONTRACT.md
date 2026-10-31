# System Integration Contract — v1.0.0

This specification establishes the interface contracts between the Analysis Pipeline, the Briefing Service, and the Review Desk UI. All timestamps are UTC ISO 8601.

## Scope and Module Boundaries

The system evaluates impact scenarios across target repositories: "what might depend on this file if it changes". Generated evidence artifacts and live AI inference are cleanly decoupled.

| Boundary | Provider Module | Consumer Module | Interface Deliverable |
|---|---|---|---|
| Analysis → Service | Analysis Engine (`analysis/`) | Briefing Service (`service/`) | `data/production/artifact-bundle.json` matching `contracts/artifact-bundle.schema.json`. |
| Service → Launcher | Briefing Service (`service/`) | Application Launcher (`bootstrap/server.mjs`) | `export async function createApiHandler(context)` returning an async Node `(req, res) => void` handler. |
| UI → Launcher | Review Desk Web (`web/`) | Application Launcher (`bootstrap/server.mjs`) | Built static assets in `web/dist/`; all API requests use relative `/api/v1/...` URLs. |

The launcher context is `{projectRoot, bundlePath}`; both values are absolute paths. The handler factory loads and validates the bundle before resolving. It owns every `/api/` response, including unknown routes. It returns only after ending the response and catches request-level failures. The launcher owns listening on `0.0.0.0`, `PORT`, static assets, and startup failure.

## Starter commands: Node.js 22 or 24, no npm install needed

From the handoff root:

```powershell
node contracts/validate.mjs --bundle fixtures/artifact-bundle.fixture.json
node contracts/validate.mjs --bundle fixtures/artifact-bundle.fixture.json --briefing fixtures/briefing.fixture.json
node --test bootstrap/starter.test.mjs
node bootstrap/server.mjs
```

Open `http://localhost:3000`. Before `web/dist` exists, the launcher displays a clearly labeled placeholder. The mock API implements the exact endpoints below. Fixtures are deliberately synthetic and have no real GitHub source links. They cannot be used as final sponsor evidence.

## Artifact bundle

Authoritative shape: `contracts/artifact-bundle.schema.json`. Working example: `fixtures/artifact-bundle.fixture.json`.

```text
schemaVersion: "1.0.0"
artifactKind: "fixture" | "generated"
repository: {id, name, url, commitSha}
generatedAt: ISO timestamp
tools: [{name: "repograph" | "graphify", version, mode}]
cases: [{id, title, scenarioType: "file-impact", changedFiles,
         impact: {directDependents, transitiveDependents, relatedTests, blindSpots},
         architecture: {summary, contextText, evidenceIds}, evidence, limitations}]
```

Each dependent or test is `{path, evidenceIds}`. Each evidence record is `{id, producer, confidence, relation, path, startLine, endLine, excerpt, sourceUrl}`. Confidence is the **original tool label**, not a shared risk score: RepoGraph uses `confirmed`, `inferred`, `heuristic`, `unresolved`, `external`; Graphify uses `EXTRACTED`, `INFERRED`, `AMBIGUOUS`. Do not convert between them. A generated bundle's `sourceUrl` points to the evidence path and lines at `repository.commitSha`. A fixture uses `sourceUrl: null`.

All evidence references resolve within their case. Case IDs are unique within the bundle; evidence IDs are unique within a case and remain stable across rebuilds of the same input. Paths are repository-relative POSIX paths without traversal or absolute prefixes. Line ranges start at 1. Source excerpts and graph context are bounded; omitted/unlocated graph nodes must be disclosed rather than assigned invented source lines.

Graphify context must reference at least one Graphify evidence record for the main generated demo case. RepoGraph impact entries reference RepoGraph evidence. An empty case may contain no evidence and an empty architecture context. `limitations` always includes the static-analysis caveat and the need to run the full test suite. Preserve additional tool blind spots and partial-analysis warnings.

## HTTP endpoints

Success: `{"schemaVersion":"1.0.0","data":...}`. Error: `{"schemaVersion":"1.0.0","error":{"code":"...","message":"...","retryable":false}}`. Set `Content-Type: application/json; charset=utf-8`; do not return HTML for `/api/` errors.

| Method and route | Request | `data` on success |
|---|---|---|
| `GET /api/v1/health` | None | `{status:"ok", apiMode:"mock"|"service", aiMode:"fixture"|"live", artifactKind, gemmaConfigured:boolean}`. No inference call. |
| `GET /api/v1/catalog` | None | `{repository, artifactKind, generatedAt, tools, cases:[{id,title,changedFiles}]}`. |
| `GET /api/v1/cases/:caseId` | An allowlisted case ID | `{repository, artifactKind, generatedAt, tools, case}`. |
| `POST /api/v1/briefings` | `{caseId, changeIntent?}` | A validated briefing matching `contracts/briefing.schema.json`. |

`changeIntent` is optional plain text, at most 500 characters. It describes the reviewer's intention within the selected scenario; it never turns the prepared snapshot into actual patch analysis. The request body is at most 8 KiB. Reject unknown input fields, unsupported media types, invalid JSON, and unsupported case IDs. Clients never submit evidence, model choices, secrets, repository URLs, or filesystem paths.

## Briefing

Required fields: `schemaVersion`, `artifactKind`, `repositoryId`, `commitSha`, `caseId`, `mode`, `model`, `summary`, `findings`, `reviewChecklist`, `limitations`, `generatedAt`, `markdown`.

- `artifactKind` describes the analysis data: `fixture` or `generated`.
- `mode` describes inference: `fixture` or `live`. These dimensions are independent. A live model call over fixture data is still fixture data.
- Fixture mode uses `model: null`; live mode names the actual Gemma model. Never label canned output as live or silently substitute it after provider failure.
- Findings are `{text, evidenceIds}` with at least one valid evidence ID. Checklist items have the same shape but may use an empty ID list for a general action such as running the full suite.
- The model may cite only supplied evidence IDs. It may not invent paths, source URLs, measured benefits, confidence upgrades, or a safety verdict.
- The service constructs identity/provenance fields and Markdown. It preserves every case limitation and blind spot even when the model omits them. URLs in Markdown come only from artifact evidence; escape user/model text.
- No usable evidence → `422 INSUFFICIENT_EVIDENCE`, without calling the model.

## Error behavior

| HTTP | Code | Retryable | Meaning |
|---|---|---|---|
| 400 | `INVALID_REQUEST` | false | Invalid JSON, field, intent length, or query. |
| 404 | `NOT_FOUND` | false | Unknown API route or case. |
| 413 | `PAYLOAD_TOO_LARGE` | false | Body exceeds 8 KiB. |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | false | POST is not JSON. |
| 422 | `INSUFFICIENT_EVIDENCE` | false | Selected case has no usable evidence. |
| 429 | `RATE_LIMITED` | true | Local inference limit or provider throttling. |
| 502 | `INVALID_MODEL_OUTPUT` | true | No candidate, malformed result, invalid citation, or truncated response. |
| 503 | `MODEL_UNAVAILABLE` | true | Provider unavailable or live-mode credentials unusable. |
| 504 | `MODEL_TIMEOUT` | true | Provider exceeded the bounded deadline. |
| 500 | `INTERNAL_ERROR` | false | Unexpected request failure; log a safe diagnostic server-side. |

Mock-only controls: append `?mock=timeout`, `?mock=rate-limit`, or `?mock=invalid-response` to the briefing route to receive the corresponding error immediately; `?delayMs=1200` simulates loading (maximum 2 seconds). The real service rejects these test-only query controls. Empty and partial cases are in the supplied catalog.

## Environment variables

| Variable | Owner | Default / meaning |
|---|---|---|
| `PORT` | Launcher/platform | `3000` locally; honor Cloudways-provided value. |
| `WEB_DIST` | Launcher / Member 3 | `web/dist`, relative to project root. |
| `API_HANDLER_MODULE` | Launcher / Member 3 | Unset = supplied mock; `service/api-handler.mjs` = Member 2 implementation. |
| `ARTIFACT_BUNDLE` | Launcher / Member 3 | `fixtures/artifact-bundle.fixture.json`; switch to `data/production/artifact-bundle.json` at integration. |
| `AI_MODE` | Member 2 | `fixture` or `live`; explicit live setting required for sponsor demo. |
| `GEMMA_API_KEY` | Member 2 / platform secret | Server only; never in `VITE_*`, Git, screenshots, or logs. |
| `GEMMA_MODEL` | Member 2 | `gemma-4-26b-a4b-it`, verified using the team's account. |

Local launcher reads process environment, not `.env` automatically. Use Node `--env-file` with a private file when desired. `.env.example` contains placeholders only. Vite development should proxy `/api` to `http://127.0.0.1:3000` so the browser always uses relative URLs. Final hosting is one Node application serving API and frontend assets on the same origin.

## Integration and change policy

Member 1 delivers the production bundle at its fixed path. Member 2 delivers the handler module with the fixed factory signature. Member 3 delivers `web/dist` and switches the two launcher variables. Each member proves their own output against the supplied fixtures before handoff. Successful fixture checks establish compatibility, not complete production readiness: the team still performs the scheduled real-data/live-model/public-URL smoke test.

If a member finishes late, others continue against the supplied fixtures or mock. The final submission must honestly identify any component still simulated. No incompatible contract change during Phase 1; reduce scope instead.

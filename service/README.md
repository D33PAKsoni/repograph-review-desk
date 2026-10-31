# Member 2 service: API and Gemma briefing

Node.js 22/24, no npm install, no framework. Run all commands from the project root (the folder containing `contracts/` and `fixtures/`).

## Run offline tests (no key, no internet)
    node --test service/tests/api.test.mjs

## Contract checks
    node contracts/validate.mjs --bundle fixtures/artifact-bundle.fixture.json --briefing fixtures/briefing.fixture.json

## Run the API alone (fixture mode, port 3001)
    node service/standalone.mjs
    curl.exe http://127.0.0.1:3001/api/v1/health

## Run with the shared launcher
    $env:API_HANDLER_MODULE="service/api-handler.mjs"; $env:AI_MODE="fixture"; node bootstrap/server.mjs

## Live Gemma mode
1. Copy `service/.env.example` to `service/.env` and set `AI_MODE=live` and `GEMMA_API_KEY=...` (never commit it; `.env` is git-ignored).
2. `node --env-file=service/.env service/standalone.mjs`
3. `curl.exe -X POST http://127.0.0.1:3001/api/v1/briefings -H "Content-Type: application/json" -d "{\"caseId\":\"subscription-change\"}"`

## Final integration settings
    API_HANDLER_MODULE=service/api-handler.mjs
    ARTIFACT_BUNDLE=data/production/artifact-bundle.json
    AI_MODE=live
    GEMMA_MODEL=gemma-4-26b-a4b-it
    GEMMA_API_KEY=<platform secret>

## Behavior notes
- `artifactKind` (analysis data) and `mode` (inference) are independent. Fixture mode returns `model: null` and a deterministic briefing built only from the selected case (`generatedAt` = bundle time).
- Live mode never falls back to fixture output. Failures map to the contract error table. At most 2 provider calls within one 30 s deadline (a transient retry OR one repair, never both). Local limit: 2 concurrent, 20 per minute.
- Identity, provenance, limitations and Markdown are built by the service. The model supplies only summary, findings and checklist, with citations restricted to supplied evidence IDs.
- Clients may send only `{caseId, changeIntent?}`; query strings (including mock controls) are rejected.
- Model text is plain text. The frontend must render `summary`, `findings` and `reviewChecklist` as text, not HTML.

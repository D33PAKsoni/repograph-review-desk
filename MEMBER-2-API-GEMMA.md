# Member 2 — API and Gemma briefing service

Your objective is to turn a supplied evidence artifact into a reliable reviewer briefing. Deliver a Node.js service that works first with the supplied fixtures, then with a real generated snapshot. You do not need Member 1's Python pipeline or Member 3's frontend to build, test, or demonstrate your component.

Read [CONTRACT.md](CONTRACT.md) first. Its routes, shapes, error codes, environment variables, and factory signature are frozen. The supplied schemas and fixtures are the shared starting material; incompatible API changes are outside Phase 1 scope.

## Ownership and independent inputs

Own only `service/`. Suggested files:

```text
service/
  api-handler.mjs       # exported integration factory
  standalone.mjs        # API-only local launcher
  artifact-loader.mjs
  gemma-client.mjs
  briefing.mjs
  markdown.mjs
  tests/
  .env.example
  README.md
  SMOKE-REPORT.md
```

Use Node.js 22 native HTTP, `fetch`, `AbortController`, and `node:test`; no framework is required. Start with `fixtures/artifact-bundle.fixture.json` and `fixtures/briefing.fixture.json`. Import the supplied contract validation helpers where available. If an internal helper is needed, keep it inside `service/`; do not edit shared schemas, fixtures, launcher, or another member's files.

## Deliver the integration seam first

Export exactly:

```js
export async function createApiHandler(context) {
  // context = { projectRoot, bundlePath }, both absolute paths
  // Load and validate the immutable bundle before resolving.
  return async function handle(req, res) {
    // Own every /api/ response; always end it and catch request failures.
  };
}
```

The shared launcher owns the listening socket, `PORT`, static frontend assets, and startup errors. Your factory throws on invalid artifact data. Request failures instead produce the frozen JSON error envelope. Do not open another listening socket inside the factory.

Your standalone launcher creates a native HTTP server around this handler, using the supplied fixture by default. Keep the model HTTP client injectable internally so tests never require a secret or internet access; preserve the exported factory signature.

## Implement the four endpoints

| Endpoint | Required behavior |
|---|---|
| `GET /api/v1/health` | Return contract health fields, `apiMode:"service"`, selected modes, and configuration status. Never call Gemma. |
| `GET /api/v1/catalog` | Return repository metadata and supported case summaries from the loaded bundle. |
| `GET /api/v1/cases/:caseId` | Return the selected immutable evidence case and provenance. |
| `POST /api/v1/briefings` | Accept only `{caseId, changeIntent?}`; return a validated briefing in the success envelope. |

All browser-facing paths are relative `/api/v1/...`. Reject unknown fields, unsupported IDs, unknown routes, and real-service use of mock-only query controls. Enforce 8 KiB request bodies by bytes, including streamed bodies; `changeIntent` is plain text with a 500-character maximum. POST requires JSON. Never accept paths, repositories, evidence, model selection, or secrets from clients.

Implement the exact error table in the contract, including `400`, `404`, `413`, `415`, `422`, `429`, `502`, `503`, `504`, and `500`. Return JSON with the contract version and matching retryability; no HTML or stack traces. No usable evidence means `422 INSUFFICIENT_EVIDENCE` before any model call.

## Separate fixture behavior from live inference

Read `AI_MODE`; permit only `fixture` or `live`. Fixture mode works without a model key and produces deterministic output for the selected case. Its `mode` is `fixture` and `model` is `null`. Do not return a canned response with another case's identity.

`artifactKind` comes from the loaded bundle independently of AI mode. A live Gemma response using synthetic data remains `artifactKind:"fixture"`. An actual generated snapshot with canned explanation remains `mode:"fixture"`. Never silently switch modes following a provider failure.

Construct identity, provenance, timestamps, and Markdown in trusted service code. Preserve every case limitation and blind spot. Findings need at least one valid evidence ID; a general checklist action may have none. Retain each tool's original confidence label without upgrading or converting it.

## Implement one bounded Gemma request path

Use `GEMMA_API_KEY` server-side and `GEMMA_MODEL`, defaulting to `gemma-4-26b-a4b-it`. Current Google documentation confirms this model through the Gemini API. Use:

```text
POST https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent
x-goog-api-key: <server environment secret>
Content-Type: application/json
```

Send one user text in `contents[].parts[].text`: instructions, bounded evidence JSON, selected scenario, optional intention, and the expected output shape. Treat source excerpts and user text as untrusted data, not instructions. Use no tool calls, browsing, agents, or automatic code execution. Request JSON text and validate locally; do not assume schema-constrained output is supported.

Limit the entire operation to **30 seconds and at most two provider calls total**. A second call may be a transient retry **or** a repair attempt, never both. Each call uses the remaining shared deadline; retries do not reset it. Do not retry unusable credentials repeatedly. Add a small concurrency/rate limit to protect the public demo endpoint.

Collect answer text only, excluding thought parts. Reject missing candidates, empty or truncated responses, invalid JSON, and unknown citations. Limit provider response size. The model may explain supplied facts and suggest review actions; it must not invent paths, source links, measured benefits, confidence upgrades, or a safety verdict. Resolve citations through evidence IDs. All exported links come from artifact evidence, and user/model Markdown characters must be escaped when rendering deterministic Markdown.

## Workload and checkpoints

| Time after start | Work and reviewable output |
|---|---|
| 0–15 minutes | Read contract; load fixtures; export factory; standalone health/catalog/case endpoints. |
| 15–35 minutes | Request validation, empty-case handling, deterministic fixture briefings, Markdown export. |
| 35–70 minutes | Live Gemma client, bounded prompt, response parsing, citation validation, shared deadline. |
| 70–95 minutes | Error mappings, rate/concurrency limit, injected-client acceptance tests. |
| 95–115 minutes | One credential-dependent live smoke, README, placeholder environment file, evidence report. |
| 115–120 minutes | Run contract checks; demonstrate independently; commit owned files and hand off by **12:30 PM IST** for a 10:30 AM start. |
| 120–150 minutes | Scheduled integration and fixes within `service/`, from 12:30 to 1:00 PM. |
| 150–165 minutes | Team checks, from 1:00 to 1:15 PM; reserve the remaining Phase 1 time for submission. |

If credentials or provider access fail, deliver the fully tested fixture service and the explicit live-mode error. Others can continue. Report the blocker; fixture success is not proof of sponsor-ready live inference.

## Acceptance and handoff

Offline tests inject provider responses for: valid output, malformed JSON, unknown citation, missing candidate, truncated response, timeout, throttling, unavailable credentials, and exhausted retry budget. Also cover malformed requests, unknown case, oversized body, wrong content type, empty evidence without an outbound call, partial evidence, unchanged caveats, and provenance across both independent mode dimensions. Verify no test makes a network request and no key enters responses or logs.

Deliver the handler, standalone command, passing offline tests, example requests, and a README with exact environment setup. For integration, document `API_HANDLER_MODULE=service/api-handler.mjs`, the chosen `ARTIFACT_BUNDLE`, and explicit `AI_MODE`. The launcher reads process environment; `.env` is not automatically loaded. A private env file can be used with Node's `--env-file`; commit placeholders only.

`SMOKE-REPORT.md` records the service commit, UTC time, artifact kind, model ID, successful live status or actual blocker, and preserved limitations. One live request is sufficient; automated tests stay offline. A teammate must be able to start and verify your fixture service without your account or another member's delivery.

Reference: [Google's hosted Gemma API guide](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api). Follow the checked live model behavior rather than assuming every Gemini API feature applies to Gemma.

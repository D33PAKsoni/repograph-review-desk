# Member 3 — Dashboard, Cloudways, and final integration

Your objective is to make the evidence understandable and the application publicly usable. Deliver a responsive React interface and one Cloudways Node application that serves both static assets and `/api/` requests. Start immediately with the supplied mock API; production analysis and the real service are replacements behind the frozen contract.

Read [CONTRACT.md](CONTRACT.md) first. All route names, envelopes, environment variables, and handler interfaces below inherit that contract. **Do not change them to accommodate implementation preferences.**

## Ownership and independent start

You own `web/`, `deployment/`, the root `package.json` and lockfile, and the final project README, license, and attribution. You also own the final deployment configuration and integration checklist. Do not edit `analysis/`, `data/production/`, `service/`, `contracts/`, `fixtures/`, or `bootstrap/`. Keep frontend dependencies and their lockfile under `web/`; the supplied Node launcher has no runtime package dependencies.

Your external prerequisites are Node.js 22 or 24, GitHub repository access, and an accessible Cloudways account. Those are account/platform requirements, not deliverables owed by another member. Check them at the start. If Cloudways access is delayed, continue the entire UI locally and record the deployment blocker explicitly.

From the handoff root, establish the baseline:

```powershell
node contracts/validate.mjs --bundle fixtures/artifact-bundle.fixture.json
node --test bootstrap/starter.test.mjs
node bootstrap/server.mjs
```

The launcher initially serves a labeled placeholder on `http://localhost:3000`. Build `web/` with React, TypeScript, and Vite. Configure Vite's development proxy so `/api` forwards to `http://127.0.0.1:3000`. Browser requests must remain relative; do not introduce a frontend API origin or a `VITE_GEMMA_API_KEY`.

## Work package 1: complete reviewer journey

Implement this screen sequence:

1. Load `GET /api/v1/catalog`; show the repository name, commit, artifact kind, generation time, tools, and prepared file-impact scenarios.
2. On selection, load `GET /api/v1/cases/:caseId`. Display changed files, direct/transitive dependents, candidate tests, architecture context, source evidence, limitations, and blind spots.
3. Accept an optional plain-text `changeIntent` of at most 500 characters. Explain that this expresses an intention within a prepared scenario; the application does not inspect a pasted patch or arbitrary PR.
4. Send `POST /api/v1/briefings` with only `{caseId, changeIntent?}` and JSON content type. Read `data` from the success envelope; never assume the body itself is the briefing.
5. Display the summary, evidence-linked findings, review checklist, model, inference mode, and limitations. Download the exact service-provided `markdown` string as a UTF-8 `.md` file using a Blob.

Render citations as evidence IDs linked to the evidence panel. For a non-null source URL, offer an external source link with the original path, lines, producer, and confidence label. For null URLs, show “Synthetic fixture — source link unavailable.” Do not invent GitHub links or convert confidence labels into numeric risk scores.

Always distinguish **analysis provenance** (`artifactKind`) from **inference mode** (`mode`). A live Gemma response over fixture analysis still needs the fixture label. Show the repository commit in the briefing so users can see which snapshot it describes. Preserve uncertainty; candidate tests are suggestions, and an empty dependency list does not establish safety.

## Work package 2: interface behavior and verification

Provide distinct loading, ready, empty, partial, and error states. Disable duplicate generation while a request is pending. When the selected case changes, clear the previous briefing and ignore or cancel stale requests so results cannot appear under the wrong file. Retain a failed request's intention for retry.

Use the mock catalog's empty and partial cases. An empty case remains inspectable; `422 INSUFFICIENT_EVIDENCE` must explain why no briefing was generated. Partial analysis remains usable while its warnings stay visible. Treat `retryable` as the retry control; show stable friendly explanations for 429, 502, 503, and 504 without exposing raw provider responses.

Exercise loading with `?delayMs=1200`; exercise briefing errors with `?mock=timeout`, `?mock=rate-limit`, and `?mock=invalid-response`. These controls belong only to local/mock verification. Production service requests must not contain them.

Use labeled inputs, semantic headings, keyboard-operable controls, visible focus, meaningful loading announcements, and text alongside status colors. Check approximately 390 px and 1366 px widths; source paths must wrap rather than force page-wide scrolling. React should render model/user strings as text. Do not inject HTML from the briefing or render source excerpts as executable content.

Deliver repeatable UI checks against the mock covering the happy path, empty/partial results, a retryable failure, case switching, citation navigation, and Markdown download. Add a brief manual keyboard/responsive checklist with results. Do not depend on a real key or another member's process for these checks.

## Work package 3: one Cloudways application

Use Cloudways Velocity's custom/“Other” Node configuration where available, rather than a frontend-only deployment preset. The official product documentation supports Node applications, environment variables, and React/Vite frameworks; verify the account's actual controls. The build must produce `web/dist`, and the start command must run the supplied launcher.

Root scripts should implement this behavior:

```json
{
  "build": "npm --prefix web ci && npm --prefix web run build",
  "start": "node bootstrap/server.mjs",
  "test:starter": "node --test bootstrap/starter.test.mjs"
}
```

Commit `web/package-lock.json`; require a clean `npm ci` build. Set a Node engine compatible with the platform's selected 22 or 24 runtime. Cloudways build command: `npm run build`. Start command: `npm start`. Honor platform `PORT`; the launcher listens on `0.0.0.0`. Do not replace it with Vite's development server.

Deploy the supplied mock early with `API_HANDLER_MODULE` unset and fixture artifacts. Verify the public `/api/v1/health` and visible sample labels. **This proves hosting only; it is not completion of the real-data, live-Gemma, all-track demo.** Record URL, deployment commit, commands, environment names, and observed health JSON in `deployment/RUNBOOK.md`. Never record secret values.

## Final integration: replacements, not rewrites

At the scheduled integration checkpoint, confirm these delivered files exist:

```text
data/production/artifact-bundle.json
service/api-handler.mjs
web/dist/index.html
```

Run the bundle validator, starter tests, frontend checks, and production build. Set `ARTIFACT_BUNDLE=data/production/artifact-bundle.json`, `API_HANDLER_MODULE=service/api-handler.mjs`, `AI_MODE=live`, and the verified `GEMMA_MODEL`. Store `GEMMA_API_KEY` only as a server environment secret. Locally, use process environment or Node `--env-file`; `.env` is not loaded automatically.

Start the app and check `/api/v1/health`: expect `apiMode: "service"`, `aiMode: "live"`, `artifactKind: "generated"`, and `gemmaConfigured: true`. Then complete one public briefing; verify `mode`, actual model, commit, valid citations, retained limitations, and Markdown export. No silent mock fallback. If a component remains simulated, keep that fact visible and report the missing capability.

## Required handoff and timing

Deliver the UI source/build configuration, locked dependencies, passing mock-based checks, deployment runbook, public URL, a short demo recording, and `deployment/ACCEPTANCE.md` with results and remaining limitations. Finalize the project README and an open-source license, attribute RepoGraph and the pinned baseline, and prepare the pitch, four evidence-based sponsor explanations, model/dependency list, and event-time change summary in `deployment/SUBMISSION.md`. Use the other members' handoff manifests at integration; this documentation does not block your UI or deployment work.

- **11:15 IST:** public labeled mock deployment and working case browser.
- **12:00:** complete mock-based journey and error states.
- **12:30:** independent checks complete; integration-ready files committed.
- **12:30–13:00:** connect generated artifacts and real service; public smoke test.
- **13:00–13:15:** fix integration issues, capture evidence, rehearse.
- **13:15–13:25:** ensure final changes are pushed to `main`, verify the remote commit, and submit before the host's cutoff.

Source: [Cloudways Velocity official documentation](https://www.cloudways.com/en/velocity.php). Account terms and available configuration controls must be checked in the actual account.

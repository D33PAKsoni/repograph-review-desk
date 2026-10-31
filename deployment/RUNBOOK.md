# Cloudways deployment and local operation

Status, 31 October 2026 IST: public mock is healthy at `https://nodejs-1684692-6760452.cloudwaysnodeapps.com/`. After the PM2 startup adapter, public API smoke and 9 independent browser checks pass. The initial 502 is resolved. Actual Velocity deployed SHA remains to be recorded; generated evidence/live inference remain pending. Companion source is [D33PAKsoni/repograph-review-desk](https://github.com/D33PAKsoni/repograph-review-desk).

## Local commands in VS Code

Open `C:\Users\Soni\Desktop\Hacktoberfest\RepoGraph-Review-Desk-Handoff` as the VS Code folder. Use Node 22.12+ or 24. In its terminal:

```powershell
npm run build
npm start
```

Open `http://localhost:3000`. The production build and mock API share the supplied Node launcher. Stop with Ctrl+C. No key is needed. For editing with Vite hot reload, keep `npm start` running and run `npm run dev:web` in a second terminal; open Vite's printed URL (normally `http://localhost:5173`). `/api` is proxied to `127.0.0.1:3000`.

Repeatable independent checks:

```powershell
node contracts/validate.mjs --bundle fixtures/artifact-bundle.fixture.json --briefing fixtures/briefing.fixture.json
npm run build
npm --prefix web exec -- playwright install chromium
npm test
node deployment/smoke.mjs http://127.0.0.1:3000 --record
```

`npm test` includes the 14 supplied starter checks, TypeScript checks, and browser checks. Browser checks start their own fixture launcher on port 4310; they do not require Members 1/2, keys, or a manually running API. Build first because they test `web/dist`. `REVIEW_DESK_BROWSER` can override the executable when using an installed compatible Chromium. `node deployment/record-demo.mjs` recreates the labeled fixture recording after build.

## GitHub preparation — manual steps

The companion checkout is initialized and linked to `https://github.com/D33PAKsoni/repograph-review-desk.git`. Published `main` contains the complete shared starter and Member 3 UI; deploy this branch for the initial mock. Continue UI work on `feature/web-deploy`, and have Members 1/2 branch from the shared base for their owned directories. Do not overwrite teammates' work.

Stage `web/` source/config/lockfile, `deployment/`, root package/lockfile and project documentation. The existing `.gitignore` excludes `web/dist`, `node_modules`, private `.env` files and logs; `web/.gitignore` excludes browser traces/results. Source deployment builds `dist` on Cloudways. Preserve all starter files in the deployable repository. Record the exact pushed commit in the deployment record below.

## Cloudways browser steps

1. Sign in personally at [Cloudways](https://unified.cloudways.com/). Close the WordPress/PHP wizard if it is open. Select **Velocity / Managed Node.js Hosting → Applications**. If Velocity is unavailable, ask account support/admin to enable it; the PHP application presets are not suitable for this contract's Node launcher.
2. Prefer an existing Velocity server with capacity. If a new paid server is required, have the account owner review plan, region, and billing before provisioning. Account availability/terms are not verified here.
3. Add an application and connect GitHub. Authorize only `D33PAKsoni/repograph-review-desk`, then select its pushed `main` branch for the initial mock. This is the companion app, not the original analysis fork.
4. Use **Other/custom Node** where available; verify the actual account UI. Choose Node **24** or **22** and npm. Application root is the folder containing the root `package.json` and `bootstrap/`, usually `/` if this folder's contents form the repository root. If the repository contains a parent folder, select that subdirectory.
5. Set **Build command** to `npm run build`. For an **Entry File** field use `deployment/cloudways-entry.mjs`; for a separate **Start Command** use `node deployment/cloudways-entry.mjs`. This entry explicitly starts the frozen launcher's `createAppServer`, including when PM2 imports it as ESM. A frontend-only preset that only publishes `web/dist` will not serve the API. Local `npm start` remains the supplied direct CLI launcher.
6. Set the mock environment below, leave `API_HANDLER_MODULE` absent, and save. Keep platform-provided `PORT`; the supplied launcher binds to `0.0.0.0`.
7. Deploy once local checks pass. Watch build/start logs, then copy the temporary public application URL and exact deployment commit. Do not copy credentials or key values into logs/screenshots/chat.
8. In a private/incognito browser window, open the public URL and `/api/v1/health`. The UI must say **Synthetic fixture**, **Mock API**, and **Fixture / no model called**. Complete a briefing, inspect GF001/RG001, and download Markdown.
9. From the local project terminal run `node deployment/smoke.mjs https://YOUR-PUBLIC-HOST --record`. Copy its observed health into the record below. A mock smoke proves hosting/contract compatibility only.

### Exact initial Velocity settings

| Field | Value |
| --- | --- |
| Repository | `D33PAKsoni/repograph-review-desk` |
| Branch | `main` |
| Framework | Other/custom Node.js where available; preserve Node startup if React is detected |
| Node | `24` (or 22.12+) |
| Root directory | `/` (repository root) |
| Package manager | npm |
| Build command | `npm run build` |
| Hosting Entry File | `deployment/cloudways-entry.mjs` |
| Hosting Start Command, if a separate command field exists | `node deployment/cloudways-entry.mjs` |
| Build output, if requested | `web/dist`; still serve through the Node launcher |
| Health path, if configurable | `/api/v1/health` |

Observed account setup: selecting SSR shows npm, Build Command and an Entry File field initially containing `server.js`. Initial guidance used `bootstrap/server.mjs`; investigation after public 502 showed that its direct-CLI guard does not start listening when the file is imported. PM2's ESM loader imports application entry files. Use the new `deployment/cloudways-entry.mjs` instead, then save/redeploy and inspect runtime logs for `Review Desk hosting entry listening on 0.0.0.0:PORT`. This is a reproduced compatibility issue and a likely explanation for the public failure; the exact account process failure has not yet been confirmed by logs.

The user supplied proxy logs confirming refused connections to `127.0.0.1:3000`. Keep the application on port 3000 unless the account provides a different coordinated proxy/runtime configuration. The frozen launcher's default is already 3000. Reference: [PM2 ESM process loader](https://github.com/Unitech/pm2/blob/master/lib/ProcessContainerFork.js). Three automated startup checks verify the hosting entry can listen when imported and still fails on invalid port/explicitly missing handler. Full suite after the change: 14 starter + 3 hosting + 20 browser checks pass.

Initial variables: `WEB_DIST=web/dist`, `ARTIFACT_BUNDLE=fixtures/artifact-bundle.fixture.json`, `AI_MODE=fixture`, `NPM_CONFIG_INCLUDE=dev`. The final setting ensures the build installs Vite/TypeScript even if the platform sets production npm behavior. Leave `API_HANDLER_MODULE` and `GEMMA_API_KEY` absent; preserve the platform's `PORT`.

Cloudways settings are documented in the official [launch guide](https://support.cloudways.com/en/articles/15550368-how-to-launch-an-application-on-cloudways-velocity) and [deployment management guide](https://support.cloudways.com/en/articles/16187473-how-to-manage-deployments-for-your-application-on-cloudways-velocity), consulted 31 October 2026. Account controls may differ. Node start-command override is required even if React is detected automatically.

## Environment switches

| Variable | Initial public mock | Final integration |
| --- | --- | --- |
| `WEB_DIST` | `web/dist` | `web/dist` |
| `ARTIFACT_BUNDLE` | `fixtures/artifact-bundle.fixture.json` | `data/production/artifact-bundle.json` |
| `API_HANDLER_MODULE` | **Absent** | `service/api-handler.mjs` |
| `AI_MODE` | `fixture` | `live` |
| `GEMMA_MODEL` | Unneeded by mock | Team/account-verified actual model; contract default `gemma-4-26b-a4b-it` |
| `GEMMA_API_KEY` | Absent | Enter privately as server runtime secret; mark Sensitive |
| `PORT` | Cloudways value | Cloudways value |

No frontend API-origin variable, `VITE_*` secret, or second application is needed. `npm ci` must include frontend dev dependencies to build TypeScript/Vite. If the platform forces production-only npm installs, set its build install policy to include dev dependencies (or `NPM_CONFIG_INCLUDE=dev`). Node does not automatically load `.env`; locally use process variables or `node --env-file=.env bootstrap/server.mjs` after creating a private file.

## Final integration

Follow [INTEGRATION.md](INTEGRATION.md). Do not set the service/bundle switches before both real handoffs exist. Explicit handler startup failure must remain a failure. Never remove the switch to mask a broken production service.

After switching and redeploying:

```powershell
node deployment/smoke.mjs https://YOUR-PUBLIC-HOST --production --model=ACTUAL_VERIFIED_MODEL --record
```

This makes a real inference request. It checks health, built UI, generated artifacts, Graphify/RepoGraph contributions, pinned source URL structure, model identity, citations and preserved limitations. Manually open source links to verify GitHub availability and inspect the downloaded Markdown. A passing automated smoke does not establish that the analysis is exhaustive or the code change is safe.

## Deployment record

- Public URL: `https://nodejs-1684692-6760452.cloudwaysnodeapps.com/`.
- Repository URL/branch: `https://github.com/D33PAKsoni/repograph-review-desk`, `main` for initial deployment.
- Initial verified source commit: `a7231b9aa5c1c16d33abf81c397f6a3192ca182a`; later documentation-only commits may follow it. Record the exact commit Velocity deploys below.
- Deployment commit: **PENDING exact platform record**. Startup adapter source is `a3140b5fffa6ee730cb509fa9b4aabcccd6e4c61`; public health does not expose application-source SHA.
- Account preset/Node version: **PENDING account verification**; configuration prepared for custom Node 22/24.
- Build: `npm run build`; recommended hosting Entry File: `deployment/cloudways-entry.mjs`. Local CLI: `npm start`.
- Actual public health, 31 October 2026 at 13:22–13:24 IST: HTTP **200**, `{"schemaVersion":"1.0.0","data":{"status":"ok","apiMode":"mock","aiMode":"fixture","artifactKind":"fixture","gemmaConfigured":false}}`. Records: `verification/mock-smoke.json`, `verification/public-browser.json`. Earlier 13:14–13:16 IST checks returned 502 before the startup correction.
- Expected mock health (expectation only): `{"status":"ok","apiMode":"mock","aiMode":"fixture","artifactKind":"fixture","gemmaConfigured":false}` in the v1 success envelope.
- Actual production health/live briefing: **NOT OBSERVED**.

Public browser reproduction: `node deployment/verify-public.mjs https://nodejs-1684692-6760452.cloudwaysnodeapps.com/`. This fixture-specific checker uses a fresh unauthenticated browser, real hosted requests and no test-only query controls. It records 9 checks, screenshots and the exact service-provided Markdown. Run it only against the fixture deployment; use the production smoke plus real-scenario browser checks after final integration.

## Troubleshooting

- WordPress/PHP-only choices: return to the platform dashboard and open Velocity. Escalate missing product access to the account owner/support.
- Placeholder UI: verify app root, successful `npm run build`, and `WEB_DIST=web/dist`.
- API returns HTML: frontend-only hosting is selected or a reverse-proxy rule swallows `/api`; use the Node launcher for both.
- `npm ci` fails: verify both lockfiles are committed, Node 22/24 is selected and registry access is available.
- Startup fails after integration: inspect the module path, Member 2 dependencies, bundle validation and private runtime configuration. Keep the failure visible.
- Build succeeds but homepage and API return 502: inspect PM2/application logs, configured Entry File and the proxy's expected port. Use the explicit hosting entry, confirm its listening message, and keep the platform's `PORT`. Do not infer runtime health from build success.
- 422: inspect missing evidence; retrying the same empty fixture cannot create evidence.
- 429/502/503/504: UI shows a safe explanation and offers retry only when the service marks it retryable. Do not expose provider diagnostics.

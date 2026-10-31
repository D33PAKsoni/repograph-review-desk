# RepoGraph Review Desk

An evidence-backed review dashboard that combines prepared file-impact scenarios, architecture context, and optional Gemma briefings. The React/TypeScript/Vite UI, Node API, analysis bundle, and Cloudways deployment tools are integrated in this repository.

## Quickstart

Use Node.js **22.12+ or 24**:

```sh
npm run build
npm start
```

Open http://localhost:3000. The default launcher uses the synthetic mock API. To use the integrated service with the supplied analysis scenario and deterministic inference, set these process variables before starting:

```dotenv
API_HANDLER_MODULE=service/api-handler.mjs
ARTIFACT_BUNDLE=data/production/artifact-bundle.json
WEB_DIST=web/dist
AI_MODE=fixture
```

For live inference, explicitly set `AI_MODE=live`, `GEMMA_MODEL=gemma-4-26b-a4b-it`, and a private server-side `GEMMA_API_KEY`. A missing or unusable key returns an error; live mode never silently substitutes fixture output. The launcher does not load `.env` automatically. See the [service instructions](service/README.md).

## Components

- `analysis/` and `data/production/`: supplied prepared scenario and bundle builder/checker. The current builder serializes hardcoded evidence; it does not execute RepoGraph or Graphify. Schema validation does not establish tool provenance or source-line accuracy.
- `service/`: native Node HTTP handler, modular Gemma client, output validation, citation checks, and Markdown generation. Fixture inference and analysis provenance are labeled independently.
- `web/`: scenario selection, dependency and architecture context, source citations, limitations, briefing generation, and exact Markdown export.
- `deployment/`: Cloudways startup adapter, smoke tests, browser acceptance, preflight, and historical public fixture verification.
- `vendor/repograph/`: unchanged Apache-2.0 RepoGraph source, documentation, tests, and license carried by the unrelated Gemma branch. The companion remains the root application.

These are prepared file-impact scenarios, not arbitrary pull-request or patch analysis. Live model access and deployment of the merged application require separate runtime verification. The existing [public fixture demo](https://nodejs-1684692-6760452.cloudwaysnodeapps.com/) has historical acceptance records under `deployment/verification/`; those records do not establish that the merged application is deployed.

## Verification

```sh
npm run build
npm run test:starter
npm run test:hosting
npm run test:service
npm test
npm run validate:fixture
npm run validate:production
npm run check:ready
```

`npm test` includes TypeScript, browser, and accessibility checks. Install Chromium with `node web/node_modules/playwright/cli.js install chromium`, or set `REVIEW_DESK_BROWSER` to an installed Chrome executable. `npm run check:production` additionally requires the production process environment; it does not call the model.

## API

| Route | Method | Purpose |
|---|---|---|
| `/api/v1/health` | GET | Service, inference mode, and artifact provenance |
| `/api/v1/catalog` | GET | Repository metadata and available scenarios |
| `/api/v1/cases/:id` | GET | Impact, architecture, evidence, and limitations |
| `/api/v1/briefings` | POST | Briefing for `{caseId, changeIntent?}` |

## Documentation and license

See [architecture](docs/ARCHITECTURE.md), [analysis](docs/ANALYSIS_ENGINE.md), [API](docs/API_SERVICE.md), [Cloudways deployment](docs/DEPLOYMENT_GUIDE.md), [contract](CONTRACT.md), and [branch integration record](docs/BRANCH_INTEGRATION.md).

Companion code uses the [MIT license](LICENSE). Vendored RepoGraph retains its [Apache-2.0 license](vendor/repograph/LICENSE). See [attribution](ATTRIBUTION.md).

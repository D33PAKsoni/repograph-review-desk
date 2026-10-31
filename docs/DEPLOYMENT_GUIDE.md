# Cloudways deployment

Use a Cloudways Velocity Node.js application with Node **22.12+ or 24** and this repository connected. The [runbook](../deployment/RUNBOOK.md) contains the platform steps and historical fixture acceptance.

Build with `npm run build`. For an importing process manager, set the entry file to `deployment/cloudways-entry.mjs`; direct local CLI startup uses `npm start`.

Configure process variables explicitly:

```dotenv
API_HANDLER_MODULE=service/api-handler.mjs
ARTIFACT_BUNDLE=data/production/artifact-bundle.json
WEB_DIST=web/dist
AI_MODE=live
GEMMA_MODEL=gemma-4-26b-a4b-it
```

Enter `GEMMA_API_KEY` privately in the platform environment. The launcher honors the platform `PORT`. `.env` files are not automatically loaded.

Run `npm run check:production` in the configured environment before deploying, then run the public production smoke with the actual model. Offline preflight does not validate credentials, analysis provenance, or public behavior. The supplied analysis builder's evidence is hardcoded; see the [analysis limitations](ANALYSIS_ENGINE.md). Historical fixture acceptance does not establish deployment or live inference for this merged application.

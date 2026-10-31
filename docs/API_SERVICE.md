# API and briefing service

`service/api-handler.mjs` exports `createApiHandler({projectRoot, bundlePath})` for the shared launcher. The launcher serves frontend assets; the handler owns API requests only. Set `API_HANDLER_MODULE=service/api-handler.mjs` to select the real service.

The service exposes health, catalog, case, and briefing routes defined in [CONTRACT.md](../CONTRACT.md). `service/briefing.mjs` assembles identity, provenance, limitations, citations, and Markdown; `service/gemma-client.mjs` handles Google provider calls.

`AI_MODE=fixture` makes deterministic briefings without a provider. `AI_MODE=live` uses the configured Gemma model and private server key. Live failures return contract errors and never substitute fixture success. At most two provider calls share one 30-second deadline. Live-provider tests use injected responses; an account-backed smoke is still required to establish actual access.

```sh
npm run test:service
```

This runs both the original Gemma API suite and the analysis-scenario integration checks. See [service setup](../service/README.md) for standalone and shared-launcher settings.

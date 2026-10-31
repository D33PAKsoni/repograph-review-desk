# API & Briefing Service Documentation

The API and Briefing Service serves static frontend assets, answers metadata queries, and invokes Google Gemma 4 to synthesize evidence-grounded review briefings.

## Architecture

- **Seam**: Exports `createApiHandler({ projectRoot, bundlePath })` consumed by `bootstrap/server.mjs`.
- **Gemma Integration**: Connects to `gemma-4-26b-a4b-it` or `gemma-4-31b-it` via Google Gemini API.
- **Fail-Safe Operation**: If no API key is supplied, gracefully degrades to fixture mode or deterministic evidence summaries while keeping schema stability intact.

## Testing

```bash
node --test service/tests/service.test.mjs
```

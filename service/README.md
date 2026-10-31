# Briefing Service — Gemma 4 Reasoning & API Handler

The Briefing Service ingests validated evidence bundles, maps code dependencies, and invokes Google Gemma 4 models to synthesize structured, evidence-grounded reviewer briefings.

## Architecture

- **Strict Validation**: Validates artifact bundles and outbound briefings against frozen JSON schemas.
- **Evidence Preservation**: Verifies that every claim in the review references a valid evidence ID, and that all static limitations and blind spots are preserved verbatim.
- **Gemma Integration**: Connects to `gemma-4-26b-a4b-it` or `gemma-4-31b-it` via the Gemini API when credentials are provided.
- **Zero-Dependency Core**: Implements native Node.js HTTP request handling without external framework bloat.

## Endpoints

- `GET /api/v1/health`: API status, inference mode, artifact provenance, and model readiness.
- `GET /api/v1/catalog`: Repository metadata and list of available review cases.
- `GET /api/v1/cases/:id`: Detailed case definition, impact dependencies, and Graphify architecture.
- `POST /api/v1/briefings`: Synthesize an evidence-backed briefing and checklist in Markdown.

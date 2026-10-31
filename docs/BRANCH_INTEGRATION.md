# Branch integration — 31 October 2026

All three feature histories are combined with the companion application's `main` history:

| Branch | Integrated tip |
|---|---|
| `main` (starting point) | `a3140b5fffa6ee730cb509fa9b4aabcccd6e4c61` |
| `feature/web-deploy` | `010132f2ab5e6bbb9c8b8fe481cbc63f855d16dc` |
| `feature/analysis` | `88a9c5c9d597d9b2706bd81aec1886771772f5a0` |
| `feature/gemma` | `1bafe1857f6d5029a2995c2c96913ad8d53f43e1` |

## Resolution decisions

- Fast-forward the web/deployment work, then merge analysis, retaining the Cloudways startup fix, public fixture acceptance, analysis files, and production scenario.
- Combine root test scripts so starter, hosting, both service suites, TypeScript, and browser checks all run. Keep Node 22.12+ or 24 because the frontend uses Vite 8; refresh root package-lock metadata.
- Merge Gemma with its unrelated history intact. Keep its modular handler, briefing generator, provider client, standalone launcher, and original 18 API checks. Adapt analysis's four service checks to real HTTP requests and the selected handler's Markdown format; assert preserved limitations.
- Preserve the Gemma branch's upstream RepoGraph tree byte-for-byte under `vendor/repograph/`, excluding the root `service/` contribution. This retains its Apache-2.0 license, source, tests, documentation, and workflow as upstream material without replacing the companion's root MIT license, README, build, or deployment configuration. The nested upstream workflow is archival and is not an active companion workflow.
- Reconcile application documentation with actual behavior: default startup uses the mock; the service is selected explicitly; live failures never silently become fixture successes. The analysis builder serializes hardcoded evidence rather than invoking analysis tools.
- Preserve earlier public fixture evidence and mark individual workstream status documents as historical. Deployment of the merged application is not claimed.

## Verification

On Node v24.19.0:

- `npm run build`: clean frontend install, TypeScript, and Vite build passed; npm reported zero dependency vulnerabilities.
- `npm test`: **59 checks passed** — 14 starter, 3 hosting, 22 service, and 20 browser/accessibility checks; TypeScript passed. Browser checks used installed Chrome via `REVIEW_DESK_BROWSER`.
- `node contracts/validate.mjs --bundle data/production/artifact-bundle.json`: passed for the supplied analysis case.
- `python analysis/check_dataset.py`: metadata/reference checks passed for one case, using the existing workspace Python environment.
- `node deployment/preflight.mjs`: all five offline fixture checks passed.
- 162 vendored Git blobs checked against `feature/gemma`; no upstream source edits.

The first browser attempt lacked Playwright's bundled browser; rerunning with installed Chrome passed. The original analysis request mocks did not emit the stream events expected by the selected service; replacing them with real loopback HTTP requests resolved that integration issue.

No real Google inference or deployment was performed as part of this merge. The bundled analysis metadata and source lines have not been independently verified against executed RepoGraph/Graphify output. Schema validity does not establish provenance.

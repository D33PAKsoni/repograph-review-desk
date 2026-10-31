# Member 3 acceptance record

Verified 31 October 2026 (IST), including public mock acceptance at 13:22–13:24 IST. Local Windows / Node 24.19.0 / Chromium via Playwright 1.64.1. Public hosting and the fixture reviewer journey are verified. Generated evidence and live inference are not verified.

## Automated results

| Check | Result | Evidence / command |
| --- | --- | --- |
| Supplied bundle + briefing validation | PASS | `node contracts/validate.mjs --bundle fixtures/artifact-bundle.fixture.json --briefing fixtures/briefing.fixture.json` |
| Supplied starter checks | 14 / 14 PASS | `npm run test:starter` (also included in `npm test`) |
| Hosting startup checks | 3 / 3 PASS | `npm run test:hosting`; entry imported as ESM, non-project cwd, invalid port and missing handler |
| Clean locked-dependency build | PASS | Root `npm run build`: frontend `npm ci`, TypeScript, Vite; `web/dist/index.html` produced |
| Strict TypeScript | PASS | `npm --prefix web run check` |
| Production-build browser journey + accessibility | 20 / 20 PASS | `npm test`; isolated launcher, port 4310 |
| Accessibility A/AA scans | Zero detected violations across 10 scans | axe-core 4.14.0; 5 UI states at 390 px and 1366 px; `verification/accessibility-*.json` |
| Mock offline preflight | PASS | `npm run check:ready`; runtime, lockfile, build commands/assets, fixture validation |
| Production offline preflight | Expected blocked result | Missing real bundle, handler and production environment; `verification/preflight-production.json` |
| Owned-file handoff package | PASS | `npm run package:handoff`; 39 archive entries read back and matched; SHA-256 inventory/checksum in `handoff/` |
| Local built UI + mock smoke | PASS | `node deployment/smoke.mjs http://127.0.0.1:3000 --record`; `verification/mock-smoke.json` |
| Public HTTP/API smoke | PASS | Public URL, observed fixture health and actual hosted briefing; current `verification/mock-smoke.json` supersedes the earlier local/failed runs |
| Public browser journey | 9 / 9 PASS | `node deployment/verify-public.mjs PUBLIC_URL`; fresh session, real hosted responses, exact download, empty/partial and two layouts |
| Fixture backup demo | CREATED | `node deployment/record-demo.mjs`; `demo/fixture-walkthrough.webm` (~3.5 MB) |
| Direct dependency install audit | 0 reported vulnerabilities | npm install/clean npm ci output; not a source-code security audit |

The sandbox initially blocked npm registry/cache access and direct browser launch. Authorized retries succeeded; those access failures were not application failures. Vite 8's native transform is used with TypeScript's automatic JSX configuration. Node engine minimum was tightened to 22.12+ (or 24) to match Vite's runtime requirement.

The follow-up audit found low-contrast secondary text; labels, source metadata, help text and placeholders were darkened. Ten scans now pass without disabling rules. Each scan flags three decorative, `aria-hidden` symbol elements for manual contrast review because they contain only non-text characters. These symbols do not carry information on their own; adjacent text states the same meaning. Automated scans do not replace a full manual screen-reader/device audit.

## Browser coverage

1. Happy path uses only `{caseId, changeIntent?}`, JSON content type and the v1 `data` envelope.
2. Analysis fixture and canned inference labels remain visible; commit/model/generation metadata shown.
3. Evidence citations navigate and focus the original record; null source URLs explain synthetic provenance.
4. An intercepted non-null source URL retains original path/line, producer, confidence and secure external link attributes. This is a simulated UI test, not real source verification.
5. Downloaded `.md` bytes exactly match the service's UTF-8 `markdown` string.
6. Empty case remains inspectable and produces a non-retryable 422 explanation.
7. Partial analysis retains every supplied warning/blind spot in the panel, briefing and export.
8. Timeout 504, throttling 429, malformed output 502 and unavailable model 503 show stable explanations, hide raw diagnostics and use `retryable` for retry controls.
9. Failed intention persists for retry; a delayed request disables duplicate generation.
10. Case switches abort/ignore old case and briefing responses; reselecting the active case preserves its data.
11. A simulated live response over fixture evidence shows both dimensions. No live provider was called by this check.
12. Invented citations are rejected; user/model HTML-like strings render as text.
13. Catalog failure supports retry and failed case loading clears old evidence.
14. Intention has a 500-character input limit; skip link and evidence navigation work by keyboard.
15. 390 px and 1366 px layouts have no page-wide horizontal overflow, including a rendered briefing and full paths.
16. Production build contains no local mock-verification UI and app-generated requests have no mock query controls.

The supplied mock logs a safe `Request failed: Error` when an intentionally aborted request is exercised. That canceled request is expected in the stale-response test; the suite passes.

## Keyboard / responsive checklist

| Action | Result / method |
| --- | --- |
| Tab from initial page reaches visible skip link; Enter focuses workspace | PASS, browser keyboard check |
| Scenario controls are semantic buttons and keyboard operable | PASS, implementation inspection; user can manually Tab → Enter through scenario buttons |
| Enter on citation focuses source record | PASS, browser keyboard check |
| Visible focus styling, semantic headings, named textarea, status/error announcements | Implemented; focus paths browser-checked; zero detected A/AA violations in 10 axe scans. Full screen-reader audit not performed. |
| Desktop 1366 px | PASS, visual inspection of `screenshots/dashboard-1366.png` and automated overflow check |
| Mobile 390 px | PASS, visual inspection of `screenshots/dashboard-390.png` and automated overflow check |
| Source excerpts are text and wrap inside their panel | PASS, screenshot/source inspection |
| Human check on a physical phone and screen reader | PENDING; not claimed as verified |

Manual reproduction: start with `npm start`; Tab to the skip link, press Enter, Tab through links/buttons, activate a scenario, enter an intention, generate, follow GF001 and download. In browser responsive tools select 390 px, then 1366 px; check source paths and full commit wrap. On `npm run dev:web`, open Local mock verification and choose `delayMs=1200`, timeout, rate-limit or invalid-response. Those controls are development-only and are never added to production requests.

## Public deployment / integration acceptance

| Requirement | Status |
| --- | --- |
| Team repository/branch/commit verified and pushed | PASS: companion `main` pushed; initial source `a7231b9aa5c1c16d33abf81c397f6a3192ca182a` independently verified through GitHub |
| Cloudways Velocity deployment | Access confirmed by user; public deployment pending |
| Public mock URL and observed public health | PASS: public homepage/health and fixture journey work after startup correction; 9 browser checks pass |
| Exact platform-deployed SHA | PENDING deployment-history record; expected startup source `a3140b5` is published, but not attested by public health |
| Real Member 1 generated bundle and source availability | PENDING handoff |
| Member 2 production API and actual live Gemma model | Candidate `feature/gemma` at `1bafe185`; smoke report says live call not yet run; independent service integration/verification pending |
| Public real-data/live-model briefing, source links, Markdown | PENDING |
| Public live demo recording and final remote `main` | PENDING |

No frozen files or other members' directories were edited. See `INTEGRATION.md` and `RUNBOOK.md` for the remaining concrete steps.

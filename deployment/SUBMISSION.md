# Submission and demo preparation

31 October 2026 IST. This is an honest working draft; the public URL, repository commit, generated analysis and live inference must be filled only after verification.

## Links and ownership

- Companion source URL: [D33PAKsoni/repograph-review-desk](https://github.com/D33PAKsoni/repograph-review-desk); initial push/final integration SHA pending verification.
- Public Cloudways URL / deployed SHA: **PENDING deployment**; user now has Velocity access.
- Baseline RepoGraph: [INDEX0-RESEARCH-LABS/repograph](https://github.com/INDEX0-RESEARCH-LABS/repograph), commit `3449061d736ef72845701e0c4bf3a6ce8c916d73`.
- Member 3 implemented UI and deployment assets; Members 1/2 own real tool artifacts and live API/Gemma. Frozen starter components are not claimed as new team work.
- License: root MIT for companion code; retain upstream notices. See `ATTRIBUTION.md`.

## Two-minute pitch script

**0:00–0:20 — Problem.** “A changed file can affect code outside the diff. Review Desk gives reviewers a bounded, inspectable briefing about a prepared file-impact scenario.”

**0:20–0:50 — Evidence.** Select the main scenario. Show repository commit and analysis provenance. Inspect direct dependents, candidate tests and a Graphify relationship. Follow a citation to the original producer label, path and lines; open its real source only when generated evidence exists.

**0:50–1:20 — Briefing.** Enter a short intention and generate. State actual inference mode and model from the response. Read one cited finding and a checklist item. Download Markdown and show the commit and retained caveats. If using today's fixture backup: say “synthetic fixture, canned response, no model called.”

**1:20–1:45 — Limits.** Show the partial and empty scenarios. Explain that missing dependencies do not imply safety; candidate tests are incomplete and the full suite is required. A provider error is shown as failure with retry when allowed.

**1:45–2:00 — Delivery.** Show the public Cloudways URL and source repository only when verified. Explain one app serves the dashboard and API. State which capabilities are demonstrated and which remain pending.

## Four evidence-based technology/sponsor explanations

| Contribution | Intended role | Evidence available now | Required final evidence |
| --- | --- | --- | --- |
| RepoGraph | Static impact evidence and candidate tests from pinned source | UI renders synthetic original labels and citations; no real analysis by Member 3 | Member 1 builder/provenance, generated bundle, real source links |
| Graphify | Architecture relationship context used by UI and briefing | Synthetic GF001 context/citation rendered and browser-tested | Actual Graphify command/version/output, cited generated relationship |
| Open Gemma model | Explain supplied bounded evidence with validated citations | Fixture briefing journey verified; no model inference occurred | Member 2 live smoke, actual account model, public live response |
| Cloudways Velocity | Host one Node app for assets plus API | Clean build/start configuration, runbook and local launcher verification | Public URL, deployed commit, observed public health, incognito demo |

These explanations are not proof of sponsor eligibility; claim only the categories actually demonstrated and verify the event's current rules separately.

## Models and dependencies

- Configured contract model default: `gemma-4-26b-a4b-it`; **not executed or account-verified by Member 3**. Fixture `model` is `null`. Record the actual Member 2 live model before submission.
- Current frontend packages: React / React DOM **19.3.1**.
- Build/check packages: Vite **8.3.5**, TypeScript **7.0.2**, `@types/react` **19.3.0**, `@types/react-dom` **19.3.0**, `@types/node` **26.6.6**.
- Browser verification: Playwright **1.64.1**, Chromium test build **1248**.
- Accessibility verification: `@axe-core/playwright` / axe-core **4.14.0** (development only); 10 A/AA scans, zero detected violations, human screen-reader/device review pending.
- Node used locally: **24.19.0**; engine supports Node 22.12+ or 24.
- Exact resolved packages and transitive dependencies: `web/package-lock.json`. Root launcher has no runtime package dependencies. Browser tools are development dependencies.
- No remote fonts or image assets are required by the dashboard.

## Event-time change summary — Member 3

- Built `web/` from the supplied starter with semantic, responsive React/TypeScript components and relative API requests.
- Added separated analysis/inference provenance, evidence navigation, original labels, source safety checks, limitations, empty/partial handling, request cancellation, friendly errors, intention retry, and exact UTF-8 Markdown download.
- Added an isolated production-build browser suite and root build/start/check commands with locked frontend dependencies.
- Prepared Cloudways runbook, public mock/live smoke verification, integration checklist, acceptance/progress records, attribution/license and fixture backup recording script.
- Follow-up during credit approval: fixed secondary text contrast; added automated accessibility checks, offline mock/production readiness checks and a Member 3 overlay packager with SHA-256 inventories.
- Did not edit `analysis/`, `data/production/`, `service/`, or frozen `CONTRACT.md`, `contracts/`, `fixtures/`, `bootstrap/`.
- Final commit ID, push time and deployed commit: **PENDING**; do not invent timestamps or remote state.

## Demo artifacts and remaining submission tasks

- Screenshots: `deployment/screenshots/dashboard-1366.png`, `dashboard-390.png` (synthetic fixture UI).
- Backup recording: `deployment/demo/fixture-walkthrough.webm` after `node deployment/record-demo.mjs`. This is a local mock recording, not proof of live model use or hosting.
- [ ] Replace the backup with a public real-data/live-model recording once integrated.
- [ ] Fill source/public URLs, final SHA, actual model and tool manifests.
- [ ] Confirm all submission links open in a logged-out session.
- [ ] Verify final remote `main` matches the deployed commit; submit within the host's cutoff.

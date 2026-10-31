# Frozen-contract integration checklist

Member 3's implementation uses only relative `/api/v1/...` URLs. No changes to the frozen contract, fixtures, validators or launcher are needed.

## Independent Member 3 handoff

- [x] `web/` source, TypeScript and Vite configuration, frontend-only dependency lock.
- [x] Root clean-install/build and supplied launcher start command.
- [x] Complete fixture reviewer flow and browser acceptance checks.
- [x] Explicit analysis/inference labels, original confidence labels, null-source explanation.
- [x] Public deployment instructions, acceptance report and submission draft.
- [x] Accessibility A/AA scans, offline preflight and owned-file handoff packager.
- [x] Shared repository and remote verified: initial source `a7231b9`, documentation head `0b18955`, with `feature/web-deploy` created from the published shared base.
- [ ] Public mock health and URL recorded.

## Member 1 checkpoint (await handoff; do not create substitute data)

- [ ] `data/production/artifact-bundle.json` exists with `artifactKind: generated`.
- [ ] Builder/version/provenance manifest and raw evidence provided.
- [ ] Pinned repository/commit, main scenario and RepoGraph + Graphify source evidence verified.
- [ ] `node contracts/validate.mjs --bundle data/production/artifact-bundle.json` passes.
- [ ] All source URLs open at the pinned commit and original paths/lines.

## Member 2 checkpoint (await handoff; do not implement inside their directory)

- [ ] `service/api-handler.mjs` exports `createApiHandler({projectRoot, bundlePath})`.
- [ ] Member 2's dependency install instructions and offline checks pass.
- [ ] Provider credentials entered only into the server runtime environment.
- [ ] Actual account model and live smoke manifest provided.
- [ ] Response citations validated; blind spots/limitations preserved in UI and Markdown.

## Integrator and public acceptance

- [ ] Merge reviewed handoffs without changing `CONTRACT.md`, `contracts/`, `fixtures/`, `bootstrap/`.
- [ ] Run real bundle validation, `npm run build`, `npm test`, then Member 2's own checks.
- [ ] Verify `data/production/artifact-bundle.json`, `service/api-handler.mjs`, `web/dist/index.html` all exist.
- [ ] Run `npm run check:production` in the configured production process environment; missing handoffs/configuration must remain explicit failures.
- [ ] Set the runbook's production environment and redeploy one Node app.
- [ ] Health: `apiMode: service`, `aiMode: live`, `artifactKind: generated`, `gemmaConfigured: true`.
- [ ] Run `deployment/smoke.mjs` with `--production --model=ACTUAL_MODEL` and public URL.
- [ ] Public incognito review: correct main scenario/commit, working source links, original producer labels, live model, valid citations, every limitation and exact Markdown download.
- [ ] Exercise failure without silently substituting fixture inference.
- [ ] Check no secret values in frontend assets, committed source, logs or screenshots.
- [ ] Record public URL, commit, account settings and observed health in RUNBOOK; update ACCEPTANCE, PROGRESS and SUBMISSION.
- [ ] Capture public live demo, push final reviewed `main`, verify remote SHA and submission links.

Until these final steps pass, describe the deliverable as a verified mock-backed UI with deployment preparation, not a completed real-data/live-model application.

# Member 3 handoff

The UI and deployment preparation can be handed off before Cloudways credits arrive. Current analysis is synthetic and inference is canned. Real analysis, live inference and public deployment remain pending.

## Repository setup

The user supplied [D33PAKsoni/repograph](https://github.com/D33PAKsoni/repograph), a fork of the original offline analysis project. Its README was inspected read-only. Keep that fork as the analysis source. The recommended deployable companion repository is a new public **`repograph-review-desk`**, with Members 1 and 2 added as collaborators, following the work order's companion-app architecture.

Create the new repository empty, without GitHub-generated README/license/gitignore; those files already exist locally. Collaborator invitations on the original fork do not grant access to a separate companion repository. Repository creation/publication has not been performed by this agent.

Publish the contents of this complete starter folder at the new repository root. Retain the frozen `bootstrap/`, `contracts/`, `fixtures/` and CONTRACT. Review Source Control before pushing; private `.env`, dependencies, build output, traces and generated archives must be excluded. Use this initial shared companion snapshot as the common base for `feature/web-deploy`, `feature/analysis` and `feature/service`. Preserve existing remote history if the team has already started a companion repository.

## Owned-file overlay archive

```powershell
npm run package:handoff
```

Produces `deployment/handoff/member-3-overlay.tar.gz`, file-by-file SHA-256 inventory `MANIFEST.json`, and archive checksum `SHA256SUMS.txt`. Requires `tar` (available on this Windows machine and common Linux/macOS hosts). The generator reads back the archive's file list and checks it against the allowed inventory. Its output directory is ignored by Git.

Contents: `web/` source/config/tests/lockfile; `deployment/` runbooks/verification/screenshots/fixture recording; root package/lockfile/README/LICENSE/ATTRIBUTION. Excludes dependencies, build output, private `.env`, Git metadata, browser traces/results, its own archive directory, frozen starter files and other members' directories.

**This is an overlay, not a standalone starter or production deployment.** The recipient needs the original frozen starter. Inspect the manifest and extract into a clean copy/work branch; review conflicts before copying into a teammate's checkout. The script does not overwrite teammates' files or extract automatically. Commit/remote fields remain null until actual Git state is established.

## Independent checks

```powershell
npm run build
npm --prefix web exec -- playwright install chromium
npm test
npm run check:ready
npm start
```

Use Node **22.12+ or 24**. Open `http://localhost:3000`. Tests cover the frozen starter, strict TypeScript, browser behavior and automated accessibility scans. Offline `check:ready` validates runtime, commands, lockfile, built assets and fixture compatibility without network/model calls.

After receiving both real handoffs and configuring a private production process environment:

```powershell
npm run check:production
```

This validates Member 1's generated bundle and checks the Member 2 handler file and required environment names. It never imports the handler, makes a provider request or prints secret values. Missing components produce exit code 1 with explicit blockers. Then run Member 2's own checks and follow `INTEGRATION.md`/`RUNBOOK.md` for production startup, public deployment and real smoke verification.

## Remaining external checkpoints

- User now has Velocity access; public application deployment and health pending.
- Companion repository confirmed: `https://github.com/D33PAKsoni/repograph-review-desk`; first verified pushed commit pending.
- Member 1 generated bundle and Member 2 real API/live-model handoffs.
- Public real-data/live-inference smoke and live demo.

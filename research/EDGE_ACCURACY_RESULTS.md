# Edge accuracy results

**Measured:** 2026-10-28 (round 5; rounds 1–4 on 2026-10-27)
**Protocol:** [`EDGE_ACCURACY_PROTOCOL.md`](EDGE_ACCURACY_PROTOCOL.md) (pre-registered before labeling)
**Tool version:** RepoGraph 0.1.0 working tree
**Labelers:** two independent AI agents per round; no human adjudication
**Artifacts:** `benchmarks/eval/` (samples, labels, reports)

## Result in one line

On three repositories never indexed, sampled or tuned against before (httpx, zustand, mocha), sampled resolved edges were **118/120 correct — 98.3% precision** (Wilson 94.1%–99.5%) and estimated static-import recall was **93.7%** (118/126; Wilson 88.0%–96.8%). Both errors are one defect: a root `tsconfig` alias applied to example apps that pin the registry package. All eight agreed misses are JSON `require`s in mocha. Weighted for population size: 99.5% precision, 98.5% recall.

## Rounds

| Round | Repositories | Sample | Purpose |
| --- | --- | ---: | --- |
| baseline | fastapi, vue-core, express | 294 | measure the pre-fix build |
| dev2 | fastapi, vue-core, express | 226 | re-measure after fixes |
| devhold | requests, axios, zod | 217 | find defects on a second development set |
| round 4 (final test) | flask, vite, svelte | 270 | unseen evaluation of the build at that time |
| **round 5 (current)** | **httpx, zustand, mocha** | **203** | **unseen evaluation after tuning on round 4** |

`devhold` was a holdout until its labels exposed defects; those defects were fixed, so it became a development set. After round 4 was reported, twelve resolver fixes were derived from its misses; those fixes are described in the post-fix recheck below. Round 5 therefore measures the *current* build on data that none of those fixes touched. `flask`, `vite` and `svelte` were cloned after the last fix, indexed once, sampled with the pre-registered seed, and labeled without inspecting their unresolved imports. They were not used to change the resolver before their round was reported.

Repository snapshots (shallow clones):

| Repository | Commit |
| --- | --- |
| fastapi/fastapi | `79cab5b` |
| vuejs/core | `ca03482` |
| expressjs/express | `1c6f1b0` |
| psf/requests | `3c7baaa` |
| axios/axios | `d5c49bf` |
| colinhacks/zod | `afdac65` |
| pallets/flask | `d086db8` |
| vitejs/vite | `cce559a` |
| sveltejs/svelte | `23bb146` |
| encode/httpx | `b5addb6` |
| pmndrs/zustand | `382d29c` |
| mochajs/mocha | `5b5afa7` |

## Round 5 results (current build)

Pre-registered in `DECISION_LOG.md` D-011 before sampling: seed `20261029`, protocol unchanged, no resolver change until the round was reported. Sample: 203 rows, frozen at SHA-256 `26bae053…705c7c0` (`sample-round5.meta.json`).

Index state when sampled:

| Repository | Files | Internal imports | Unresolved | External | Parse errors |
| --- | ---: | ---: | ---: | ---: | ---: |
| httpx | 60 | 124 | 0 | 216 | 0 |
| zustand | 51 | 72 | 10 | 76 | 5 |
| mocha | 483 | 321 | 13 | 298 | 3 |

| Repository | Resolved sample | Precision | Recall | Agreed misses |
| --- | ---: | ---: | ---: | ---: |
| httpx | 30 | 100% (30/30) | 100% (30/30) | 0 |
| zustand | 60 | 96.7% (58/60) | 100% (58/58) | 0 |
| mocha | 30 | 100% (30/30) | 78.9% (30/38) | 8 |
| **overall** | **120** | **98.3%** (118/120) | **93.7%** (118/126) | **8** |

| Confidence class | n | Precision |
| --- | ---: | ---: |
| `confirmed` | 90 | 100% |
| `inferred` | 30 | 93.3% (28/30) |

Wilson 95% intervals: precision **94.1%–99.5%**; recall **88.0%–96.8%**. Population-weighted (stratum sizes in `sample-round5.meta.json`): precision **99.5%**, recall **98.5%**.

- Agreement between the two labelers: **94.09%** (191/203 rows). All 12 disagreements were adjudicated; none remained `uncertain`.
- No `wrong_target` edge. The only errors were two edges that should not have been internal at all.
- `mocha` recall is the weak number and it is one cause: JSON `require`s.

### Defects found

**1. Root `tsconfig` aliases leak into example apps (zustand, both precision errors).**

`zustand-0011` (`examples/starter/src/index.tsx:3`) and `zustand-0075` (`examples/demo/src/App.jsx:1`) both `import ... from 'zustand'`. RepoGraph resolved that to the repository's own `src/index.ts` through the root `tsconfig.json` path alias. The examples are standalone apps with their own `package.json` pinning `zustand ^5.0.2` and `^4.3.9`, so the import is external. The root config's `include` is only `src/**` and `tests/**`; the alias was applied outside the files the config covers.

This is a precision defect, not a labeling dispute: a false internal edge is the failure mode that matters most. It is **not fixed in this round** because D-011 forbids resolver changes before the round is reported. The fix (apply a config's aliases only inside its `include` scope) will be verified as a within-sample recheck and reported as such, not as a new estimate.

**2. JSX/TS advanced syntax parse errors (zustand, 5 files; contributes no edges).**

`src/react.ts`, `src/vanilla.ts`, `src/traditional.ts`, `src/middleware/subscribeWithSelector.ts` and `tests/ssr.test.tsx` fail to parse. These are the library's core files, so the index for zustand is thinner than its 51 files suggest. The sampled unresolved stratum contained no rows from them, which means the miss rate for those files is simply unmeasured — a blind spot, not a pass. Parse errors are surfaced by `repograph arch` and counted as a blind spot in impact reports. (mocha's three parse errors are intentionally broken fixtures.)

**3. JSON `require`s (mocha, all 8 recall misses).**

`require('./package.json')`, `require('../package.json')` and similar config loads are treated as external/unresolved because JSON is not parsed into the code graph. This is the same documented non-code blind spot seen in earlier rounds. It is consistent, expected, and disclosed; it is not counted as correct.

### Adjudication log

| Rows | Disagreement | Decision | Reason |
| ---: | --- | --- | --- |
| 10 | `unresolved_ok` vs `internal_missed` | `unresolved_ok` | `.png`/`.svg`/`.css` assets are bundler-only imports, out of the code graph by policy (same rule as all earlier rounds) |
| 2 | `correct` vs `not_internal` | `not_internal` | zustand example apps pin the registry package; the root alias does not cover them |
| 8 | `unresolved_ok` vs `internal_missed` | `internal_missed` | mocha `require`s a JSON file that exists in the repository |

Adjudication was done by reading the source and the config/`package.json` files named above. The adjudicated labels are `labels-round5-adjudicated.jsonl`; raw labels and the two-labeler report are kept beside them.

### What this round does and does not show

- It supports the pre-registered claim: precision ≥95% and recall ≥85% both pass, and the precision lower bound (94.1%) stays above the 90% "do not market as reliable" floor.
- The two zustand errors are a real resolver defect. Precision is a measured 98.3%, not 100%, and the fix is pending.
- zustand's core files are partly unparsed, so its recall of 100% applies to the sample drawn, not to the whole repository.
- mocha's 78.9% recall is the lowest per-repository number measured so far and is entirely JSON imports; a repository that imports config files heavily will see similar missing edges.
- Three repositories, 203 rows and AI labelers are still a small, deliberate corpus.

## Round 4 results (flask, vite, svelte; superseded estimate)

These numbers describe the build measured on 2026-10-27. Twelve resolver fixes were derived from this round's misses afterwards, so they no longer describe the current build. They are kept because the per-repository pattern and the defect list are the evidence behind those fixes.


Population-weighted estimates, scaling each sampled stratum to its size. `uncertain` means the two labelers disagreed.

| Repository | Resolved sample | Precision | Recall | Missed internal imports (weighted) |
| --- | ---: | ---: | ---: | ---: |
| flask | 30 | 100% | 94.9% | 16 |
| vite | 60 | 100% | 85.5% | 329 |
| svelte | 60 | 100% | 97.6% | 144 |
| **overall** | **150** | **100%** | **94.3%** | **489** |

| Confidence class | n | Precision |
| --- | ---: | ---: |
| `confirmed` | 90 | 100% |
| `inferred` | 60 | 100% |

- Agreement between labelers: 91.5% (23/270 rows). All 23 disagreements are non-code assets (`.css`, `.svg`, `.png`) or one conditional-exports fixture package; the code edges were not disputed.
- No resolved edge was labeled `wrong_target`, `not_internal` or `uncertain`.
- Precision 95% confidence interval (Wilson, 150/150): **97.5%–100%**. Recall intervals were not computed; the miss categories below are the useful signal.

### What round 4 still missed

The 29 agreed misses are concentrated, not random (pre-fix snapshot):

| Category | Rows | Example |
| --- | ---: | --- |
| Python apps imported by bare name from `tests/`, `examples/` (sys.path/conftest roots) | 16 | `import flaskr` → `examples/tutorial/flaskr/__init__.py` |
| Node `imports` subpath aliases (`#…`) | 6 | `#compiler/builders` → `packages/svelte/src/compiler/utils/builders.js` |
| JSON/config imports | 3 | `../package.json`, `./data.json` |
| Package self-reference and conditional `exports` | 4 | `vite` from a playground; `@vitejs/cjs-external` |
| Other | 2 | Deno/worker conditions |

Non-code assets are excluded from the code graph by design. The `.vue` SFC and Vite `?raw`/`?worker` rows are also reported as unresolved, not silently resolved.

### Post-fix recheck (not a new accuracy estimate)

Four resolver changes were made after that diagnosis. Every one of the 29 agreed
misses was then re-resolved through the production index path (re-index, then
query the stored edge):

| Change | Evidence |
| --- | --- |
| Python project roots from `pyproject.toml`/`setup.py`/`setup.cfg` (including `src` layouts), registered only when unambiguous | `flaskr`, `js_example`, `task_app` |
| Directories named in a `conftest` `syspath_prepend`/`sys.path.insert` literal | `blueprintapp`, `cliapp` |
| Node `package.json` `imports` maps with exact and `*` keys, nearest package wins | svelte `#compiler/builders`, `#client/constants`, `#shared` |
| `exports`/`main` build output mapped back to `src/…` for the package entry | `vite` self-reference in playgrounds |

Result: **25 of 29** misses now resolve, and **0 of the 150** previously correct
resolved edges changed target. Every new edge is `inferred`, with its method and
the root or map that produced it recorded in `imports.method`/`note`.

This is a within-sample recheck on data already used to choose the fixes. It is
**not** a new recall estimate and must not be quoted as one. The four remaining
rows are three JSON/config imports (a documented non-code blind spot) and one
fixture package nested below the package-discovery depth bound; registering
deep fixture packages globally would let a fixture named like a real dependency
hijack unrelated imports, so it stays unresolved.

## Baseline and fix-validation (development repositories)

Baseline sample: 294 rows. Two labelers agreed on 292/294 (99.3%).

| Metric | Baseline | After fixes (dev2) |
| --- | ---: | ---: |
| Precision (weighted) | 98.97% | **100%** |
| Precision (unweighted) | 82.64% | **100%** |
| Recall (weighted) | 97.06% | **99.82%** |
| `confirmed` precision | 100% (90) | 100% (90) |
| `inferred` precision | **53.7%** (54) | **100%** (30) |
| Express recall | **32.4%** | 100% |

The baseline pooled precision passed the 95% threshold, which is exactly why pooled numbers alone are insufficient: `inferred` edges were wrong half the time, and Express missed two-thirds of its internal imports. The tool would have looked accurate while producing false stdlib edges and missing most CommonJS dependencies.

### Defects found and fixed

| Defect | Evidence | Fix |
| --- | --- | --- |
| Python stdlib names matched same-named repo files | 24/24 FastAPI `inferred` edges false (`types` → `fastapi/types.py`, `http`, `gzip`) | exact module lookup only; stdlib short-circuit for absolute imports |
| CommonJS root `require('..')` unresolved | 30/30 sampled Express misses; 96 total | normalize `index.*` path (`./index.js` bug) |
| `.d.ts` imports unresolved | 17/17 Vue dts-test `./utils` misses | probe `.d.ts` in relative and index resolution |
| Workspace subpath mapped to package root | `vue/server-renderer` → `packages/vue/index.js` | resolve subpath inside the package |
| Comment stripper corrupted `tsconfig` globs | `"@vue/*"` truncated at `/*`, disabling 440 path-alias edges | string-aware JSONC comment scanner |
| Workspace edges pointed at unbuilt `dist` shims | 30 Vue edges to `index.js` instead of `src/index.ts` | prefer source entry when published entry is `dist/…` |
| `import pkg` unresolved in `src` layouts | 5/5 requests misses | register package name for `__init__.py` |
| ESM `./x.js` did not map to `x.ts` | 29/30 zod misses | strip `.js`/`.mjs`/`.cjs` and probe TS extensions |
| Workspace subpath under `src/` | `zod/v3`, `zod/mini` external | probe `<pkg>/src/<subpath>` |
| Directory named `env` excluded | 5 axios `lib/env/data.js` misses | removed ambiguous `env` from default excludes |
| `from . import mod` emitted a duplicate package edge | 4 requests wrong targets | emit `__init__` edge only for attributes/self |
| Attribute import lost its `__init__` edge | 1 requests miss (`from . import VERSION`) | emit package edge when a name is not a submodule |

Targeted recheck of the exact baseline failures in the re-indexed repositories: 30/30 Express root imports now target `index.js`; 24/24 FastAPI stdlib rows are external; 17/17 Vue `.d.ts` rows resolve; the one workspace subpath is correct.

## Amendment 2 audit of the new inferred methods

The four post-test changes add edges whose method did not exist in the measured
build, so they were audited separately under the rule fixed in the protocol
(Amendment 2): ship only if at least 38 of 40 sampled edges are `correct`.

Sample: 40 of the 241 edges produced by `python-project-root`,
`python-syspath-root` and `package-imports-map` across flask, svelte and vite
(seed `20261027`; 4 Python, 36 Node). Two independent AI labelers agreed on
**40/40** rows.

| Result | Count |
| --- | ---: |
| `correct` | 38 |
| `wrong_target` | 2 |
| `not_internal` / `uncertain` | 0 |

Unweighted precision **95.0%** (38/40), Wilson 95% interval **83.5%–98.6%**.
This is a QA sample of the new code paths, not a population estimate, and it is
not pooled with the final-test precision.

Both wrong edges are the same defect: a type-only import through svelte's
`#compiler` mapping (`import type { AST } from '#compiler'`) resolved to the
runtime entry `src/compiler/index.js` instead of the declaration entry
`src/compiler/private.d.ts`. The condition selector preferred `default`/`import`
over `types`, and the extractor did not record that the statement was a type
import.

Fix: `_condition_target` takes a `prefer_types` flag, and the resolver sets it
when the raw statement matches `import type` / `export type`. Value imports keep
choosing the file that runs, which is what change impact needs.

**Within-sample recheck.** After re-indexing svelte through the production path,
both audited rows resolve to `packages/svelte/src/compiler/private.d.ts`, and
**0 of the sampled resolved svelte test rows changed target**. As with the
recall recheck, this is a check on data that exposed the defect — the 38/40
result above remains the measured number.

## Threats to validity

- **Development-set overfitting.** Fixes were derived from the development labels. The final test used new repositories, but three repositories are not a random sample of code, and repository selection was deliberate (Python app, TS monorepo, JS/TS compiler).
- **AI labelers.** Both labelers are AI agents reading the same rubric. They agreed on 91.5% of the final sample, but this is not independent human review. One labeler was consistently stricter about assets.
- **Small samples.** 150 resolved edges in the final test, 90 confirmed and 60 inferred. Rare error modes can hide. The precision lower bound is 97.5%, not 100%.
- **Weighting assumptions.** Recall uses `stratum_size / sample_size` and assumes the sample is representative within each stratum. Vite's external stratum is 1,521 imports and only 20 were sampled; 4 of those were internal imports misclassified as external, which expands to ~304 estimated misses. The vite recall figure therefore rests on a small sample and should be read as the weakest number here.
- **Policy choices.** Non-code assets, `.vue` SFCs, virtual modules (`?raw`, `?worker`) and build-only packages are out of scope. Another evaluator could count them as internal misses; the report would then show lower recall but the same precision.
- **Single measurement.** One index per repository, one resolver version, no repeated runs.
- **Anchoring.** Labelers see the resolver's proposed target and method. The rubric asks for independent verification; anchoring cannot be eliminated.
- **No human adjudication.** Disagreements become `uncertain` in the weighted metrics.
- **Audit sample size.** The Amendment 2 audit labeled 40 edges. Its interval is wide (83.5%–98.6%) and both labelers are AI; it bounds the new methods loosely, not tightly.
- **Round 5 has 120 resolved rows and 30 `inferred` rows.** Two errors move precision by 1.7 points. The interval (94.1%–99.5%) is reported for that reason; the point estimate should not be quoted without it.
- **Round-5 recall hides a per-repository failure.** Pooled recall passes, mocha alone does not (78.9%). Both are stated; neither rescues the other.

## Decision

The pre-registered go/no-go criteria were precision ≥95% and recall ≥85%; below 90% precision the advisory claim must be withdrawn.

| Criterion | Round 5 (current build) | Verdict |
| --- | --- | --- |
| Precision ≥95% | 98.3% (95% lower 94.1%) | pass |
| Recall ≥85% | 93.7% overall; mocha 78.9% | pass, with one repository below the pooled bar |
| `inferred` calibration | 93.3% (28/30) | pass, below `confirmed` as intended |
| Round 4, same criteria | 100% / 94.3% | pass, superseded build |

No repository-level precision failure. mocha's 78.9% recall is disclosed rather than averaged away: a repository that imports JSON config heavily will see missing edges, and pooling must not hide that.

**Supported claim:** advisory impact analysis on Python/TypeScript/JavaScript repositories, with residual misses listed above and an explicit instruction to re-index and verify before relying on absence of dependents. **Not supported:** using the result as a blocking CI gate, claiming complete dependency coverage, or treating an empty dependent list as safety.

Two false internal edges in round 5 are the main trust result: the failure mode is now measured, not assumed absent. The remaining risk is still mostly missing edges, but precision is 98.3%, not 100%, and the fix is pending.

## Reproduce

```bash
.venv/bin/repograph index /path/to/repo
.venv/bin/python benchmarks/edge_accuracy.py sample \
  --repo name=/path/to/repo --out benchmarks/eval/sample.jsonl
# label with two independent labelers per the protocol
.venv/bin/python benchmarks/edge_accuracy.py report \
  --sample benchmarks/eval/sample.jsonl \
  --labels benchmarks/eval/labels-a.jsonl \
  --labels benchmarks/eval/labels-b.jsonl \
  --out benchmarks/eval/report.json
```

Raw reports: `report-baseline.json`, `report-dev2.json`, `report-devhold.json`, `report-test.json`, `report-round5-raw.json` (round 5, with `sample-round5.jsonl`, `labels-round5-a.jsonl`, `labels-round5-b.jsonl`, `labels-round5-adjudicated.jsonl`). `report-postfix.json` is an intermediate round from a superseded build and is not used for any claim.

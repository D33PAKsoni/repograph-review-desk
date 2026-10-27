# Edge accuracy results

**Measured:** 2026-10-27
**Protocol:** [`EDGE_ACCURACY_PROTOCOL.md`](EDGE_ACCURACY_PROTOCOL.md) (pre-registered before labeling)
**Tool version:** RepoGraph 0.1.0 working tree
**Labelers:** two independent AI agents per round; no human adjudication
**Artifacts:** `benchmarks/eval/` (samples, labels, reports)

## Result in one line

On three repositories the resolver was never tuned against, sampled resolved edges were **150/150 correct** (100%; Wilson 95% lower bound 97.5%), and estimated static-import recall was **94.3%** overall, with the weakest repository at **85.5%**. The pre-fix build was far worse in exactly the ways that matter for trust: 24 false stdlib edges, 96 missed CommonJS root imports, 17 missed `.d.ts` imports, broken `tsconfig` glob aliases, and 32% recall on Express.

## Rounds

| Round | Repositories | Sample | Purpose |
| --- | --- | ---: | --- |
| baseline | fastapi, vue-core, express | 294 | measure the pre-fix build |
| dev2 | fastapi, vue-core, express | 226 | re-measure after fixes |
| devhold | requests, axios, zod | 217 | find defects on a second development set |
| **final test** | **flask, vite, svelte** | **270** | **unseen evaluation of the current build** |

`devhold` was a holdout until its labels exposed defects; those defects were fixed, so it became a development set. The `dev2` and `devhold` samples were captured before the final attribute-import refinement; the final test includes it. `flask`, `vite` and `svelte` were cloned after the last fix, indexed once, sampled with the pre-registered seed, and labeled without inspecting their unresolved imports. They were not used to change the resolver.

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

## Final test results

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

### What the test still misses

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

## Threats to validity

- **Development-set overfitting.** Fixes were derived from the development labels. The final test used new repositories, but three repositories are not a random sample of code, and repository selection was deliberate (Python app, TS monorepo, JS/TS compiler).
- **AI labelers.** Both labelers are AI agents reading the same rubric. They agreed on 91.5% of the final sample, but this is not independent human review. One labeler was consistently stricter about assets.
- **Small samples.** 150 resolved edges in the final test, 90 confirmed and 60 inferred. Rare error modes can hide. The precision lower bound is 97.5%, not 100%.
- **Weighting assumptions.** Recall uses `stratum_size / sample_size` and assumes the sample is representative within each stratum. Vite's external stratum is 1,521 imports and only 20 were sampled; 4 of those were internal imports misclassified as external, which expands to ~304 estimated misses. The vite recall figure therefore rests on a small sample and should be read as the weakest number here.
- **Policy choices.** Non-code assets, `.vue` SFCs, virtual modules (`?raw`, `?worker`) and build-only packages are out of scope. Another evaluator could count them as internal misses; the report would then show lower recall but the same precision.
- **Single measurement.** One index per repository, one resolver version, no repeated runs.
- **Anchoring.** Labelers see the resolver's proposed target and method. The rubric asks for independent verification; anchoring cannot be eliminated.
- **No human adjudication.** Disagreements become `uncertain` in the weighted metrics.

## Decision

The pre-registered go/no-go criteria were precision ≥95% and recall ≥85%.

| Criterion | Final test | Verdict |
| --- | --- | --- |
| Precision ≥95% | 100% (95% lower 97.5%) | pass |
| Recall ≥85% | 94.3% overall; vite 85.5% | pass, narrowly on vite |
| `inferred` calibration | 100% (60/60) | pass |
| Express-style CommonJS recall | 100% on development set | pass |

**Supported claim:** advisory impact analysis on Python/TypeScript/JavaScript repositories, with residual misses listed above and an explicit instruction to re-index and verify before relying on absence of dependents. **Not supported:** using the result as a blocking CI gate, claiming complete dependency coverage, or treating an empty dependent list as safety.

The final test did not contain a false resolved edge. That is the main trust result. The remaining risk is missing edges, not wrong ones.

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

Raw reports: `report-baseline.json`, `report-dev2.json`, `report-devhold.json`, `report-test.json`. `report-postfix.json` is an intermediate round from a superseded build and is not used for any claim.

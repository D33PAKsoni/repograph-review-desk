# Member 1 — Analysis and evidence package

Your outcome is **one valid, reproducible analysis bundle for one public repository and one primary file-impact scenario, delivered by 12:30 PM IST**. The website and Gemma service must be able to consume this file without running Python. You do not need either of those components to build or verify your work.

Read [CONTRACT.md](CONTRACT.md) first. Its version `1.0.0` is frozen. Use the supplied fixture as a shape example, not as real analysis or sponsor evidence.

## What you are building

The primary scenario asks: **“What might depend on `src/repograph/impact.py` if that file changes?”** It does not analyze a patch, a real pull request, or the meaning of an actual code modification. The frontend must eventually label it as a prepared scenario.

Use the public [RepoGraph repository](https://github.com/INDEX0-RESEARCH-LABS/repograph), pinned to commit `3449061d736ef72845701e0c4bf3a6ce8c916d73`, as the demo input. RepoGraph supplies static impact evidence; Graphify supplies architecture relationships around that same file. Both are analysis aids, and their incomplete results must remain visible.

Keep the existing RepoGraph engine unchanged. Your work is a small artifact-producing adapter in the companion project. An additional two supported scenarios are stretch work only after the main case passes every check.

## Ownership and independent start

You own only:

- `analysis/`: generator, dependency pins, documentation, checks, and private working files.
- `data/production/artifact-bundle.json`: the final public analysis artifact.

Do not edit `contracts/`, `fixtures/`, `bootstrap/`, `service/`, or `web/`. Do not require API endpoints, a frontend, a Gemma key, or Cloudways access. The frozen contract and examples provide everything you need to start.

Create your branch `feature/analysis`. Keep virtual environments, cloned inputs, raw graphs, SQLite indexes, and logs under an ignored `analysis/work/` directory or `analysis/.venv/`. The deliverable is a bounded JSON bundle, not an exposed repository browser.

## Required deliverables

| File | What it must contain |
|---|---|
| `analysis/build_dataset.py` | One command to run both tools, normalize real output, validate evidence references, and write the production bundle. |
| `analysis/requirements.txt` | Exact tested package versions; start with `repograph-codeintel==0.1.2` and `graphifyy==0.9.99`. Record the Python version separately. |
| `analysis/README.md` | Setup, generation command, fixed input commit, output locations, and troubleshooting. |
| `analysis/check_dataset.py` | Focused checks for stable IDs, source ranges/excerpts, tool provenance, path normalization, and the primary scenario’s useful evidence. |
| `data/production/artifact-bundle.json` | A generated bundle matching `contracts/artifact-bundle.schema.json`; use `artifactKind: "generated"`. |
| `analysis/HANDOFF.md` | The manifest below, validation output, limitations, and a short explanation of Graphify’s contribution. |

Run generation from the handoff/project root so relative output paths are predictable. Your implementation must document one command, for example `python analysis/build_dataset.py`; its internals are your responsibility.

## Work sequence and verified tool commands

First validate the supplied example independently:

```powershell
node contracts/validate.mjs --bundle fixtures/artifact-bundle.fixture.json
```

Before installing dependencies, create `analysis/requirements.txt` with these two lines:

```text
repograph-codeintel==0.1.2
graphifyy==0.9.99
```

Prepare an isolated Python environment and pinned input. These are PowerShell examples; `python` must refer to a working Python 3.10+ installation.

```powershell
python -m venv analysis/.venv
analysis/.venv/Scripts/python.exe -m pip install -r analysis/requirements.txt
git clone https://github.com/INDEX0-RESEARCH-LABS/repograph.git analysis/work/repos/repograph
git -C analysis/work/repos/repograph checkout --detach 3449061d736ef72845701e0c4bf3a6ce8c916d73
git -C analysis/work/repos/repograph rev-parse HEAD
```

The inspected RepoGraph CLI supports these commands:

```powershell
analysis/.venv/Scripts/python.exe -m repograph index analysis/work/repos/repograph --json
analysis/.venv/Scripts/python.exe -m repograph impact src/repograph/impact.py --root analysis/work/repos/repograph --depth 2 --json
analysis/.venv/Scripts/python.exe -m repograph arch --root analysis/work/repos/repograph --json
```

Your Python generator should capture stdout, check exit status, parse JSON, and save raw outputs locally. Use subprocess argument lists, not a shell-built command. It must never import, build, test, or execute the analyzed repository merely to index it.

Generate Graphify’s code-only map and query the changed file:

```powershell
analysis/.venv/Scripts/python.exe -m graphify extract analysis/work/repos/repograph --code-only --out analysis/work/graphify --max-workers 1
analysis/.venv/Scripts/python.exe -m graphify query "Architecture context around the impact analyzer" --seed src/repograph/impact.py --context call --budget 2000 --graph analysis/work/graphify/graphify-out/graph.json
```

The query is human-readable text, not JSON. Retain it as audit evidence; normalize relevant nodes and edges from `graph.json`. A query that is ambiguous or truncated is not complete evidence: narrow it or inspect the relevant graph entries and source directly. Scan from the repository root so paths retain their `src/repograph/` prefix.

## Normalization rules

Use exactly the contract’s bundle fields, including `repository.commitSha`, `tools`, `cases`, and each case’s `impact`, `architecture`, `evidence`, and `limitations`.

- Assign a stable main case ID such as `impact-module`. Evidence IDs must be stable for the same tool, relationship, path, and line range; avoid relying on unpredictable graph ordering.
- Every dependent or related test references evidence from RepoGraph. The main case’s architecture context references at least one actual Graphify evidence record.
- Preserve original confidence labels. RepoGraph’s `confirmed` and Graphify’s `EXTRACTED` are different vocabularies. Graphify’s code-only map can also contain `INFERRED` relationships; this does not mean an LLM was called.
- Read bounded source excerpts from the pinned checkout. Check line ranges against the actual file; do not invent locations for unlocated graph nodes.
- Build source links as `https://github.com/INDEX0-RESEARCH-LABS/repograph/blob/<commit>/<path>#L<start>` for one line. Append `-L<end>` only when the evidence spans multiple lines.
- Preserve tool blind spots, parse errors, truncation, and exclusions. Include the static-analysis caveat and the need to run the full test suite. Empty results never establish safety.
- Describe Graphify’s contribution factually. For example, a verified relationship may show that the CLI and MCP layer call the shared impact analyzer. Do not invent semantic community names from placeholder labels.

## Acceptance checklist

- [ ] Main case contains useful static impact evidence and source-linked Graphify architecture context.
- [ ] `node contracts/validate.mjs --bundle data/production/artifact-bundle.json` succeeds.
- [ ] All IDs resolve within their own case; paths are repository-relative POSIX paths.
- [ ] At least three cited relationships are manually checked, including one Graphify relationship.
- [ ] Rebuilding the same input preserves case and evidence identities.
- [ ] No keys, absolute workstation paths, raw graphs, indexes, or unrelated source files enter the public bundle.
- [ ] Handoff identifies all omissions; the generated artifact is never labeled as fixture data.

## Schedule and handoff

| IST | Finish this |
|---|---|
| 10:30–10:45 | Validate fixture, create environment, confirm contract and pinned checkout. |
| 10:45–11:15 | Obtain real outputs from both tools. |
| 11:15–12:00 | Normalize the single primary case and implement focused checks. |
| 12:00–12:30 | Validate, inspect citations, write manifest, commit the deliverables. |
| 12:30–1:15 | Support integration; add scenarios only if the primary case stays valid. |

In `analysis/HANDOFF.md`, record your branch/commit, input repository and commit, Python/tool versions and modes, generation command, output path and SHA-256, case IDs, validation results, known limitations, and what changed during the event. Send this manifest and the production bundle path to the team. If a tool fails, report that immediately, continue improving the adapter against the frozen fixture, and label the remaining gap; never fabricate generated evidence. Other members can continue independently against their supplied mocks.

References: [RepoGraph CLI source](https://github.com/INDEX0-RESEARCH-LABS/repograph/blob/3449061d736ef72845701e0c4bf3a6ce8c916d73/src/repograph/cli.py), [impact output](https://github.com/INDEX0-RESEARCH-LABS/repograph/blob/3449061d736ef72845701e0c4bf3a6ce8c916d73/src/repograph/impact.py), [contribution rules](https://github.com/INDEX0-RESEARCH-LABS/repograph/blob/main/CONTRIBUTING.md), and [Graphify quickstart](https://docs.graphify.com/open-source/quickstart).

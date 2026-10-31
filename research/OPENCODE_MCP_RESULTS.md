# OpenCode MCP: does an agent call the tools?

**Date:** 2026-10-31
**Question:** with the MCP server registered in a real client, does the agent actually call it?
**Answer:** not without instructions. With instructions, every run did.

## Setup

- Client: OpenCode v2.2.5 (`opencode run --format json --auto`), model `opencode/deepseek-v4.1-flash-free`.
- Repository: `project-e` (own codebase, 21 Python files, 196 symbols, 49 internal imports, 2 test files).
- Server: `repograph serve` 0.1.1, registered with `opencode mcp add repograph --global -- <path> serve`. `serve` takes its root from the working directory, and the client starts it in the project directory, so one global entry covers every indexed repository. Verified: `opencode mcp list` reports `✓ repograph connected` in the project and `failed: no index at ~/.repograph/index.db` outside it.
- OpenCode v2 exposes MCP tools through its code-mode `execute` tool (`tools.repograph.<name>`), not as top-level tools. Invocations were counted by parsing the `execute` input for `tools.repograph.`.

## Task

One prompt, repeated, read-only:

> In `src/project_e/models/validation.py` I want to add a 'context' parameter to `require()`.
> Before I make the change, list every file that would need to be updated and how.

This is the trigger case the skill text describes: a signature change on a shared module.

## Conditions

| | MCP server | Instructions in the repo |
| --- | --- | --- |
| A | yes | none |
| B | yes | `AGENTS.md` written by hand from `SKILL_BODY` |
| C | yes | written by `repograph setup . --client opencode` |

## Result

| Run | Condition | RepoGraph calls | `analyze_change_impact` |
| --- | --- | --- | --- |
| A1 | A | 0 | no |
| A2 | A | 0 | no |
| A3 | A | 0 | no |
| B1 | B | 1 (`find_references`) | no |
| B2 | B | 2 (`analyze_change_impact`, `find_references`) | **yes** |
| B3 | B | 2 (`find_references`, `analyze_change_impact`) | **yes** |
| C1 | C | 3 (`find_references`, `analyze_change_impact`, `find_related_tests`) | **yes** |

| | Runs with ≥1 call | Runs with `analyze_change_impact` |
| --- | ---: | ---: |
| A — registered, no instructions | **0/3** | 0/3 |
| B+C — registered + instructions | **4/4** | 3/4 |

Exact test on "≥1 call": all four positive runs fell in the instructed group, p = 1/C(7,4) = **0.029**.
The `analyze_change_impact`-only split (3/4 vs 0/3) is not significant at this sample size.

## What the tool contributed

Run C1 quoted the graph, not just grep:

> Blind spots worth knowing: 2 repo-level dynamic imports (`runner.py:238-239`, `__import__` of
> numpy/scipy only — not validation), and `tests/test_systems.py` reaches validation through
> `economics.py` but isn't in the selected test list. Run both test files regardless.

The second clause is `blind_spots["test-selection-reachability"]` restated in prose. The agent
used the disclosure instead of claiming completeness. That is the behaviour the skill text asks for.

Without the tool (condition A) the agents still produced correct answers using 5–9 grep/read/shell
calls. The graph's contribution is fewer calls and a stated blind spot, not a correct answer that
would otherwise be wrong. On a 21-file repository that is a small gain. It is not evidence of a
large one.

## Limits

- n = 7 runs, one model, one repository, one prompt family. Self-scored from JSON events, not blind.
- Answer quality was not measured. Ranking B/C above A on quality would be an opinion.
- The prompt named a concrete file and symbol, which helps any agent. Unprompted discovery was not tested.
- `AGENTS.md` is loaded as project instructions; a client that does not read it may behave like A.

## Consequence for the product

`repograph setup` supported `claude`, `cursor` and `codex` only, so an OpenCode user had the server
and no instructions — condition A, which measured 0/3. `--client opencode` now writes the MCP entry
into `opencode.json` and the skill text into `AGENTS.md` between markers. This is the whole reason
the flag exists; it is not a convenience wrapper.

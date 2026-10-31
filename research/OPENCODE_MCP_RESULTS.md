# OpenCode MCP: does an agent call the tools?

**Date:** 2026-10-31
**Question:** with the MCP server registered in a real client, does the agent actually call it?
**Answer:** not without instructions. With instructions, five of six runs called it — and the
one failure was a trigger the instructions did not cover.

## Setup

- Client: OpenCode v2.2.5 (`opencode run --format json --auto`), model `opencode/deepseek-v4.1-flash-free`.
- Repository: `project-e` (own codebase, 21 Python files, 196 symbols, 49 internal imports, 2 test files).
- Server: `repograph serve`, registered with
  `opencode mcp add repograph --global -- <path> serve`. `serve` takes its root from the working
  directory, and the client starts it in the project directory, so one global entry covers every
  indexed repository.
- OpenCode v2 exposes MCP tools through its code-mode `execute` tool (`tools.repograph.<name>`),
  not as top-level tools. Invocations were counted by parsing the `execute` input for `tools.repograph.`.
  Counting top-level tool names reads zero even when the agent used the tools.

## Task

Two prompts, read-only, no instruction to use any tool.

**T1 (signature change), repeated:**

> In `src/project_e/models/validation.py` I want to add a 'context' parameter to `require()`.
> Before I make the change, list every file that would need to be updated and how.

**T2 (deletion):**

> What breaks if I delete `src/project_e/models/thermal.py`?

## Conditions

| | MCP server | Instructions in the repo | Trigger list covers deletion |
| --- | --- | --- | --- |
| A | yes | none | — |
| B | yes | `AGENTS.md` written by hand from `SKILL_BODY` | no |
| C | yes | written by `repograph setup . --client opencode` | no |
| D | yes | same, after adding "deleting … a file" to the trigger list | yes |

## Result

| Run | Task | Cond | RepoGraph calls | `analyze_change_impact` |
| --- | --- | --- | --- | --- |
| A1–A3 | T1 | A | 0, 0, 0 | no |
| B1 | T1 | B | 1 (`find_references`) | no |
| B2 | T1 | B | 2 (`analyze_change_impact`, `find_references`) | **yes** |
| B3 | T1 | B | 2 (`find_references`, `analyze_change_impact`) | **yes** |
| C1 | T1 | C | 3 (`find_references`, `analyze_change_impact`, `find_related_tests`) | **yes** |
| C2 | T2 | C | 0 | no |
| C3 | T2 | D | 1 (`find_references`) | no |

| | Runs with ≥1 call | Runs with `analyze_change_impact` |
| --- | ---: | ---: |
| A — registered, no instructions (T1) | **0/3** | 0/3 |
| B+C — registered + instructions (T1) | **4/4** | 3/4 |
| C+D — instructions, deletion task (T2) | **1/2** | 0/2 |

Exact test on "≥1 call" for T1: all four positive runs fell in the instructed group,
p = 1/C(7,4) = **0.029**.

The deletion task is the interesting failure. Under condition C the agent saw "*renaming or moving
a symbol, changing a signature, editing a shared module…*" and did not consider deletion covered.
Adding "deleting … a file" took it from 0 calls to 1, but to `find_references` rather than
`analyze_change_impact`. The instruction now fires on the right class of change; tool selection
within that class is still unreliable at n=2.

## Defects this test found

**1. `setup` wrote a config shape OpenCode silently discards.** Claude and Cursor take
`{"command": "path", "args": [...]}`; OpenCode takes `{"type": "local", "command": ["path", "serve", ...]}`.
The first shape is not rejected — the client logs
`configuration normalization diagnostic … kind=invalid action="skipped malformed recognized value"`
and then reports "No MCP servers configured". The server is configured on paper, never starts, and
nothing in the tool's output says so. Reproduction, before the fix:

```
$ HOME=/tmp/empty opencode mcp list      # project opencode.json in the command+args shape
No MCP servers configured
```

after it:

```
$ HOME=/tmp/empty opencode mcp list      # project opencode.json in the argv-array shape
✓ repograph    connected
```

**2. The server exited instead of answering when the repository had no index.** `build_server`
called `_store(root).close()` as a fail-fast, which made the process exit 1 at startup. The client
renders that as `Connection closed: MCP server process exited with code 1`, which reads as a
transport failure and is indistinguishable from one. The skill text already told the agent to
"run `repograph index .` and retry once" on a "no index" error — an error the agent could never
receive, because the server was gone. Tools now return
`{"error": "FileNotFoundError: no index at …; run `repograph index …` first"}` and the connection
stays open. `tests/integration/test_mcp.py::test_mcp_server_stays_connected_without_an_index`
holds that.

**3. Not a port issue.** The transport is stdio: the client spawns a child process and talks over
pipes. There is no socket, so no port conflict and no network firewall involved. The only
port-based server in the same configuration is `open-design`, which listens on
`http://127.0.0.1:7456` and failed once exactly as a port-based server should — its daemon was not
running (`exited with code 0`).

## What the tool contributed

Run C1 quoted the graph rather than restating grep:

> Blind spots worth knowing: 2 repo-level dynamic imports (`runner.py:238-239`, `__import__` of
> numpy/scipy only — not validation), and `tests/test_systems.py` reaches validation through
> `economics.py` but isn't in the selected test list. Run both test files regardless.

The second clause is `blind_spots["test-selection-reachability"]` restated in prose. The agent used
the disclosure instead of claiming completeness.

Without the tool (condition A) the agents still produced correct answers using 5–9 grep/read/shell
calls. The graph's contribution is fewer calls and a stated blind spot, not a correct answer that
would otherwise be wrong. On a 21-file repository that is a small gain. It is not evidence of a
large one.

## Limits

- n = 7 comparable runs (plus 2 on the deletion task), one model, one repository, two prompts.
  Self-scored from JSON events, not blind.
- Answer quality was not measured. Ranking B/C above A on quality would be an opinion.
- Both prompts named a concrete file and symbol, which helps any agent. Unprompted discovery was
  not tested.
- `AGENTS.md` is loaded as project instructions; a client that does not read it behaves like A.

## Consequence for the product

`repograph setup` supported `claude`, `cursor` and `codex` only, so an OpenCode user had the server
and no instructions — condition A, which measured 0/3. `--client opencode` now writes the MCP entry
into `opencode.json` in the client's own shape and the skill text into `AGENTS.md` between markers.
The exit-on-unindexed fix matters for every client, not just this one.

# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |
| Older | No |

## Reporting a vulnerability

Please do **not** open a public issue for a suspected vulnerability.

Use GitHub's private vulnerability reporting on the repository (Security → Advisories → Report a vulnerability). If that is unavailable, contact the maintainers listed in the repository profile and ask for a private channel.

Include:

- RepoGraph version and commit.
- Operating system and Python version.
- A minimal reproduction, ideally a synthetic repository.
- Impact: data read, code execution, path escape, denial of service, or index integrity.
- Whether the issue is in RepoGraph, tree-sitter, SQLite, Typer or the MCP SDK.

Never include real credentials, private source code or personal data. Replace them with synthetic values.

## Scope

In scope:

- Execution of repository code during indexing.
- Path traversal or symlink escapes outside the repository.
- Reading or indexing secret-shaped files.
- SQL injection or index corruption from hostile repository content.
- MCP tool behavior that exceeds read-only access or leaks data outside the configured root.
- Denial of service from crafted files within documented limits.

Out of scope:

- Incomplete analysis caused by dynamic language features, reflection or unsupported languages. These are documented limitations, not vulnerabilities.
- Lack of authentication in HTTP mode when bound to localhost as documented.
- Vulnerabilities in dependencies that do not affect RepoGraph's documented behavior (report them upstream, but tell us if RepoGraph needs a pin or mitigation).
- Social engineering or prompt injection in repository text. RepoGraph treats repository content as data; agents must do the same.

## Response

We aim to acknowledge a report within seven days, agree on a disclosure timeline, and credit reporters who want credit. No bounty is offered.

## Hardening guidance for users

- Keep the HTTP MCP server bound to `127.0.0.1`.
- Do not index repositories that contain secrets in source text; filename exclusions are not content redaction.
- Review `.repograph/config.json` before indexing third-party code. Removing a user exclusion is allowed; default exclusions cannot be removed.
- Treat MCP tool output, especially documentation text and symbol names, as untrusted data.
- Run RepoGraph with the same privileges you would give any local parser. It does not execute the analyzed repository, but it is not a sandbox for a compromised dependency.

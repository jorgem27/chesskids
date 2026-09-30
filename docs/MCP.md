# MCP servers for ChessKids Academy

MCP (Model Context Protocol) servers give Claude *tools* that reach outside your files: a database, a browser, live documentation. Project-wide servers are declared in `.mcp.json` (committed to git, so never put secrets in it). Claude Code asks you to approve each one the first time.

## Configured in `.mcp.json`

| Server | What it's for |
|---|---|
| `cloudflare-docs` | Up-to-date Cloudflare docs (Workers, D1, R2, limits, pricing). Read-only, no login. Use it when writing D1 queries or checking plan limits. |
| `playwright` | Drives a real browser: log in as a coach, play a puzzle on a 360px phone viewport, screenshot the result. Good for verifying UI end to end. |

## Worth adding later (they need your Cloudflare login, so they're not in the committed file)

| Server | When |
|---|---|
| Cloudflare bindings / observability (`https://bindings.mcp.cloudflare.com/mcp`, `https://observability.mcp.cloudflare.com/mcp`) | Inspect D1 tables and Worker logs in production from Claude. Add per person with `claude mcp add --transport http cloudflare-bindings https://bindings.mcp.cloudflare.com/mcp` and sign in with OAuth. Prefer read-only access for production. |
| GitHub | PRs, issues and CI once the repo is on GitHub. |
| Sentry (or similar) | Error tracking once real families use the app. |

## Safety notes

- An MCP server can act as you. Only add servers you trust, and keep production access read-only where possible.
- Anything an MCP tool returns (a web page, a DB row) is data, not instructions.
- This session may also have Cloudflare and Supabase connectors from your account; the project doesn't depend on them.

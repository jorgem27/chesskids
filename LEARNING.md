# How Claude Code is set up in this project

Claude Code starts every session knowing nothing about your project except what it can read. These files teach it, each with a different job.

| Piece | Where | Loads when | Use it for | Example here |
|---|---|---|---|---|
| **AGENTS.md / CLAUDE.md** | project root | every session | Facts and rules that always apply: stack, commands, architecture, "never do X" | `AGENTS.md` describes the product and safety rules; `CLAUDE.md` imports it with `@AGENTS.md` |
| **Rules** | `.claude/rules/*.md` | when Claude works on files matching `paths:` | Guidance for one area, so it doesn't crowd every session | `games.md` only loads for `src/games/**` |
| **Skills** | `.claude/skills/<name>/SKILL.md` | when the task matches the description, or via `/name` | Repeatable multi-step workflows | `add-game-mode`, `d1-migration`, `deploy-cloudflare` |
| **Subagents** | `.claude/agents/*.md` | when Claude (or you) delegates a task | A specialist with its own context and limited tools, e.g. a reviewer | `chess-logic-reviewer`, `scale-reviewer`, `kid-ux-reviewer` |
| **MCP servers** | `.mcp.json` | when the session starts | New tools that reach outside the repo (browser, docs, live DB) | `cloudflare-docs`, `playwright` (see `docs/MCP.md`) |
| **Settings / hooks** | `.claude/settings.json` | always | Permissions and automatic actions (e.g. run `npm run check` after every edit) | not configured yet |

## Rules of thumb

- **Instruction files are for facts, not for essays.** Short, specific and current beats long. If a line wouldn't change what Claude does, delete it. If a rule is only true for one folder, make it a rule file with `paths:`.
- **A skill is a recipe.** If you find yourself re-explaining the same steps (add a game, add a migration), write a skill. Set `disable-model-invocation: true` on anything risky (deploy) so only you can trigger it.
- **A subagent is a second pair of eyes.** Reviewers get their own context and read-only tools, so they judge a change without the bias of the session that wrote it.
- **An MCP server is a new hand.** Skills teach Claude *how*; MCP gives it the *ability* (control a browser, query D1). Each one is also a new thing that can act as you, so add them deliberately.
- **Enforce with code when it matters.** "Always run tests" in a markdown file is a request; a hook in settings is a guarantee.
- **Re-read these files now and then.** They go stale as the project changes. `/claude-api prompt-audit` (or a manual review) finds outdated lines.

## Why this project needs them

The app must scale to many clubs and thousands of children, so the most expensive mistakes are cross-club data leaks, client-trusted rewards, and unindexed queries. Those are exactly what `AGENTS.md`, `api-and-database.md` and `scale-reviewer` guard against. The other big risk is production: migrations and deploys are behind skills and explicit rules so nothing touches real data by accident.

## Already done

- Loose one-off scripts moved to `scripts/oneoff/`.
- A `Stop` hook (`.claude/settings.json` → `scripts/hooks/verify.mjs`) runs `npm run check` and `npm test` before Claude finishes whenever `src/` or `tests/` changed, and sends failures back to Claude.
- GitHub Actions CI (`.github/workflows/ci.yml`) runs check, test and build on every push and pull request. It only takes effect once the repo is on GitHub.

## Suggested next steps

1. Push the repo to GitHub (private) so CI runs.
2. Add Cloudflare observability and error tracking once real users arrive.

@AGENTS.md

## Claude Code specifics

- Use the `add-game-mode`, `d1-migration` and `deploy-cloudflare` skills for those workflows instead of improvising.
- After changing chess logic, gamification math or D1 queries, run the matching reviewer subagent (`chess-logic-reviewer`, `scale-reviewer`); after UI changes, `kid-ux-reviewer`.
- The dev server is defined in `.claude/launch.json` (`dev`, port 4321).

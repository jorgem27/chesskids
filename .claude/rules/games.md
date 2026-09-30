---
paths:
  - "src/games/**"
---

# Game modules

- A game talks to the shell only through `GameApi` (`src/games/types.ts`): `good`, `bad`, `say`, `progress`, `combo`, `finish`, `speak`. Don't import sounds, confetti or rewards directly; that keeps XP, stickers and homework working for every game.
- `finish()` reports raw performance (`score`, `maxScore`, `mistakes`, `puzzlesSolved`). XP is calculated on the server in `src/lib/rewards.ts`.
- Each game has `validate` and `defaultContent` in `meta.ts`. Validate on the server too: coach content is untrusted input.
- Chess legality comes from chess.js, never hand-rolled move generation (except in solvers such as fruit, where the piece movement must be tested against chess.js).
- Pure logic (solvers, scoring, PGN parsing) goes in a `logic.ts`/`parser.ts` file with no Preact imports, so `tests/` can cover it.
- Accept every legal alternative the coach marked as correct in PGN lessons, not only the main line.
- Load heavy dependencies (Stockfish, PDF viewer) lazily, only when the game mounts.

---
name: add-game-mode
description: Add a new game type to ChessKids Academy (metadata, Player, Editor, registry, tests). Use when the user wants a new game mode, minigame or activity type.
---

# Add a game mode

Look at an existing small game first (`src/games/fruit/`) and match its structure.

1. **Define the content shape** as a TypeScript type for the game's `content` JSON (what a coach saves).
2. **Metadata** in `src/games/meta.ts`: id (kebab-case), Spanish name, emoji, age suitability, `validate(content)` (used on the server too) and `defaultContent`.
3. **Pure logic** in `src/games/<name>/logic.ts` with no Preact imports, so it can be tested.
4. **Player** component: receives `{ content, api, title }`. Report only through `GameApi` and finish with `api.finish({ score, maxScore, mistakes, puzzlesSolved })`. Give instant feedback with `good`/`bad`/`say`.
5. **Editor** component: `{ value, onChange }`. Aim for the coach creating a level in under a minute (tap/paint/paste, not forms full of fields).
6. **Register** both in `src/games/registry.ts`.
7. **Tests** in `tests/` for the logic and for `validate` (valid, empty and malicious content).
8. Check whether `src/lib/rewards.ts` needs a rule for the game's `perfect` or scoring, and whether the server validates the new type in `src/pages/api/coach/activities/`.
9. Run `npm run check`, `npm test`, then try creating and playing one activity in `npm run dev`.

Homework, XP, stickers, the coach panel and the preview should then work without further changes; if one doesn't, fix the shared code rather than special-casing the game.

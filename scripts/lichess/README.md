# Lichess puzzles

Coaches can build a puzzle activity from the Lichess puzzle database: pick a theme, an Elo range and a count
("⚡ Generar desde Lichess" in the puzzle editor, or "Puzzles rápidos de Lichess" in the activity library).

## How it works

- The source is `lichess_db_puzzle.csv.zst` from https://database.lichess.org/ (CC0, ~6M puzzles).
- `build.ts` keeps a curated subset:
  - Popularity ≥ 80, NbPlays ≥ 300, RatingDeviation ≤ 90;
  - at most 9 moves;
  - Elo 400–2800;
  - about 300 puzzles per (theme × 100-Elo bucket), only for the themes in `src/lib/lichessThemes.ts`.

  That leaves about 105k puzzles and 25 MB of SQL.
- The rows go into two global tables (`migrations/0006_lichess_puzzles.sql`). They are shared by every club and hold no tenant data.
- `/api/coach/lichess-puzzles` picks random puzzles. When the coach saves, the puzzles are **copied** into the activity. Students never read these tables and never contact lichess.org.

## Building and loading

```bash
npm run puzzles:build -- C:/Users/you/Downloads/lichess_db_puzzle.csv    # .csv or .csv.zst, ~3 min
npm run puzzles:load                                                     # local D1, ~5 min
```

The output lands in `seed/lichess/*.sql`, which is gitignored. The first file empties both tables, so re-running refreshes the data.

## Production

This writes about 540k rows to the production D1. Apply migration 0006 first (`push.bat` does it), then run:

```bash
npm run puzzles:load -- --remote
```

Changed the theme list in `lichessThemes.ts`? Rebuild and reload.

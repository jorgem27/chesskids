-- Curated subset of the Lichess puzzle database (CC0, database.lichess.org).
-- Global read-only reference data shared by every club: it holds no tenant data, so no club_id.
-- Coaches copy puzzles from here into an activity's content_json; students never read these tables.
-- Filled by scripts/lichess (npm run puzzles:build / puzzles:load).
CREATE TABLE IF NOT EXISTS lichess_puzzles (
  id TEXT PRIMARY KEY,
  fen TEXT NOT NULL,          -- Lichess format: position BEFORE the opponent's first move
  moves TEXT NOT NULL,        -- UCI, space separated, starting with the opponent's move
  rating INTEGER NOT NULL,
  popularity INTEGER NOT NULL,
  themes TEXT NOT NULL
) WITHOUT ROWID;

-- One row per (theme, puzzle): the PK serves "theme = ? AND rating BETWEEN ? AND ?".
CREATE TABLE IF NOT EXISTS lichess_puzzle_themes (
  theme TEXT NOT NULL,
  rating INTEGER NOT NULL,
  puzzle_id TEXT NOT NULL,
  PRIMARY KEY (theme, rating, puzzle_id)
) WITHOUT ROWID;

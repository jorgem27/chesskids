// Coach insights built from item_results: which items a class fails, weak Lichess themes,
// and the puzzles that go into an automatic review.
import type { Puzzle } from '../games/puzzle/logic';
import { LICHESS_THEMES } from './lichessThemes';

export interface Cell { firstOk: boolean; oks: number; tries: number }
export type CellState = 'ok' | 'fixed' | 'fail' | 'none';

/** green = right first time, amber = failed first but solved later, red = still failing. */
export function cellState(c: Cell | undefined): CellState {
  if (!c) return 'none';
  if (c.firstOk) return 'ok';
  return c.oks > 0 ? 'fixed' : 'fail';
}

/** Share of students who failed an item the first time (null when nobody played it). */
export function failRate(cells: (Cell | undefined)[]): number | null {
  const played = cells.filter((c): c is Cell => !!c);
  if (!played.length) return null;
  return played.filter((c) => !c.firstOk).length / played.length;
}

const THEME_LABEL = new Map(LICHESS_THEMES.map((t) => [t.key, t]));
// Generic tags that say little about *what* the kid should practice.
const SKIP_THEMES = new Set(['mix', 'short', 'long', 'oneMove', 'veryLong', 'middlegame', 'opening', 'endgame', 'master', 'masterVsMaster', 'superGM', 'crushing', 'advantage', 'equality', 'mate']);

export interface ThemeStat { key: string; label: string; emoji: string; played: number; failed: number; rate: number }

/**
 * Aggregates first-try results per Lichess theme. `results` = one entry per (student, puzzle)
 * with the Lichess themes of that puzzle (space separated, as stored in lichess_puzzles).
 */
export function themeStats(results: { themes: string; ok: boolean }[], minPlayed = 3): ThemeStat[] {
  const agg = new Map<string, { played: number; failed: number }>();
  for (const r of results) {
    for (const t of r.themes.split(' ')) {
      if (!THEME_LABEL.has(t) || SKIP_THEMES.has(t)) continue;
      const a = agg.get(t) ?? { played: 0, failed: 0 };
      a.played++;
      if (!r.ok) a.failed++;
      agg.set(t, a);
    }
  }
  return [...agg.entries()]
    .filter(([, a]) => a.played >= minPlayed)
    .map(([key, a]) => ({ key, label: THEME_LABEL.get(key)!.label, emoji: THEME_LABEL.get(key)!.emoji, ...a, rate: a.failed / a.played }))
    .sort((x, y) => y.rate - x.rate || y.played - x.played);
}

/** Puzzle `item` of an activity's content, if the activity is a puzzle set. */
export function puzzleAt(contentJson: string, item: number): Puzzle | null {
  try {
    const p = (JSON.parse(contentJson).puzzles as Puzzle[] | undefined)?.[item];
    return p?.fen && p.moves?.length ? p : null;
  } catch {
    return null;
  }
}

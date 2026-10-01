// Practice outside homework: "Repaso" (my mistakes), "Problema del día" and "Entrena" (rated).
// The server picks the puzzles and stores them in practice_sessions, so results can only be
// reported for puzzles it actually served.
import { fromLichess, type Puzzle } from '../games/puzzle/logic';
import type { PracticeKind } from './rewards';

export type PracticeSrc = { activityId: number; item: number } | { lichessId: string; rating: number };
export interface ServedPuzzle { puzzle: Puzzle; src: PracticeSrc }

export const PUZZLE_TYPES = ['puzzle-hint', 'puzzle-blitz'];
export const REVIEW_SIZE = 8;
export const TRAINING_SIZE = 5;
/** Only mistakes from the last N days go to the review. */
export const REVIEW_DAYS = 60;

/** Game mode used to play each practice kind. */
export const PRACTICE_MODE: Record<PracticeKind, 'puzzle-hint' | 'puzzle-blitz'> = {
  repaso: 'puzzle-hint',
  diario: 'puzzle-hint',
  entrena: 'puzzle-blitz', // a mistake reveals the answer: clean solved / failed for the rating
};

export const PRACTICE_TITLE: Record<PracticeKind, string> = {
  repaso: 'Repaso de fallos',
  diario: 'Problema del día',
  entrena: 'Entrena',
};

// ---------- Daily puzzle (pure: same for every student of an age group on a day) ----------

const DAILY_THEMES = ['mateIn1', 'hangingPiece', 'fork', 'mateIn2', 'pin', 'backRankMate', 'skewer', 'discoveredAttack', 'trappedPiece', 'promotion'];
const DAILY_BANDS: Record<string, [number, number]> = { peque: [450, 750], explorador: [700, 1100], maestro: [1000, 1500] };

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Theme and target rating of the daily puzzle for `day` (YYYY-MM-DD) and an age group. */
export function dailyPick(day: string, ageGroup: string): { theme: string; rating: number; max: number } {
  const [lo, hi] = DAILY_BANDS[ageGroup] ?? DAILY_BANDS.explorador;
  const h = hash(`${day}:${ageGroup}`);
  const dayNum = Math.floor(Date.parse(`${day}T12:00:00Z`) / 86400000);
  return { theme: DAILY_THEMES[dayNum % DAILY_THEMES.length], rating: lo + (h % (hi - lo)), max: hi };
}

// ---------- Queries ----------

type LichessRow = { id: string; fen: string; moves: string; rating: number };

function toServed(rows: LichessRow[]): ServedPuzzle[] {
  const out: ServedPuzzle[] = [];
  for (const r of rows) {
    const p = fromLichess(r.fen, r.moves.split(' '));
    if (p) out.push({ puzzle: { ...p, lichessId: r.id, rating: r.rating }, src: { lichessId: r.id, rating: r.rating } });
  }
  return out;
}

export async function dailyPuzzle(db: D1Database, day: string, ageGroup: string): Promise<ServedPuzzle | null> {
  const pick = dailyPick(day, ageGroup);
  const row = await db.prepare(
    `SELECT p.id, p.fen, p.moves, p.rating FROM lichess_puzzle_themes t JOIN lichess_puzzles p ON p.id = t.puzzle_id
     WHERE t.theme = ? AND t.rating BETWEEN ? AND ? ORDER BY t.rating, t.puzzle_id LIMIT 1`,
  ).bind(pick.theme, pick.rating, pick.max).first<LichessRow>();
  return row ? toServed([row])[0] ?? null : null;
}

/** Lichess puzzles around the student's rating, skipping the ones played recently. */
export async function trainingPuzzles(db: D1Database, studentId: number, rating: number, theme: string): Promise<ServedPuzzle[]> {
  const { results: recent } = await db.prepare(
    "SELECT lichess_id FROM item_results WHERE student_id = ? AND lichess_id IS NOT NULL ORDER BY id DESC LIMIT 60",
  ).bind(studentId).all<{ lichess_id: string }>();
  const exclude = recent.map((r) => r.lichess_id);
  const notIn = exclude.length ? ` AND puzzle_id NOT IN (${exclude.map(() => '?').join(',')})` : '';
  const { results } = await db.prepare(
    `SELECT id, fen, moves, rating FROM lichess_puzzles WHERE id IN (
       SELECT puzzle_id FROM lichess_puzzle_themes WHERE theme = ? AND rating BETWEEN ? AND ?${notIn} ORDER BY random() LIMIT ?)`,
  ).bind(theme, rating - 120, rating + 150, ...exclude, TRAINING_SIZE).all<LichessRow>();
  return toServed(results.sort((a, b) => a.rating - b.rating));
}

/** Puzzle items the student failed and has not solved since (latest result per item is a fail). */
export async function pendingMistakes(db: D1Database, studentId: number, since: string, limit = REVIEW_SIZE): Promise<ServedPuzzle[]> {
  const { results } = await db.prepare(
    `SELECT ir.activity_id, ir.item, a.content_json FROM item_results ir
     JOIN (SELECT activity_id, item, MAX(id) AS last FROM item_results
           WHERE student_id = ? AND activity_id IS NOT NULL AND day >= ? GROUP BY activity_id, item) x ON x.last = ir.id
     JOIN activities a ON a.id = ir.activity_id AND a.type IN ('puzzle-hint', 'puzzle-blitz')
     WHERE ir.ok = 0 ORDER BY ir.id DESC LIMIT ?`,
  ).bind(studentId, since, limit).all<{ activity_id: number; item: number; content_json: string }>();
  const out: ServedPuzzle[] = [];
  for (const r of results) {
    try {
      const p = (JSON.parse(r.content_json).puzzles as Puzzle[])[r.item];
      if (p?.fen && p.moves?.length) out.push({ puzzle: p, src: { activityId: r.activity_id, item: r.item } });
    } catch { /* activity content changed: skip */ }
  }
  return out;
}

/** How many puzzle mistakes are waiting in the review (dashboard badge; no content parsing). */
export async function countPendingMistakes(db: D1Database, studentId: number, since: string): Promise<number> {
  const r = await db.prepare(
    `SELECT COUNT(*) AS n FROM item_results ir
     JOIN (SELECT activity_id, item, MAX(id) AS last FROM item_results
           WHERE student_id = ? AND activity_id IS NOT NULL AND day >= ? GROUP BY activity_id, item) x ON x.last = ir.id
     JOIN activities a ON a.id = ir.activity_id AND a.type IN ('puzzle-hint', 'puzzle-blitz')
     WHERE ir.ok = 0`,
  ).bind(studentId, since).first<{ n: number }>();
  return r?.n ?? 0;
}

export async function createSession(db: D1Database, studentId: number, kind: PracticeKind, day: string, served: ServedPuzzle[]): Promise<number> {
  const row = await db.prepare('INSERT INTO practice_sessions (student_id, kind, puzzles_json, day) VALUES (?, ?, ?, ?) RETURNING id')
    .bind(studentId, kind, JSON.stringify(served), day).first<{ id: number }>();
  return row!.id;
}

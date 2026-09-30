import type { APIRoute } from 'astro';
import { fromLichess, type Puzzle } from '../../../games/puzzle/logic';
import { isClubMember, json, readJson } from '../../../lib/db';
import { ELO_MAX, ELO_MIN, LICHESS_THEME_KEYS, MAX_ELO_SPAN, MAX_PUZZLES } from '../../../lib/lichessThemes';

interface Body { clubId: number; theme: string; minRating: number; maxRating: number; count: number; exclude?: string[] }

const clamp = (v: unknown, lo: number, hi: number, dflt: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};

/** Random puzzles from the (global, club-independent) Lichess table, converted to our format. */
export const POST: APIRoute = async ({ locals, request }) => {
  const db = locals.db;
  const b = (await readJson<Body>(request)) ?? ({} as Body);
  if (!(await isClubMember(db, locals.coach!.id, Number(b.clubId)))) return json({ error: 'No perteneces a ese club' }, 403);
  if (typeof b.theme !== 'string' || !LICHESS_THEME_KEYS.has(b.theme)) return json({ error: 'Tema no válido' }, 400);
  let min = clamp(b.minRating, ELO_MIN, ELO_MAX, 800);
  let max = clamp(b.maxRating, ELO_MIN, ELO_MAX, 1200);
  if (min > max) [min, max] = [max, min];
  max = Math.min(max, min + MAX_ELO_SPAN); // bounds the rows scanned per request
  const count = clamp(b.count, 1, MAX_PUZZLES, 10);
  const exclude = (Array.isArray(b.exclude) ? b.exclude : [])
    .filter((id): id is string => typeof id === 'string' && /^[A-Za-z0-9]{5,8}$/.test(id)).slice(0, 90);

  const notIn = exclude.length ? ` AND puzzle_id NOT IN (${exclude.map(() => '?').join(',')})` : '';
  let rows: { id: string; fen: string; moves: string; rating: number }[];
  try {
    ({ results: rows } = await db.prepare(
      `SELECT id, fen, moves, rating FROM lichess_puzzles WHERE id IN (
         SELECT puzzle_id FROM lichess_puzzle_themes WHERE theme = ? AND rating BETWEEN ? AND ?${notIn} ORDER BY random() LIMIT ?)`,
    ).bind(b.theme, min, max, ...exclude, count).all<{ id: string; fen: string; moves: string; rating: number }>());
  } catch {
    return json({ error: 'No se pudieron cargar los problemas. Inténtalo de nuevo.' }, 500);
  }

  const puzzles: (Puzzle & { lichessId: string; rating: number })[] = [];
  for (const r of rows.sort((x, y) => x.rating - y.rating)) {
    const p = fromLichess(r.fen, r.moves.split(' '));
    if (p) puzzles.push({ ...p, lichessId: r.id, rating: r.rating });
  }
  return json({ puzzles });
};

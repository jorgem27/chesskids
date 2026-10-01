import type { APIRoute } from 'astro';
import { json, readJson, today } from '../../lib/db';
import type { ServedPuzzle } from '../../lib/practice';
import { awardStickers, cleanItems, rewardPayload } from '../../lib/progress';
import { nextRating, nextStreak, practiceXp, RATING_SESSION_CAP, startRating, TRAINING_DAILY_XP_CAP, type PracticeKind } from '../../lib/rewards';

/** A puzzle can't be solved faster than this (server clock, from serving to finishing). */
const MIN_SECONDS_PER_PUZZLE = 3;

interface Body { sessionId: number; seconds: number; items?: unknown }

/** Finishes a practice session served by /app/practica/*: XP, rating, streak and item results. */
export const POST: APIRoute = async ({ locals, request }) => {
  const s = locals.student;
  const db = locals.db;
  if (!s) return json({ error: 'Inicia sesión' }, 401);
  const b = await readJson<Body>(request);

  const session = await db.prepare(
    'SELECT id, kind, puzzles_json, finished_at, unixepoch() - created_at AS elapsed FROM practice_sessions WHERE id = ? AND student_id = ? AND created_at > unixepoch() - 86400',
  ).bind(Number(b.sessionId), s.id).first<{ id: number; kind: PracticeKind; puzzles_json: string; finished_at: number | null; elapsed: number }>();
  if (!session) return json({ error: 'Sesión no encontrada. Vuelve a empezar.' }, 404);
  if (session.finished_at) return json({ duplicate: true });

  const served = JSON.parse(session.puzzles_json) as ServedPuzzle[];
  // Results come from the client: never more solved puzzles (or time) than the real time allows.
  const plausible = Math.floor(Math.max(0, session.elapsed) / MIN_SECONDS_PER_PUZZLE);
  let budget = plausible;
  const items = cleanItems(b.items, served.length).map((it) => (it.ok && budget-- > 0 ? it : { ...it, ok: false }));
  const solved = items.filter((i) => i.ok).length;
  const mistakes = items.reduce((t, i) => t + i.mistakes, 0);
  const seconds = Math.max(0, Math.min(1800, session.elapsed, Math.round(Number(b.seconds) || 0)));
  const day = today();

  // XP already earned today with this kind: the daily puzzle pays once, training is capped.
  const earned = await db.prepare(
    'SELECT COALESCE(SUM(xp_earned), 0) AS x, COUNT(*) AS n FROM practice_sessions WHERE student_id = ? AND kind = ? AND day = ? AND finished_at IS NOT NULL',
  ).bind(s.id, session.kind, day).first<{ x: number; n: number }>();
  const cap = session.kind === 'diario' ? ((earned?.n ?? 0) > 0 ? 0 : Infinity)
    : session.kind === 'entrena' ? Math.max(0, TRAINING_DAILY_XP_CAP - (earned?.x ?? 0)) : 80 - Math.min(80, earned?.x ?? 0);
  const xp = practiceXp(session.kind, solved, served.length, seconds, cap);

  // Claim the session first so a double submit can't pay twice.
  const claim = await db.prepare(
    'UPDATE practice_sessions SET finished_at = unixepoch(), solved = ?, xp_earned = ?, seconds = ?, day = ? WHERE id = ? AND finished_at IS NULL',
  ).bind(solved, xp.total, seconds, day, session.id).run();
  if (!claim.meta.changes) return json({ duplicate: true });

  // Tactics rating (Entrena only), one update per puzzle in order.
  let rating = s.puzzle_rating || startRating(s.age_group);
  let games = s.puzzle_games;
  const ratingBefore = rating;
  if (session.kind === 'entrena') {
    served.forEach((p, i) => {
      if (!items[i] || !('rating' in p.src)) return;
      rating = nextRating(rating, games++, p.src.rating, items[i].ok);
    });
    rating = Math.max(ratingBefore - RATING_SESSION_CAP, Math.min(ratingBefore + RATING_SESSION_CAP, rating));
  }

  const streak = nextStreak(s.last_active_day, s.streak, day);
  const stmts = [
    db.prepare(`UPDATE students SET xp = xp + ?, streak = ?, best_streak = MAX(best_streak, ?), last_active_day = ?,
      total_seconds = total_seconds + ?, puzzles_solved = puzzles_solved + ?, puzzle_rating = ?, puzzle_games = ? WHERE id = ?`)
      .bind(xp.total, streak.streak, streak.streak, day, seconds, solved, session.kind === 'entrena' ? rating : s.puzzle_rating, games, s.id),
    ...items.map((it, i) => {
      const src = served[i].src;
      return db.prepare(
        'INSERT INTO item_results (student_id, activity_id, item, lichess_id, source, ok, mistakes, seconds, day) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).bind(s.id, 'activityId' in src ? src.activityId : null, 'activityId' in src ? src.item : null, 'lichessId' in src ? src.lichessId : null,
        session.kind, it.ok ? 1 : 0, it.mistakes, it.seconds, day);
    }),
  ];
  await db.batch(stmts);

  const updated = {
    ...s, xp: s.xp + xp.total, streak: streak.streak, total_seconds: s.total_seconds + seconds,
    puzzles_solved: s.puzzles_solved + solved, puzzle_rating: session.kind === 'entrena' ? rating : s.puzzle_rating, puzzle_games: games,
  };
  const newStickers = await awardStickers(db, updated, [], { puzzlesSolved: solved, mistakes });

  return json(await rewardPayload(db, s, updated, xp, {
    firstTime: true,
    streak: { value: streak.streak, extended: streak.extended && s.last_active_day !== day },
    newStickers,
    extra: {
      practice: {
        kind: session.kind, solved, total: served.length, capped: xp.total < practiceXp(session.kind, solved, served.length, seconds).total,
        rating: session.kind === 'entrena' ? { before: ratingBefore, after: rating } : null,
      },
    },
  }));
};

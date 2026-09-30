// Saves a finished projector tournament and hands out its XP (recomputed here, never trusted from the client).
import type { APIRoute } from 'astro';
import { attemptAggregates, classPerm, json, readJson, toStats, today, type StudentRow } from '../../../lib/db';
import { creditedSeconds, distributeXp, isAllowedBudget, MAX_XP_TOURNAMENTS_PER_DAY, validateTournament, type KidTally } from '../../../lib/projector';
import { earnedStickers, nextStreak } from '../../../lib/rewards';

interface Body {
  classId: number;
  nonce: string;
  xpBudget: number;
  puzzlesPlayed: number;
  seconds: number;
  teams: { name: string; emoji: string; color: string; score: number }[];
  kids: KidTally[];
}

const NONCE = /^[a-zA-Z0-9-]{8,64}$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;

async function storedResult(db: D1Database, classId: number, nonce: string) {
  const s = await db.prepare('SELECT id FROM projector_sessions WHERE class_id = ? AND nonce = ?').bind(classId, nonce).first<{ id: number }>();
  if (!s) return null;
  const { results } = await db.prepare('SELECT student_id AS studentId, xp_earned AS total FROM projector_results WHERE session_id = ?')
    .bind(s.id).all<{ studentId: number; total: number }>();
  return json({ ok: true, sessionId: s.id, results, newStickers: {} });
}

export const POST: APIRoute = async ({ locals, request }) => {
  const db = locals.db;
  const coachId = locals.coach!.id;
  const b = await readJson<Body>(request);
  const classId = Number(b.classId);
  if (!Number.isInteger(classId) || classId <= 0) return json({ error: 'Clase no válida' }, 400);
  const perm = await classPerm(db, coachId, classId);
  // Handing out XP, streaks and stickers changes students' progress: owner or student managers only.
  if (!perm || !(perm.is_owner || perm.can_manage_students)) return json({ error: 'No tienes permiso para dar XP en esta clase' }, 403);
  const nonce = String(b.nonce ?? '');
  if (!NONCE.test(nonce)) return json({ error: 'Falta el identificador del torneo' }, 400);
  if (!isAllowedBudget(b.xpBudget)) return json({ error: 'Premio de XP no válido' }, 400);
  if (!Array.isArray(b.teams) || b.teams.length > 4 || !Array.isArray(b.kids) || b.kids.length > 60) return json({ error: 'Datos del torneo no válidos' }, 400);

  const cls = await db.prepare('SELECT club_id FROM classes WHERE id = ?').bind(classId).first<{ club_id: number }>();
  if (!cls) return json({ error: 'Clase no encontrada' }, 404);

  // Idempotent: a retried save returns what was stored the first time.
  const again = await storedResult(db, classId, nonce);
  if (again) return again;

  const teams = b.teams.map((t) => ({
    name: String(t?.name ?? '').slice(0, 30),
    emoji: String(t?.emoji ?? '').slice(0, 8),
    color: COLOR.test(String(t?.color)) ? String(t.color) : '#64748b',
    score: Number(t?.score),
  }));
  const kids: KidTally[] = b.kids.map((k) => ({
    studentId: Number(k?.studentId), team: Number(k?.team), picks: Number(k?.picks), solved: Number(k?.solved), points: Number(k?.points),
  }));
  const puzzlesPlayed = Number(b.puzzlesPlayed);
  const bad = validateTournament({ teams, kids, puzzlesPlayed });
  if (bad) return json({ error: bad }, 400);

  const budget = Number(b.xpBudget);
  const day = today();
  if (budget > 0) {
    const n = await db.prepare('SELECT COUNT(*) AS n FROM projector_sessions WHERE class_id = ? AND day = ? AND xp_budget > 0')
      .bind(classId, day).first<{ n: number }>();
    if ((n?.n ?? 0) >= MAX_XP_TOURNAMENTS_PER_DAY) {
      return json({ error: `Hoy ya se ha dado XP en ${MAX_XP_TOURNAMENTS_PER_DAY} torneos. Juega este como práctica (sin XP).` }, 400);
    }
  }

  // Every participant must be an active student of this class.
  const { results: rows } = await db.prepare(
    `SELECT id, class_id, xp, streak, best_streak, last_active_day, total_seconds, puzzles_solved, games_completed
     FROM students WHERE class_id = ? AND archived = 0`,
  ).bind(classId).all<StudentRow>();
  const byId = new Map(rows.map((r) => [r.id, r]));
  if (kids.some((k) => !byId.has(k.studentId))) return json({ error: 'Algún alumno no es de esta clase' }, 400);

  const seconds = creditedSeconds(b.seconds, puzzlesPlayed);
  const split = distributeXp(budget, teams.map((t) => t.score), kids);
  const xpById = new Map(split.map((x) => [x.studentId, x.total]));

  // Sticker bookkeeping, same rule as /api/attempts: only stickers not already earned before this tournament.
  const ids = kids.map((k) => k.studentId);
  const [aggs, owned] = await Promise.all([
    attemptAggregates(db, ids),
    db.prepare('SELECT st.student_id, st.sticker_id FROM student_stickers st JOIN students s ON s.id = st.student_id WHERE s.class_id = ?')
      .bind(classId).all<{ student_id: number; sticker_id: string }>(),
  ]);

  const stmts: D1PreparedStatement[] = [
    db.prepare(`INSERT INTO projector_sessions (club_id, class_id, coach_id, nonce, xp_budget, puzzles_played, seconds, teams_json, day)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(cls.club_id, classId, coachId, nonce, budget, puzzlesPlayed, seconds, JSON.stringify(teams), day),
  ];
  const sessionId = '(SELECT id FROM projector_sessions WHERE class_id = ? AND nonce = ?)';
  const newStickers: Record<number, string[]> = {};

  for (const k of kids) {
    const s = byId.get(k.studentId)!;
    const xp = xpById.get(k.studentId)!;
    const streak = nextStreak(s.last_active_day, s.streak, day);
    stmts.push(
      db.prepare(`INSERT INTO projector_results (session_id, student_id, team, picks, solved, points, xp_earned, day)
        VALUES (${sessionId}, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(classId, nonce, k.studentId, k.team, k.picks, k.solved, k.points, xp, day),
      db.prepare(`UPDATE students SET xp = xp + ?, streak = ?, best_streak = MAX(best_streak, ?), last_active_day = ?,
        total_seconds = total_seconds + ?, puzzles_solved = puzzles_solved + ? WHERE id = ? AND class_id = ?`)
        .bind(xp, streak.streak, streak.streak, day, seconds, k.solved, k.studentId, classId),
    );
    const agg = aggs.get(k.studentId);
    const had = new Set(earnedStickers(toStats(s, agg)));
    owned.results.forEach((o) => { if (o.student_id === s.id) had.add(o.sticker_id); });
    const after = { ...s, xp: s.xp + xp, streak: streak.streak, total_seconds: s.total_seconds + seconds, puzzles_solved: s.puzzles_solved + k.solved };
    const fresh = earnedStickers(toStats(after, agg)).filter((id) => !had.has(id));
    if (fresh.length) newStickers[s.id] = fresh;
    fresh.forEach((id) => stmts.push(db.prepare('INSERT OR IGNORE INTO student_stickers (student_id, sticker_id) VALUES (?, ?)').bind(s.id, id)));
  }

  try {
    await db.batch(stmts); // single transaction
  } catch (e) {
    // A concurrent save with the same nonce won the race: its batch rolled ours back; return its result.
    const raced = await storedResult(db, classId, nonce);
    if (raced) return raced;
    throw e;
  }
  const saved = await db.prepare('SELECT id FROM projector_sessions WHERE class_id = ? AND nonce = ?').bind(classId, nonce).first<{ id: number }>();
  return json({ ok: true, sessionId: saved?.id, results: split.map((x) => ({ studentId: x.studentId, total: x.total })), newStickers });
};

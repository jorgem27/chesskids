import type { APIRoute } from 'astro';
import { checkActivity, clampXp } from '../../../lib/activities';
import { classPerm, json, readJson, today, VISIBLE_ACTIVITY_SQL } from '../../../lib/db';
import { addDays, shortDate } from '../../../lib/dates';
import { puzzleAt, themeStats } from '../../../lib/insights';
import { fromLichess, type Puzzle } from '../../../games/puzzle/logic';

interface Body {
  classId: number;
  /** Only this activity's mistakes (otherwise every puzzle activity of the last `days`). */
  activityId?: number | null;
  days?: number;
  mode?: 'puzzle-hint' | 'puzzle-blitz';
  /** Add a similar Lichess puzzle (same theme, similar rating) after each failed one. */
  similar?: boolean;
  /** Assign it to the class right away (one week). */
  assign?: boolean;
}

const MAX_FAILED = 12;

/** Builds a private review activity with the puzzles a class failed most. */
export const POST: APIRoute = async ({ locals, request }) => {
  const db = locals.db;
  const coach = locals.coach!;
  const b = await readJson<Body>(request);
  const classId = Number(b.classId);
  const perm = await classPerm(db, coach.id, classId);
  // It reads the class's results (progress) and creates homework (content): both permissions.
  if (!perm || !(perm.is_owner || (perm.can_create_content && perm.can_view_progress))) {
    return json({ error: 'Necesitas poder ver el progreso y poner deberes en esta clase' }, 403);
  }
  const cls = await db.prepare('SELECT id, club_id, name FROM classes WHERE id = ?').bind(classId).first<{ id: number; club_id: number; name: string }>();
  if (!cls) return json({ error: 'Clase no encontrada' }, 404);

  const mode = b.mode === 'puzzle-blitz' ? 'puzzle-blitz' : 'puzzle-hint';
  const days = Math.max(1, Math.min(90, Math.round(Number(b.days) || 14)));
  const activityId = Number(b.activityId) || null;
  const t = today();

  // Items failed by the most students (first try or later), puzzle activities of this club only.
  const { results: failed } = await db.prepare(
    `SELECT ir.activity_id, ir.item, COUNT(DISTINCT ir.student_id) AS kids
     FROM item_results ir
     JOIN students s ON s.id = ir.student_id AND s.class_id = ? AND s.archived = 0
     JOIN activities a ON a.id = ir.activity_id AND a.club_id = ? AND a.type IN ('puzzle-hint', 'puzzle-blitz') AND ${VISIBLE_ACTIVITY_SQL}
     WHERE ir.source = 'activity' AND ir.ok = 0 AND ir.day >= ?${activityId ? ' AND ir.activity_id = ?' : ''}
     GROUP BY ir.activity_id, ir.item ORDER BY kids DESC, ir.activity_id, ir.item LIMIT ?`,
  ).bind(classId, cls.club_id, coach.id, addDays(t, -days), ...(activityId ? [activityId] : []), MAX_FAILED).all<{ activity_id: number; item: number; kids: number }>();
  if (!failed.length) return json({ error: 'No hay problemas fallados en ese periodo. ¡Tu clase lo está bordando! 🎉' }, 400);

  const ids = [...new Set(failed.map((f) => f.activity_id))];
  const { results: acts } = await db.prepare(`SELECT id, title, content_json FROM activities WHERE id IN (${ids.map(() => '?').join(',')})`)
    .bind(...ids).all<{ id: number; title: string; content_json: string }>();
  const byId = new Map(acts.map((a) => [a.id, a]));
  const base: Puzzle[] = failed.map((f) => puzzleAt(byId.get(f.activity_id)?.content_json ?? '', f.item)).filter((p): p is Puzzle => !!p);

  // Similar puzzles from Lichess for the failed ones that came from Lichess.
  let puzzles: Puzzle[] = base;
  let similarCount = 0;
  const lichessIds = base.map((p) => p.lichessId).filter((x): x is string => !!x);
  if (b.similar && lichessIds.length) {
    const { results: meta } = await db.prepare(`SELECT id, themes, rating FROM lichess_puzzles WHERE id IN (${lichessIds.map(() => '?').join(',')})`)
      .bind(...lichessIds).all<{ id: string; themes: string; rating: number }>();
    const metaById = new Map(meta.map((m) => [m.id, m]));
    const used = new Set(lichessIds);
    const picks = base.map((p) => {
      const m = p.lichessId ? metaById.get(p.lichessId) : undefined;
      const theme = m ? themeStats([{ themes: m.themes, ok: false }], 1)[0]?.key : undefined;
      return m && theme ? { theme, rating: m.rating } : null;
    });
    const queries = picks.filter((x): x is { theme: string; rating: number } => !!x).map((x) => db.prepare(
      `SELECT p.id, p.fen, p.moves, p.rating FROM lichess_puzzles p WHERE p.id IN (
         SELECT puzzle_id FROM lichess_puzzle_themes WHERE theme = ? AND rating BETWEEN ? AND ? ORDER BY random() LIMIT 3)`,
    ).bind(x.theme, x.rating - 100, x.rating + 100));
    const res = queries.length ? await db.batch<{ id: string; fen: string; moves: string; rating: number }>(queries) : [];
    let k = 0;
    puzzles = [];
    base.forEach((p, i) => {
      puzzles.push(p);
      if (!picks[i]) return;
      const row = res[k++]?.results.find((r) => !used.has(r.id));
      const extra = row ? fromLichess(row.fen, row.moves.split(' ')) : null;
      if (row && extra) { used.add(row.id); puzzles.push({ ...extra, lichessId: row.id, rating: row.rating }); similarCount++; }
    });
  }

  const one = activityId ? byId.get(activityId)?.title : null;
  const title = (one ? `🔁 Repaso: ${one}` : `🔁 Repaso de ${cls.name} (${shortDate(t)})`).slice(0, 80);
  const body = {
    clubId: cls.club_id, type: mode, title, description: 'Los problemas que más os han costado. ¡A por ellos! 💪',
    content: { puzzles }, visibility: 'private' as const,
  };
  const errors = checkActivity(body);
  if (errors.length) return json({ error: errors.join(' · ') }, 400);

  const row = await db.prepare(
    `INSERT INTO activities (club_id, created_by, type, title, description, content_json, xp_reward, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, 'private') RETURNING id`,
  ).bind(cls.club_id, coach.id, mode, title, body.description, JSON.stringify(body.content), clampXp(undefined, mode)).first<{ id: number }>();
  if (b.assign) {
    await db.prepare('INSERT INTO assignments (class_id, activity_id, assigned_by, starts_on, due_on, note) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(classId, row!.id, coach.id, t, addDays(t, 7), 'Repaso de los problemas que más os han costado 💪').run();
  }
  return json({ id: row!.id, count: puzzles.length, failed: base.length, similar: similarCount, assigned: !!b.assign });
};

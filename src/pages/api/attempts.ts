import type { APIRoute } from 'astro';
import { json, readJson, studentStats, today, xpToday, type ActivityRow } from '../../lib/db';
import { computeXp, earnedStickers, kingdomIndex, levelFromXp, nextStreak } from '../../lib/rewards';

interface Body {
  activityId: number;
  assignmentId?: number | null;
  campaignNodeId?: number | null;
  score: number;
  maxScore: number;
  seconds: number;
  mistakes: number;
  puzzlesSolved: number;
  perfect?: number;
}

export const POST: APIRoute = async ({ locals, request }) => {
  const s = locals.student;
  const db = locals.db;
  if (!s) return json({ error: 'Inicia sesión' }, 401);
  const b = await readJson<Body>(request);

  const activity = await db.prepare(
    `SELECT a.* FROM activities a JOIN classes c ON c.club_id = a.club_id WHERE a.id = ? AND c.id = ?`,
  ).bind(Number(b.activityId), s.class_id).first<ActivityRow>();
  if (!activity) return json({ error: 'Actividad no encontrada' }, 404);

  let assignmentId: number | null = null;
  if (b.assignmentId) {
    const asg = await db.prepare('SELECT id FROM assignments WHERE id = ? AND class_id = ? AND activity_id = ?')
      .bind(Number(b.assignmentId), s.class_id, activity.id).first<{ id: number }>();
    assignmentId = asg?.id ?? null;
  }

  const maxScore = Math.max(0, Number(b.maxScore) || 0);
  const score = Math.max(0, Math.min(maxScore, Number(b.score) || 0));
  const seconds = Math.max(0, Math.min(3600, Math.round(Number(b.seconds) || 0)));
  const puzzles = Math.max(0, Math.min(100, Math.round(Number(b.puzzlesSolved) || 0)));
  const mistakes = Math.max(0, Math.round(Number(b.mistakes) || 0));
  const perfect = b.perfect ? Math.max(0, Math.min(100, Math.round(b.perfect))) : 0;

  const prev = await db.prepare('SELECT COUNT(*) AS n FROM attempts WHERE student_id = ? AND activity_id = ?')
    .bind(s.id, activity.id).first<{ n: number }>();
  const firstTime = (prev?.n ?? 0) === 0;
  const xp = computeXp({ baseXp: activity.xp_reward, score, maxScore, seconds, firstTime, isHomework: !!assignmentId });

  const day = today();
  const streak = nextStreak(s.last_active_day, s.streak, day);
  const statsBefore = await studentStats(db, s);
  const had = new Set(earnedStickers(statsBefore));
  const { results: owned } = await db.prepare('SELECT sticker_id FROM student_stickers WHERE student_id = ?').bind(s.id).all<{ sticker_id: string }>();
  owned.forEach((o) => had.add(o.sticker_id));

  const newXp = s.xp + xp.total;
  
  const queries = [
    db.prepare(`INSERT INTO attempts (student_id, activity_id, assignment_id, score, max_score, stars, xp_earned, seconds, mistakes, puzzles_solved, perfect, day)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(s.id, activity.id, assignmentId, score, maxScore, xp.starCount, xp.total, seconds, mistakes, puzzles, perfect, day),
    db.prepare(`UPDATE students SET xp = ?, streak = ?, best_streak = MAX(best_streak, ?), last_active_day = ?,
      total_seconds = total_seconds + ?, puzzles_solved = puzzles_solved + ?, games_completed = games_completed + 1 WHERE id = ?`)
      .bind(newXp, streak.streak, streak.streak, day, seconds, puzzles, s.id),
  ];

  if (b.campaignNodeId && xp.starCount > 0) {
    queries.push(
      db.prepare('INSERT OR IGNORE INTO campaign_progress (student_id, node_id) VALUES (?, ?)')
        .bind(s.id, Number(b.campaignNodeId))
    );
  }

  await db.batch(queries);

  const updated = {
    ...s, xp: newXp, streak: streak.streak, total_seconds: s.total_seconds + seconds,
    puzzles_solved: s.puzzles_solved + puzzles, games_completed: s.games_completed + 1,
  };
  const statsAfter = await studentStats(db, updated);
  const newStickers = earnedStickers(statsAfter).filter((id) => !had.has(id));
  if (newStickers.length) {
    await db.batch(newStickers.map((id) =>
      db.prepare('INSERT OR IGNORE INTO student_stickers (student_id, sticker_id) VALUES (?, ?)').bind(s.id, id)));
  }

  return json({
    xp,
    firstTime,
    before: { xp: s.xp, level: levelFromXp(s.xp), kingdom: kingdomIndex(s.xp) },
    after: { xp: newXp, level: levelFromXp(newXp), kingdom: kingdomIndex(newXp) },
    streak: { value: streak.streak, extended: streak.extended && s.last_active_day !== day },
    newStickers,
    dailyXp: await xpToday(db, s.id),
  });
};

import type { APIRoute } from 'astro';
import { json, readJson, today, type ActivityRow } from '../../lib/db';
import { checkStudentNode, isCampaignComplete, type CampaignReward } from '../../lib/campaigns';
import { awardStickers, cleanItems, rewardPayload } from '../../lib/progress';
import { computeXp, nextStreak } from '../../lib/rewards';
import { GAME_META } from '../../games/meta';
import { compileLesson } from '../../games/pgn/lesson';

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
  items?: unknown;
  /** Client-generated id: a result queued offline and retried is only saved once. */
  nonce?: string;
}

const NONCE = /^[A-Za-z0-9-]{8,64}$/;

export const POST: APIRoute = async ({ locals, request }) => {
  const s = locals.student;
  const db = locals.db;
  if (!s) return json({ error: 'Inicia sesión' }, 401);
  const b = await readJson<Body>(request);
  const clientNonce = typeof b.nonce === 'string' && NONCE.test(b.nonce) ? b.nonce : null;
  // Always store a nonce: item_results rows find their attempt through it in the same batch.
  const nonce = clientNonce ?? crypto.randomUUID();

  const [activity, dup] = await Promise.all([
    db.prepare(`SELECT a.* FROM activities a JOIN classes c ON c.club_id = a.club_id WHERE a.id = ? AND c.id = ?`)
      .bind(Number(b.activityId), s.class_id).first<ActivityRow>(),
    clientNonce ? db.prepare('SELECT id FROM attempts WHERE student_id = ? AND nonce = ?').bind(s.id, clientNonce).first() : null,
  ]);
  if (!activity) return json({ error: 'Actividad no encontrada' }, 404);
  if (dup) return json({ duplicate: true });

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
  let itemCount = 0;
  try {
    const content = JSON.parse(activity.content_json);
    // Lessons: the player numbers the questions it compiled, which can differ from a raw [%ask] count.
    itemCount = activity.type === 'pgn-lesson'
      ? compileLesson(content.pgn, content.questions).steps.filter((st) => st.kind === 'ask').length
      : GAME_META[activity.type]?.count(content) ?? 0;
  } catch { /* bad content: no items */ }
  const items = cleanItems(b.items, itemCount);

  const prev = await db.prepare('SELECT COUNT(*) AS n FROM attempts WHERE student_id = ? AND activity_id = ?')
    .bind(s.id, activity.id).first<{ n: number }>();
  const firstTime = (prev?.n ?? 0) === 0;
  const xp = computeXp({ baseXp: activity.xp_reward, score, maxScore, seconds, firstTime, isHomework: !!assignmentId });

  const day = today();
  const streak = nextStreak(s.last_active_day, s.streak, day);

  // Campaign level: only counts if the node is in a campaign of the student's class, points at
  // this activity and is unlocked (the client could send any node id).
  const node = b.campaignNodeId
    ? await checkStudentNode(db, s.id, s.class_id, Number(b.campaignNodeId), activity.id)
    : null;

  const newXp = s.xp + xp.total;

  const queries = [
    db.prepare(`INSERT INTO attempts (student_id, activity_id, assignment_id, score, max_score, stars, xp_earned, seconds, mistakes, puzzles_solved, perfect, day, nonce)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(s.id, activity.id, assignmentId, score, maxScore, xp.starCount, xp.total, seconds, mistakes, puzzles, perfect, day, nonce),
    ...items.map((it, i) => db.prepare(
      `INSERT INTO item_results (student_id, activity_id, item, attempt_id, source, ok, mistakes, seconds, day)
       VALUES (?, ?, ?, (SELECT id FROM attempts WHERE student_id = ? AND nonce = ?), 'activity', ?, ?, ?, ?)`,
    ).bind(s.id, activity.id, i, s.id, nonce, it.ok ? 1 : 0, it.mistakes, it.seconds, day)),
    db.prepare(`UPDATE students SET xp = ?, streak = ?, best_streak = MAX(best_streak, ?), last_active_day = ?,
      total_seconds = total_seconds + ?, puzzles_solved = puzzles_solved + ?, games_completed = games_completed + 1 WHERE id = ?`)
      .bind(newXp, streak.streak, streak.streak, day, seconds, puzzles, s.id),
  ];

  let campaign: { id: number; title: string; reward: CampaignReward; levelDone: boolean; finished: boolean } | null = null;
  const rewardStickers: string[] = [];
  if (node?.playable && xp.starCount > 0 && !node.completed.has(node.nodeId)) {
    queries.push(db.prepare('INSERT OR IGNORE INTO campaign_progress (student_id, node_id) VALUES (?, ?)').bind(s.id, node.nodeId));
    const finished = isCampaignComplete(node.ordered, new Set([...node.completed, node.nodeId]));
    campaign = { id: node.campaignId, title: node.title, reward: node.reward, levelDone: true, finished };
    if (finished) {
      queries.push(
        db.prepare('INSERT OR IGNORE INTO campaign_completions (student_id, campaign_id) VALUES (?, ?)').bind(s.id, node.campaignId),
        db.prepare('INSERT OR IGNORE INTO student_unlocks (student_id, unlock_id, campaign_id) VALUES (?, ?, ?)').bind(s.id, node.reward.id, node.campaignId),
      );
      if (node.reward.sticker) rewardStickers.push(node.reward.sticker);
    }
  }

  try {
    await db.batch(queries); // one transaction: attempt, item results, totals, campaign
  } catch (e) {
    // Same nonce saved by a concurrent retry.
    if (clientNonce && String(e).includes('UNIQUE')) return json({ duplicate: true });
    throw e;
  }

  const updated = {
    ...s, xp: newXp, streak: streak.streak, total_seconds: s.total_seconds + seconds,
    puzzles_solved: s.puzzles_solved + puzzles, games_completed: s.games_completed + 1,
  };
  const newStickers = await awardStickers(db, updated, rewardStickers, { puzzlesSolved: puzzles, mistakes });

  return json(await rewardPayload(db, s, updated, xp, {
    firstTime,
    streak: { value: streak.streak, extended: streak.extended && s.last_active_day !== day },
    newStickers,
    extra: { campaign },
  }));
};

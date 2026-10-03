import { dayKey, weekStart, weeklyGoal, type Stats } from './rewards';

export interface CoachRow { id: number; email: string; name: string }

export interface StudentRow {
  id: number; class_id: number; display_name: string; avatar: string; age_group: string;
  username: string; login_token: string; xp: number; streak: number; best_streak: number;
  last_active_day: string | null; total_seconds: number; puzzles_solved: number; games_completed: number;
  voice: string; // Potróculo voice id, 'random' or 'none'
  puzzle_rating: number; // "Entrena" rating, 0 = not placed yet
  puzzle_games: number;
  consent_at: number | null; // parental consent recorded by the coach (unix time)
  family_token: string | null; // read-only family report link
}

export interface ClassRow { id: number; club_id: number; name: string; code: string; emoji: string; color: string; weekly_goal: number }

export interface ActivityRow {
  id: number; club_id: number; type: string; title: string; description: string;
  content_json: string; xp_reward: number; created_by: number | null; updated_at: number;
  visibility: 'public' | 'private'; source_id: number | null;
}

export interface Perm {
  is_owner: number; can_view_progress: number; can_create_content: number; can_manage_students: number;
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

export function today(): string {
  return dayKey(new Date());
}

/**
 * A coach's permissions on a class: their class_permissions row or, failing that, read-only
 * access when they are an admin of the class's club (computed live, so losing the role revokes it).
 */
export async function classPerm(db: D1Database, coachId: number, classId: number): Promise<Perm | null> {
  const row = await db.prepare('SELECT is_owner, can_view_progress, can_create_content, can_manage_students FROM class_permissions WHERE coach_id = ? AND class_id = ?')
    .bind(coachId, classId).first<Perm>();
  if (row) return row;
  const admin = await db.prepare(
    "SELECT 1 FROM classes c JOIN club_coaches cc ON cc.club_id = c.club_id AND cc.coach_id = ? AND cc.role = 'admin' WHERE c.id = ?",
  ).bind(coachId, classId).first();
  return admin ? { is_owner: 0, can_view_progress: 1, can_create_content: 0, can_manage_students: 0 } : null;
}

export async function isClubMember(db: D1Database, coachId: number, clubId: number): Promise<string | null> {
  const r = await db.prepare('SELECT role FROM club_coaches WHERE coach_id = ? AND club_id = ?').bind(coachId, clubId).first<{ role: string }>();
  return r?.role ?? null;
}

export async function coachClubs(db: D1Database, coachId: number) {
  const { results } = await db.prepare(
    `SELECT c.id, c.name, c.slug, cc.role FROM clubs c JOIN club_coaches cc ON cc.club_id = c.id WHERE cc.coach_id = ? ORDER BY c.name`,
  ).bind(coachId).all<{ id: number; name: string; slug: string; role: string }>();
  return results;
}

export async function coachClasses(db: D1Database, coachId: number) {
  const { results } = await db.prepare(
    `SELECT cl.*, cb.name AS club_name, p.is_owner, p.can_view_progress, p.can_create_content, p.can_manage_students,
       (SELECT COUNT(*) FROM students s WHERE s.class_id = cl.id AND s.archived = 0) AS student_count
     FROM classes cl JOIN class_permissions p ON p.class_id = cl.id AND p.coach_id = ?
     JOIN clubs cb ON cb.id = cl.club_id ORDER BY cb.name, cl.name`,
  ).bind(coachId).all<ClassRow & Perm & { club_name: string; student_count: number }>();
  return results;
}

/** SQL fragment (table alias `a`, one `?` = coach id): activities a coach can see in the library. */
export const VISIBLE_ACTIVITY_SQL = "(a.visibility = 'public' OR a.created_by = ?)";

/**
 * What a coach may do with an activity:
 *  - public : any club member can view/use it; only club admins edit it directly (others fork it).
 *  - private: only its creator can view, use and edit it.
 */
export async function activityAccess(db: D1Database, coachId: number, activityId: number) {
  const a = await db.prepare('SELECT * FROM activities WHERE id = ?').bind(activityId).first<ActivityRow>();
  if (!a) return null;
  const role = await isClubMember(db, coachId, a.club_id);
  if (!role) return null;
  if (a.visibility === 'private') {
    return a.created_by === coachId ? { activity: a, canEdit: true, needsFork: false } : null;
  }
  const admin = role === 'admin';
  return { activity: a, canEdit: true, needsFork: !admin };
}

/** Coach can open (view / try / edit-or-fork) an activity. */
export async function canEditActivity(db: D1Database, coachId: number, activityId: number) {
  return (await activityAccess(db, coachId, activityId))?.activity ?? null;
}

/** Copies an activity as a PRIVATE activity of `coachId`. */
export async function forkActivity(
  db: D1Database, coachId: number, src: ActivityRow,
  over: { title: string; description: string; content: unknown; xpReward: number },
): Promise<number> {
  const row = await db.prepare(
    `INSERT INTO activities (club_id, created_by, type, title, description, content_json, xp_reward, visibility, source_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'private', ?) RETURNING id`,
  ).bind(src.club_id, coachId, src.type, over.title, over.description, JSON.stringify(over.content), over.xpReward, src.source_id ?? src.id)
    .first<{ id: number }>();
  return row!.id;
}

function statsQuery(db: D1Database, studentId: number) {
  return db.prepare(
    `SELECT
       SUM(CASE WHEN at.stars = 3 THEN 1 ELSE 0 END) AS three,
       SUM(CASE WHEN a.type = 'pgn-lesson' THEN 1 ELSE 0 END) AS lessons,
       SUM(CASE WHEN a.type = 'fruit-collector' THEN at.perfect ELSE 0 END) AS fruit,
       SUM(CASE WHEN a.type = 'puzzle-blitz' THEN 1 ELSE 0 END) AS blitz,
       COUNT(DISTINCT at.assignment_id) AS homework,
       (SELECT COUNT(*) FROM practice_sessions ps WHERE ps.student_id = ? AND ps.kind = 'diario' AND ps.solved > 0) AS daily,
       (SELECT COUNT(*) FROM item_results ir WHERE ir.student_id = ? AND ir.source = 'repaso' AND ir.ok = 1) AS fixed,
       (SELECT COUNT(*) FROM campaign_completions cc WHERE cc.student_id = ?) AS campaigns
     FROM attempts at JOIN activities a ON a.id = at.activity_id WHERE at.student_id = ?`,
  ).bind(studentId, studentId, studentId, studentId);
}

export type StatsAgg = {
  three: number; lessons: number; fruit: number; blitz: number; homework: number; daily: number; fixed: number; campaigns: number;
} | null | undefined;

export function toStats(s: StudentRow, r: StatsAgg): Stats {
  return {
    xp: s.xp, streak: s.streak, puzzlesSolved: s.puzzles_solved, gamesCompleted: s.games_completed,
    totalSeconds: s.total_seconds, threeStars: r?.three ?? 0, lessonsDone: r?.lessons ?? 0,
    fruitPerfect: r?.fruit ?? 0, blitzDone: r?.blitz ?? 0, homeworkDone: r?.homework ?? 0,
    dailyDone: r?.daily ?? 0, reviewFixed: r?.fixed ?? 0, campaignsDone: r?.campaigns ?? 0, rating: s.puzzle_rating ?? 0,
  };
}

export async function studentStats(db: D1Database, s: StudentRow): Promise<Stats> {
  return toStats(s, await statsQuery(db, s.id).first<NonNullable<StatsAgg>>());
}

/** Attempt aggregates for several students in one round trip (combine with `toStats`). */
export async function attemptAggregates(db: D1Database, ids: number[]): Promise<Map<number, StatsAgg>> {
  if (!ids.length) return new Map();
  const res = await db.batch<NonNullable<StatsAgg>>(ids.map((id) => statsQuery(db, id)));
  return new Map(ids.map((id, i) => [id, res[i].results[0]]));
}

export interface Mission {
  assignment_id: number; activity_id: number; type: string; title: string; description: string;
  xp_reward: number; due_on: string | null; starts_on: string; note: string; best_stars: number | null; plays: number;
  content_json: string;
}

/** Current missions for a class: started, and not overdue by more than 7 days. */
export async function studentMissions(db: D1Database, studentId: number, classId: number): Promise<Mission[]> {
  const t = today();
  const { results } = await db.prepare(
    `SELECT asg.id AS assignment_id, a.id AS activity_id, a.type, a.title, a.description, a.xp_reward, a.content_json,
       asg.due_on, asg.starts_on, asg.note,
       (SELECT MAX(stars) FROM attempts at WHERE at.student_id = ? AND at.activity_id = a.id) AS best_stars,
       (SELECT COUNT(*) FROM attempts at WHERE at.student_id = ? AND at.activity_id = a.id) AS plays
     FROM assignments asg JOIN activities a ON a.id = asg.activity_id
     WHERE asg.class_id = ? AND asg.starts_on <= ? AND (asg.due_on IS NULL OR asg.due_on >= date(?, '-7 day'))
     ORDER BY (asg.due_on IS NULL), asg.due_on, asg.id`,
  ).bind(studentId, studentId, classId, t, t).all<Mission>();
  return results;
}

/** This week's XP and puzzles solved per student of a class (league + cooperative challenge). */
export async function weeklyLeaderboard(db: D1Database, classId: number) {
  const ws = weekStart(new Date());
  const { results } = await db.prepare(
    `SELECT s.id, s.display_name, s.avatar,
       COALESCE((SELECT SUM(at.xp_earned) FROM attempts at WHERE at.student_id = s.id AND at.day >= ?), 0)
       + COALESCE((SELECT SUM(pr.xp_earned) FROM projector_results pr WHERE pr.student_id = s.id AND pr.day >= ?), 0)
       + COALESCE((SELECT SUM(ps.xp_earned) FROM practice_sessions ps WHERE ps.student_id = s.id AND ps.day >= ?), 0) AS week_xp,
       COALESCE((SELECT SUM(at.puzzles_solved) FROM attempts at WHERE at.student_id = s.id AND at.day >= ?), 0)
       + COALESCE((SELECT SUM(pr.solved) FROM projector_results pr WHERE pr.student_id = s.id AND pr.day >= ?), 0)
       + COALESCE((SELECT SUM(ps.solved) FROM practice_sessions ps WHERE ps.student_id = s.id AND ps.day >= ?), 0) AS week_solved
     FROM students s WHERE s.class_id = ? AND s.archived = 0 ORDER BY week_xp DESC, s.display_name`,
  ).bind(ws, ws, ws, ws, ws, ws, classId).all<{ id: number; display_name: string; avatar: string; week_xp: number; week_solved: number }>();
  return results;
}

/** XP, seconds and puzzles solved per day for one student since `since` (homework, practice and projector). */
export function dailyActivityQuery(db: D1Database, studentId: number, since: string) {
  return db.prepare(
    `SELECT day, SUM(xp) AS xp, SUM(secs) AS secs, SUM(solved) AS solved FROM (
       SELECT day, xp_earned AS xp, seconds AS secs, puzzles_solved AS solved FROM attempts WHERE student_id = ? AND day >= ?
       UNION ALL SELECT day, xp_earned, seconds, solved FROM practice_sessions WHERE student_id = ? AND day >= ? AND finished_at IS NOT NULL
       UNION ALL SELECT day, xp_earned, 0, solved FROM projector_results WHERE student_id = ? AND day >= ?
     ) GROUP BY day`,
  ).bind(studentId, since, studentId, since, studentId, since);
}

export async function xpToday(db: D1Database, studentId: number): Promise<number> {
  const d = today();
  const r = await db.prepare(
    `SELECT COALESCE((SELECT SUM(xp_earned) FROM attempts WHERE student_id = ? AND day = ?), 0)
       + COALESCE((SELECT SUM(xp_earned) FROM projector_results WHERE student_id = ? AND day = ?), 0)
       + COALESCE((SELECT SUM(xp_earned) FROM practice_sessions WHERE student_id = ? AND day = ?), 0) AS x`,
  ).bind(studentId, d, studentId, d, studentId, d).first<{ x: number }>();
  return r?.x ?? 0;
}

/**
 * Grants the "reto-clase" sticker to everyone in the class who solved something this week, once
 * the class reaches its weekly goal. Returns true if `studentId` just got it.
 */
export async function checkWeeklyGoal(db: D1Database, classId: number, studentId: number): Promise<boolean> {
  // Cheap exit: once a student has the sticker there is nothing new to tell them.
  if (await db.prepare("SELECT 1 FROM student_stickers WHERE student_id = ? AND sticker_id = 'reto-clase'").bind(studentId).first()) return false;
  const [cls, board] = await Promise.all([
    db.prepare('SELECT weekly_goal FROM classes WHERE id = ?').bind(classId).first<{ weekly_goal: number }>(),
    weeklyLeaderboard(db, classId),
  ]);
  const solved = board.reduce((t, r) => t + r.week_solved, 0);
  if (solved < weeklyGoal(cls?.weekly_goal ?? 0, board.length)) return false;
  const helpers = board.filter((r) => r.week_solved > 0).map((r) => r.id);
  if (!helpers.includes(studentId)) return false;
  await db.batch(helpers.map((id) => db.prepare("INSERT OR IGNORE INTO student_stickers (student_id, sticker_id) VALUES (?, 'reto-clase')").bind(id)));
  return true;
}

export async function readJson<T = any>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

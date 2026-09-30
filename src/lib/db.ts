import { dayKey, weekStart, type Stats } from './rewards';

export interface CoachRow { id: number; email: string; name: string }

export interface StudentRow {
  id: number; class_id: number; display_name: string; avatar: string; age_group: string;
  username: string; login_token: string; xp: number; streak: number; best_streak: number;
  last_active_day: string | null; total_seconds: number; puzzles_solved: number; games_completed: number;
}

export interface ClassRow { id: number; club_id: number; name: string; code: string; emoji: string; color: string }

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

export async function classPerm(db: D1Database, coachId: number, classId: number): Promise<Perm | null> {
  return db.prepare('SELECT is_owner, can_view_progress, can_create_content, can_manage_students FROM class_permissions WHERE coach_id = ? AND class_id = ?')
    .bind(coachId, classId).first<Perm>();
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

export async function studentStats(db: D1Database, s: StudentRow): Promise<Stats> {
  const r = await db.prepare(
    `SELECT
       SUM(CASE WHEN at.stars = 3 THEN 1 ELSE 0 END) AS three,
       SUM(CASE WHEN a.type = 'pgn-lesson' THEN 1 ELSE 0 END) AS lessons,
       SUM(CASE WHEN a.type = 'fruit-collector' THEN at.perfect ELSE 0 END) AS fruit,
       SUM(CASE WHEN a.type = 'puzzle-blitz' THEN 1 ELSE 0 END) AS blitz,
       COUNT(DISTINCT at.assignment_id) AS homework
     FROM attempts at JOIN activities a ON a.id = at.activity_id WHERE at.student_id = ?`,
  ).bind(s.id).first<{ three: number; lessons: number; fruit: number; blitz: number; homework: number }>();
  return {
    xp: s.xp, streak: s.streak, puzzlesSolved: s.puzzles_solved, gamesCompleted: s.games_completed,
    totalSeconds: s.total_seconds, threeStars: r?.three ?? 0, lessonsDone: r?.lessons ?? 0,
    fruitPerfect: r?.fruit ?? 0, blitzDone: r?.blitz ?? 0, homeworkDone: r?.homework ?? 0,
  };
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

export async function weeklyLeaderboard(db: D1Database, classId: number) {
  const ws = weekStart(new Date());
  const { results } = await db.prepare(
    `SELECT s.id, s.display_name, s.avatar, COALESCE(SUM(at.xp_earned), 0) AS week_xp
     FROM students s LEFT JOIN attempts at ON at.student_id = s.id AND at.day >= ?
     WHERE s.class_id = ? AND s.archived = 0 GROUP BY s.id ORDER BY week_xp DESC, s.display_name`,
  ).bind(ws, classId).all<{ id: number; display_name: string; avatar: string; week_xp: number }>();
  return results;
}

export async function xpToday(db: D1Database, studentId: number): Promise<number> {
  const r = await db.prepare('SELECT COALESCE(SUM(xp_earned), 0) AS x FROM attempts WHERE student_id = ? AND day = ?')
    .bind(studentId, today()).first<{ x: number }>();
  return r?.x ?? 0;
}

export async function readJson<T = any>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

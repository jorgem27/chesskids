// GDPR helpers: export everything stored about a student (right of access / portability) and
// erase it (right to erasure). Callers check the coach's permission on the student's class first.

/** Tables keyed by student_id. Foreign keys cascade too, but erasure is explicit so nothing is missed. */
const STUDENT_TABLES = [
  'attempts', 'item_results', 'practice_sessions', 'student_stickers', 'student_unlocks', 'student_pets',
  'campaign_progress', 'campaign_completions', 'projector_results', 'push_subscriptions', 'message_reads',
] as const;

/**
 * Statements that erase students matching `where` (an SQL condition on `students`, e.g. 'id = ?')
 * with all their data and sessions. Run them in one `db.batch`, before deleting parents.
 */
export function eraseStudentsStatements(db: D1Database, where: string, ...binds: unknown[]): D1PreparedStatement[] {
  const ids = `(SELECT id FROM students WHERE ${where})`;
  return [
    db.prepare(`DELETE FROM sessions WHERE user_type = 'student' AND user_id IN ${ids}`).bind(...binds),
    db.prepare(`DELETE FROM login_failures WHERE key IN (SELECT 'user:' || username FROM students WHERE ${where} UNION ALL SELECT 'pin:' || id FROM students WHERE ${where})`).bind(...binds, ...binds),
    ...STUDENT_TABLES.map((t) => db.prepare(`DELETE FROM ${t} WHERE student_id IN ${ids}`).bind(...binds)),
    // Chat: what they wrote, and their private chats (both directions).
    db.prepare(`DELETE FROM messages WHERE (sender_type = 'student' AND sender_id IN ${ids}) OR recipient_id IN ${ids}`).bind(...binds, ...binds),
    db.prepare(`DELETE FROM students WHERE ${where}`).bind(...binds),
  ];
}

/** Every piece of personal data about one student, without secrets (hashes, tokens). */
export async function exportStudent(db: D1Database, studentId: number) {
  const q = (sql: string) => db.prepare(sql).bind(studentId);
  const [student, attempts, items, practice, stickers, unlocks, pet, campaigns, projector, messages] = await db.batch<any>([
    db.prepare(
      `SELECT s.id, s.display_name, s.avatar, s.age_group, s.username, s.xp, s.streak, s.best_streak, s.last_active_day,
         s.total_seconds, s.puzzles_solved, s.games_completed, s.voice, s.puzzle_rating, s.puzzle_games, s.consent_at,
         s.created_at, c.name AS class_name, cb.name AS club_name, (s.family_token IS NOT NULL) AS family_link_active
       FROM students s JOIN classes c ON c.id = s.class_id JOIN clubs cb ON cb.id = c.club_id WHERE s.id = ?`,
    ).bind(studentId),
    q(`SELECT at.day, a.title AS activity, a.type, at.score, at.max_score, at.stars, at.xp_earned, at.seconds, at.mistakes,
         at.puzzles_solved, at.completed_at FROM attempts at JOIN activities a ON a.id = at.activity_id WHERE at.student_id = ? ORDER BY at.id`),
    q('SELECT day, activity_id, item, lichess_id, source, ok, mistakes, seconds FROM item_results WHERE student_id = ? ORDER BY id'),
    q('SELECT day, kind, solved, xp_earned, seconds, finished_at FROM practice_sessions WHERE student_id = ? ORDER BY id'),
    q('SELECT sticker_id, earned_at FROM student_stickers WHERE student_id = ?'),
    q('SELECT unlock_id, earned_at FROM student_unlocks WHERE student_id = ?'),
    q('SELECT base_pet, equipped_json FROM student_pets WHERE student_id = ?'),
    q(`SELECT c.title AS campaign, n.position, p.completed_at FROM campaign_progress p JOIN campaign_nodes n ON n.id = p.node_id
         JOIN campaigns c ON c.id = n.campaign_id WHERE p.student_id = ? ORDER BY p.completed_at`),
    q('SELECT day, team, picks, solved, points, xp_earned FROM projector_results WHERE student_id = ? ORDER BY day'),
    q(`SELECT CASE WHEN thread = 'clase' THEN 'clase' ELSE 'privado' END AS chat, kind, body, chess_json, hidden, created_at
         FROM messages WHERE sender_type = 'student' AND sender_id = ? ORDER BY id`),
  ]);
  return {
    exported_at: new Date().toISOString(),
    note: 'Datos guardados en Odisea Miranda sobre este alumno. Las contraseñas y los dibujos secretos se guardan cifrados y no se incluyen.',
    student: student.results[0] ?? null,
    attempts: attempts.results,
    item_results: items.results,
    practice_sessions: practice.results,
    stickers: stickers.results,
    unlocks: unlocks.results,
    pet: pet.results[0] ?? null,
    campaign_progress: campaigns.results,
    projector_results: projector.results,
    chat_messages_sent: messages.results,
  };
}

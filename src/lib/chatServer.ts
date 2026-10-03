// Class chat: D1 queries shared by /api/chat (students) and /api/coach/chat (coaches).
// Every query is scoped by class_id (classes carry club_id); callers check access first.
import { today } from './db';
import {
  asChatMode, cleanText, puzzleFromContent, RATE_LIMIT, RETENTION_DAYS, validateGame,
  type ChatGame, type ChatKind, type ChatMessage, type ChatPuzzle, type ShareInput,
} from './chat';

const PAGE = 60;

interface MessageRow {
  id: number; thread: string; sender_type: 'student' | 'coach'; sender_id: number; kind: ChatKind; body: string;
  chess_json: string | null; hidden: number; flagged: number; created_at: number; name: string | null; avatar: string | null;
}

const SELECT_MESSAGES = `SELECT m.id, m.thread, m.sender_type, m.sender_id, m.kind, m.body, m.chess_json, m.hidden, m.flagged, m.created_at,
    CASE WHEN m.sender_type = 'coach' THEN co.name ELSE s.display_name END AS name, s.avatar
  FROM messages m
  LEFT JOIN students s ON m.sender_type = 'student' AND s.id = m.sender_id
  LEFT JOIN coaches co ON m.sender_type = 'coach' AND co.id = m.sender_id`;

function toMessage(r: MessageRow, viewer: { type: 'student' | 'coach'; id: number }, moderator: boolean): ChatMessage {
  let puzzle: ChatPuzzle | undefined, game: ChatGame | undefined;
  try {
    if (r.kind === 'puzzle' && r.chess_json) puzzle = JSON.parse(r.chess_json);
    if (r.kind === 'game' && r.chess_json) game = JSON.parse(r.chess_json);
  } catch { /* shown as text */ }
  const m: ChatMessage = {
    id: r.id, thread: r.thread, mine: r.sender_type === viewer.type && r.sender_id === viewer.id,
    who: { type: r.sender_type, id: r.sender_id, name: r.name ?? (r.sender_type === 'coach' ? 'Profe' : 'Alumno'), avatar: r.sender_type === 'coach' ? '🧑‍🏫' : r.avatar ?? '🙂' },
    kind: r.kind, body: r.body, puzzle, game, at: r.created_at,
  };
  if (moderator) { m.hidden = !!r.hidden; m.flagged = r.flagged; }
  return m;
}

/** Messages of one thread: the latest page, or only those after `after` (polling). */
export async function listMessages(
  db: D1Database, classId: number, thread: string, after: number,
  viewer: { type: 'student' | 'coach'; id: number }, moderator = false,
): Promise<ChatMessage[]> {
  const vis = moderator ? '' : ' AND m.hidden = 0';
  const rows = after > 0
    ? (await db.prepare(`${SELECT_MESSAGES} WHERE m.class_id = ? AND m.thread = ? AND m.id > ?${vis} ORDER BY m.id LIMIT ${PAGE}`)
      .bind(classId, thread, after).all<MessageRow>()).results
    : (await db.prepare(`${SELECT_MESSAGES} WHERE m.class_id = ? AND m.thread = ?${vis} ORDER BY m.id DESC LIMIT ${PAGE}`)
      .bind(classId, thread).all<MessageRow>()).results.reverse();
  return rows.map((r) => toMessage(r, viewer, moderator));
}

/** Messages flagged for the coach (reported or caught by the filter), newest first. */
export async function flaggedMessages(db: D1Database, classId: number, viewerId: number): Promise<ChatMessage[]> {
  const { results } = await db.prepare(`${SELECT_MESSAGES} WHERE m.class_id = ? AND m.flagged > 0 ORDER BY m.id DESC LIMIT 30`)
    .bind(classId).all<MessageRow>();
  return results.map((r) => toMessage(r, { type: 'coach', id: viewerId }, true));
}

export function markReadStatement(db: D1Database, studentId: number, thread: string, lastId: number) {
  return db.prepare(`INSERT INTO message_reads (student_id, thread, last_read_id) VALUES (?, ?, ?)
    ON CONFLICT(student_id, thread) DO UPDATE SET last_read_id = MAX(last_read_id, excluded.last_read_id)`)
    .bind(studentId, thread, lastId);
}

/** Unread messages for a student: class chat + private chats (capped at 99 for the badge). */
export function unreadTotalQuery(db: D1Database, studentId: number, classId: number) {
  return db.prepare(
    `SELECT c.chat_mode,
       (SELECT COUNT(*) FROM (SELECT 1 FROM messages m WHERE m.class_id = c.id AND m.thread = 'clase' AND m.hidden = 0
          AND m.id > COALESCE((SELECT last_read_id FROM message_reads WHERE student_id = ?1 AND thread = 'clase'), 0)
          AND NOT (m.sender_type = 'student' AND m.sender_id = ?1) LIMIT 99))
       + CASE WHEN c.chat_mode = 'on' THEN (SELECT COUNT(*) FROM (SELECT 1 FROM messages m WHERE m.recipient_id = ?1 AND m.class_id = c.id AND m.hidden = 0
          AND m.id > COALESCE((SELECT last_read_id FROM message_reads r WHERE r.student_id = ?1 AND r.thread = m.thread), 0) LIMIT 99)) ELSE 0 END AS unread
     FROM classes c WHERE c.id = ?2`,
  ).bind(studentId, classId);
}

/** Chat home for a student: class mode, classmates and unread counts, in one round trip. */
export async function studentOverview(db: D1Database, studentId: number, classId: number) {
  const [cls, mates, group, dms] = await db.batch<any>([
    db.prepare('SELECT chat_mode, name, emoji FROM classes WHERE id = ?').bind(classId),
    db.prepare('SELECT id, display_name AS name, avatar FROM students WHERE class_id = ? AND archived = 0 AND id != ? ORDER BY display_name LIMIT 60').bind(classId, studentId),
    db.prepare(`SELECT COUNT(*) AS n, MAX(id) AS last FROM messages m WHERE m.class_id = ? AND m.thread = 'clase' AND m.hidden = 0
      AND m.id > COALESCE((SELECT last_read_id FROM message_reads WHERE student_id = ? AND thread = 'clase'), 0)
      AND NOT (m.sender_type = 'student' AND m.sender_id = ?)`).bind(classId, studentId, studentId),
    db.prepare(`SELECT m.sender_id, COUNT(*) AS n FROM messages m WHERE m.recipient_id = ? AND m.class_id = ? AND m.hidden = 0
      AND m.id > COALESCE((SELECT last_read_id FROM message_reads r WHERE r.student_id = ? AND r.thread = m.thread), 0)
      GROUP BY m.sender_id`).bind(studentId, classId, studentId),
  ]);
  const c = cls.results[0] as { chat_mode: string; name: string; emoji: string } | undefined;
  return {
    mode: asChatMode(c?.chat_mode),
    className: c?.name ?? '', classEmoji: c?.emoji ?? '♞',
    classmates: mates.results as { id: number; name: string; avatar: string }[],
    unread: {
      group: (group.results[0]?.n as number) ?? 0,
      dm: Object.fromEntries((dms.results as { sender_id: number; n: number }[]).map((r) => [r.sender_id, r.n])),
    },
  };
}

/** Puzzle activities assigned to the class (already started), with their positions, to share in the chat. */
export async function shareablePuzzles(db: D1Database, classId: number) {
  const { results } = await db.prepare(
    `SELECT a.id, a.title, a.type, a.content_json FROM activities a
     WHERE a.id IN (SELECT activity_id FROM assignments WHERE class_id = ? AND starts_on <= ?)
       AND a.type IN ('puzzle-hint', 'puzzle-blitz')
     ORDER BY a.id DESC LIMIT 12`,
  ).bind(classId, today()).all<{ id: number; title: string; type: string; content_json: string }>();
  return results.map((r) => {
    let puzzles: { fen: string; prompt: string }[] = [];
    try {
      const c = JSON.parse(r.content_json);
      puzzles = (c?.puzzles ?? []).slice(0, 30).map((p: any) => ({ fen: String(p?.fen ?? ''), prompt: typeof p?.prompt === 'string' ? p.prompt.slice(0, 80) : '' }));
    } catch { /* skip broken content */ }
    return { id: r.id, title: r.title, type: r.type, puzzles };
  }).filter((a) => a.puzzles.length);
}

/**
 * Builds a message from the request body: cleaned text plus an optional chess share. Puzzles are
 * copied from an activity assigned to the class (never trusted from the client); games are replayed.
 */
export async function buildMessage(db: D1Database, classId: number, text: unknown, share: unknown):
  Promise<{ error: string } | { kind: ChatKind; body: string; chessJson: string | null; flagged: boolean }> {
  const { text: body, flagged } = cleanText(text);
  const sh = share as ShareInput | null | undefined;
  if (sh && typeof sh === 'object' && sh.type === 'puzzle') {
    const a = await db.prepare(
      `SELECT a.content_json FROM activities a WHERE a.id = ? AND a.type IN ('puzzle-hint', 'puzzle-blitz')
         AND EXISTS (SELECT 1 FROM assignments WHERE class_id = ? AND activity_id = a.id AND starts_on <= ?)`,
    ).bind(Number(sh.activityId), classId, today()).first<{ content_json: string }>();
    let puzzle: ChatPuzzle | null = null;
    try { puzzle = a ? puzzleFromContent(JSON.parse(a.content_json), sh.index) : null; } catch { /* invalid */ }
    if (!puzzle) return { error: 'No encuentro ese problema' };
    return { kind: 'puzzle', body, chessJson: JSON.stringify(puzzle), flagged };
  }
  if (sh && typeof sh === 'object' && sh.type === 'game') {
    const game = validateGame(sh.start, sh.moves);
    if (!game) return { error: 'Esa partida tiene alguna jugada que no vale' };
    return { kind: 'game', body, chessJson: JSON.stringify(game), flagged };
  }
  if (!body) return { error: 'Escribe algo antes de enviar' };
  return { kind: 'text', body, chessJson: null, flagged };
}

/** Saves a message (with a per-sender rate limit). Returns its id or a Spanish error. */
export async function insertMessage(db: D1Database, m: {
  classId: number; thread: string; senderType: 'student' | 'coach'; senderId: number; recipientId: number | null;
  kind: ChatKind; body: string; chessJson: string | null; flagged: boolean;
}): Promise<{ id: number } | { error: string }> {
  const recent = await db.prepare('SELECT COUNT(*) AS n FROM messages WHERE sender_type = ? AND sender_id = ? AND created_at > unixepoch() - 60')
    .bind(m.senderType, m.senderId).first<{ n: number }>();
  if ((recent?.n ?? 0) >= RATE_LIMIT) return { error: '¡Vas muy rápido! Espera un minuto 🐢' };
  const row = await db.prepare(
    `INSERT INTO messages (class_id, thread, sender_type, sender_id, recipient_id, kind, body, chess_json, flagged)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  ).bind(m.classId, m.thread, m.senderType, m.senderId, m.recipientId, m.kind, m.body, m.chessJson, m.flagged ? 2 : 0).first<{ id: number }>();
  return { id: row!.id };
}

/** Daily cron: chats are not kept forever (data minimisation). */
export async function purgeOldMessages(db: D1Database) {
  await db.prepare('DELETE FROM messages WHERE created_at < unixepoch() - ?').bind(RETENTION_DAYS * 86400).run();
}

import type { APIRoute } from 'astro';
import { json, readJson, type StudentRow } from '../../lib/db';
import { asChatMode, dmThread, GROUP_THREAD, parseThread } from '../../lib/chat';
import {
  buildMessage, insertMessage, listMessages, markReadStatement, shareablePuzzles, studentOverview,
} from '../../lib/chatServer';

/**
 * Resolves who the student wants to talk to: `clase` (class chat) or a classmate's id (private chat).
 * Private chats need chat mode 'on' and an active classmate of the same class.
 */
async function resolveTarget(db: D1Database, s: StudentRow, to: unknown):
  Promise<{ thread: string; recipientId: number | null } | { error: string; status: number }> {
  const other = to === GROUP_THREAD ? 0 : Number(to);
  if (to !== GROUP_THREAD && (!Number.isInteger(other) || other <= 0 || other === s.id)) return { error: 'No encuentro a ese compañero', status: 404 };
  // Class chat mode and (for private chats) the classmate check in one query.
  const r = await db.prepare(
    'SELECT c.chat_mode, (SELECT 1 FROM students WHERE id = ? AND class_id = c.id AND archived = 0) AS mate FROM classes c WHERE c.id = ?',
  ).bind(other, s.class_id).first<{ chat_mode: string; mate: number | null }>();
  const mode = asChatMode(r?.chat_mode);
  if (mode === 'off') return { error: 'El chat de tu clase está apagado', status: 403 };
  if (to === GROUP_THREAD) return { thread: GROUP_THREAD, recipientId: null };
  if (mode !== 'on') return { error: 'Tu profe solo ha activado el chat de la clase', status: 403 };
  if (!r?.mate) return { error: 'No encuentro a ese compañero', status: 404 };
  return { thread: dmThread(s.id, other), recipientId: other };
}

// GET /api/chat                 → chat home (mode, classmates, unread counts)
// GET /api/chat?to=clase|<id>   → messages of that chat (only newer than `after` when polling); marks them read
// GET /api/chat?view=puzzles    → puzzles from the class missions, to share
export const GET: APIRoute = async ({ locals, url }) => {
  const s = locals.student;
  const db = locals.db;
  if (!s) return json({ error: 'Inicia sesión' }, 401);

  if (url.searchParams.get('view') === 'puzzles') {
    return json({ activities: await shareablePuzzles(db, s.class_id) });
  }
  const to = url.searchParams.get('to');
  if (!to) return json(await studentOverview(db, s.id, s.class_id));

  const target = await resolveTarget(db, s, to);
  if ('error' in target) return json({ error: target.error }, target.status);
  const after = Math.max(0, Number(url.searchParams.get('after')) || 0);
  const messages = await listMessages(db, s.class_id, target.thread, after, { type: 'student', id: s.id });
  const last = messages.at(-1)?.id;
  if (last) await markReadStatement(db, s.id, target.thread, last).run();
  return json({ messages });
};

// POST /api/chat { to, text?, share? } → sends a message (text and/or a puzzle / game)
export const POST: APIRoute = async ({ locals, request }) => {
  const s = locals.student;
  const db = locals.db;
  if (!s) return json({ error: 'Inicia sesión' }, 401);
  const b = await readJson<{ to: unknown; text?: unknown; share?: unknown }>(request);
  const target = await resolveTarget(db, s, b.to);
  if ('error' in target) return json({ error: target.error }, target.status);
  const msg = await buildMessage(db, s.class_id, b.text, b.share);
  if ('error' in msg) return json({ error: msg.error }, 400);
  const saved = await insertMessage(db, {
    classId: s.class_id, thread: target.thread, senderType: 'student', senderId: s.id, recipientId: target.recipientId, ...msg,
  });
  if ('error' in saved) return json({ error: saved.error }, 429);
  await markReadStatement(db, s.id, target.thread, saved.id).run();
  return json({ ok: true, id: saved.id, filtered: msg.flagged });
};

// PATCH /api/chat { id, action: 'report' } → asks the coach to look at a message
export const PATCH: APIRoute = async ({ locals, request }) => {
  const s = locals.student;
  const db = locals.db;
  if (!s) return json({ error: 'Inicia sesión' }, 401);
  const b = await readJson<{ id: unknown; action: unknown }>(request);
  if (b.action !== 'report') return json({ error: 'Acción no válida' }, 400);
  const m = await db.prepare('SELECT thread FROM messages WHERE id = ? AND class_id = ?').bind(Number(b.id), s.class_id).first<{ thread: string }>();
  const t = m && parseThread(m.thread);
  // Only messages the student can see: the class chat, or a private chat they are part of.
  if (!t || (!t.group && t.a !== s.id && t.b !== s.id)) return json({ error: 'No encuentro ese mensaje' }, 404);
  await db.prepare('UPDATE messages SET flagged = 1 WHERE id = ? AND flagged = 0 AND hidden = 0').bind(Number(b.id)).run();
  return json({ ok: true });
};

import type { APIRoute } from 'astro';
import { classPerm, json, readJson, type Perm } from '../../../lib/db';
import { asChatMode, CHAT_MODES, GROUP_THREAD, parseThread } from '../../../lib/chat';
import { buildMessage, flaggedMessages, insertMessage, listMessages, shareablePuzzles } from '../../../lib/chatServer';

// Reading the chat = seeing the students' progress; moderating and changing the mode = managing students.
const canRead = (p: Perm | null) => !!p && !!(p.is_owner || p.can_view_progress || p.can_manage_students);
const canModerate = (p: Perm | null) => !!p && !!(p.is_owner || p.can_manage_students);
// Writing to the kids' class chat: not for view-only coaches (club admins get view-only access to every class).
const canWrite = (p: Perm | null) => !!p && !!(p.is_owner || p.can_manage_students || p.can_create_content);

// GET ?classId                      → overview: mode, students, threads, messages to review
// GET ?classId&t=clase|dm:a-b&after → messages of a thread (hidden ones included)
// GET ?classId&view=puzzles         → mission puzzles to share
export const GET: APIRoute = async ({ locals, url }) => {
  const db = locals.db;
  const coach = locals.coach!;
  const classId = Number(url.searchParams.get('classId'));
  const perm = await classPerm(db, coach.id, classId);
  if (!canRead(perm)) return json({ error: 'No tienes permiso para ver el chat de esta clase' }, 403);

  if (url.searchParams.get('view') === 'puzzles') return json({ activities: await shareablePuzzles(db, classId) });

  const t = url.searchParams.get('t');
  if (t) {
    if (!parseThread(t)) return json({ error: 'Conversación no válida' }, 400);
    const after = Math.max(0, Number(url.searchParams.get('after')) || 0);
    return json({ messages: await listMessages(db, classId, t, after, { type: 'coach', id: coach.id }, true) });
  }

  const [cls, students, threads] = await db.batch<any>([
    db.prepare('SELECT chat_mode FROM classes WHERE id = ?').bind(classId),
    db.prepare('SELECT id, display_name AS name, avatar, archived FROM students WHERE class_id = ? ORDER BY display_name LIMIT 100').bind(classId),
    // Index-only scan of idx_messages_thread (flags come from the partial flagged index below).
    db.prepare('SELECT thread, COUNT(*) AS n, MAX(id) AS last_id FROM messages WHERE class_id = ? GROUP BY thread ORDER BY last_id DESC LIMIT 100').bind(classId),
  ]);
  return json({
    mode: asChatMode(cls.results[0]?.chat_mode),
    canModerate: canModerate(perm),
    canWrite: canWrite(perm),
    students: students.results,
    threads: threads.results,
    flagged: await flaggedMessages(db, classId, coach.id),
  });
};

// POST { classId, text?, share? } → the coach writes in the class chat (coaches never chat privately with a student)
export const POST: APIRoute = async ({ locals, request }) => {
  const db = locals.db;
  const coach = locals.coach!;
  const b = await readJson<{ classId: unknown; text?: unknown; share?: unknown }>(request);
  const classId = Number(b.classId);
  const perm = await classPerm(db, coach.id, classId);
  if (!canWrite(perm)) return json({ error: 'Para escribir en el chat necesitas permiso de gestionar alumnos o crear contenido' }, 403);
  const msg = await buildMessage(db, classId, b.text, b.share);
  if ('error' in msg) return json({ error: msg.error }, 400);
  const saved = await insertMessage(db, {
    classId, thread: GROUP_THREAD, senderType: 'coach', senderId: coach.id, recipientId: null, ...msg, flagged: false,
  });
  if ('error' in saved) return json({ error: saved.error }, 429);
  return json({ ok: true, id: saved.id });
};

// PATCH { classId, id, action: 'hide' | 'unhide' | 'dismiss' } → moderate a message
// PATCH { classId, chatMode: 'on' | 'group' | 'off' }          → turn the chat (or private chats) on / off
export const PATCH: APIRoute = async ({ locals, request }) => {
  const db = locals.db;
  const b = await readJson<{ classId: unknown; id?: unknown; action?: unknown; chatMode?: unknown }>(request);
  const classId = Number(b.classId);
  const perm = await classPerm(db, locals.coach!.id, classId);
  if (!canModerate(perm)) return json({ error: 'Solo el profe responsable o quien gestiona alumnos puede hacer esto' }, 403);

  if (b.chatMode !== undefined) {
    if (!CHAT_MODES.includes(b.chatMode as any)) return json({ error: 'Modo no válido' }, 400);
    await db.prepare('UPDATE classes SET chat_mode = ? WHERE id = ?').bind(b.chatMode, classId).run();
    return json({ ok: true, mode: b.chatMode });
  }
  const sql: Record<string, string> = {
    hide: 'UPDATE messages SET hidden = 1 WHERE id = ? AND class_id = ?',
    unhide: 'UPDATE messages SET hidden = 0 WHERE id = ? AND class_id = ?',
    dismiss: 'UPDATE messages SET flagged = 0 WHERE id = ? AND class_id = ?',
  };
  const q = sql[String(b.action)];
  if (!q) return json({ error: 'Acción no válida' }, 400);
  const r = await db.prepare(q).bind(Number(b.id), classId).run();
  if (!r.meta.changes) return json({ error: 'No encuentro ese mensaje' }, 404);
  return json({ ok: true });
};

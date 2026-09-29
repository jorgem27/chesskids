import type { APIRoute } from 'astro';
import { createSession, destroySession } from '../../lib/auth';

// Personal magic link (shared via WhatsApp / personal QR). Logs the kid in and remembers the device.
export const GET: APIRoute = async ({ locals, params, cookies, redirect, url }) => {
  const db = locals.db;
  const st = await db.prepare('SELECT id FROM students WHERE login_token = ? AND archived = 0')
    .bind(String(params.token)).first<{ id: number }>();
  if (!st) return redirect('/entrar?error=enlace');
  if (locals.student?.id !== st.id) {
    if (locals.student || locals.coach) await destroySession(db, cookies);
    await createSession(db, cookies, 'student', st.id, url.protocol === 'https:');
  }
  return redirect('/app?hola=1');
};

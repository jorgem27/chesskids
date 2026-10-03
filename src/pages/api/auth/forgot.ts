import type { APIRoute } from 'astro';
import { createPasswordReset, isLocked, recordFailure, RESET_TTL_EMAIL } from '../../../lib/auth';
import { json, readJson } from '../../../lib/db';
import { mailEnabled, sendMail } from '../../../lib/mail';

// "He olvidado mi contraseña": emails a one-time link when email is configured. The answer is the
// same whether or not the email exists, so it can't be used to find out who has an account.
export const POST: APIRoute = async ({ locals, request, url, clientAddress }) => {
  const db = locals.db;
  const { email } = await readJson<{ email: string }>(request);
  const addr = String(email ?? '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(addr)) return json({ error: 'Escribe un email válido' }, 400);
  if (!mailEnabled()) return json({ ok: true, mail: false });

  // Throttle per email and per IP (shares the login lockout table).
  const keys = [`forgot:${addr}`, `forgot-ip:${clientAddress ?? ''}`];
  for (const k of keys) if (await isLocked(db, k)) return json({ error: 'Demasiadas peticiones. Espera unos minutos.' }, 429);
  await Promise.all(keys.map((k) => recordFailure(db, k)));

  const c = await db.prepare('SELECT id, name FROM coaches WHERE email = ?').bind(addr).first<{ id: number; name: string }>();
  if (c) {
    const token = await createPasswordReset(db, c.id, null, RESET_TTL_EMAIL);
    await sendMail(addr, 'Cambia tu contraseña de Odisea Miranda',
      `Hola, ${c.name}:\n\nPara elegir una contraseña nueva, abre este enlace (caduca en 1 hora y solo sirve una vez):\n${url.origin}/profe/restablecer#t=${token}\n\nSi no lo has pedido tú, ignora este mensaje: tu contraseña no cambia.`);
  }
  return json({ ok: true, mail: true });
};

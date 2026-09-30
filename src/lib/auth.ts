import type { AstroCookies } from 'astro';
import { makeToken } from './catalog';

export const SESSION_COOKIE = 'ck_session';
const ITER = 100_000; // max allowed by Workers WebCrypto
const enc = new TextEncoder();

function b64(buf: ArrayBuffer | Uint8Array): string {
  const a = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...a));
}
function unb64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function derive(secret: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256);
}

export async function hashSecret(secret: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derive(secret, salt, ITER);
  return `pbkdf2$${ITER}$${b64(salt)}$${b64(bits)}`;
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const [alg, iter, salt, hash] = stored.split('$');
  if (alg !== 'pbkdf2') return false;
  const bits = new Uint8Array(await derive(secret, unb64(salt), Number(iter)));
  const expected = unb64(hash);
  if (bits.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ expected[i];
  return diff === 0;
}

async function sha256(s: string): Promise<string> {
  return b64(await crypto.subtle.digest('SHA-256', enc.encode(s)));
}

// ---------- Sessions ----------

export type UserType = 'coach' | 'student';

export async function createSession(db: D1Database, cookies: AstroCookies, type: UserType, userId: number, secure: boolean) {
  const token = makeToken(32);
  // Students: the device stays logged in for a year. Coaches: 30 days.
  const days = type === 'student' ? 365 : 30;
  const expires = Math.floor(Date.now() / 1000) + days * 86400;
  await db.prepare('INSERT INTO sessions (id, user_type, user_id, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), type, userId, expires).run();
  cookies.set(SESSION_COOKIE, token, {
    path: '/', httpOnly: true, sameSite: 'lax', secure, maxAge: days * 86400,
  });
}

export async function readSession(db: D1Database, token: string | undefined) {
  if (!token) return null;
  const row = await db.prepare('SELECT user_type, user_id, expires_at FROM sessions WHERE id = ?')
    .bind(await sha256(token)).first<{ user_type: UserType; user_id: number; expires_at: number }>();
  if (!row || row.expires_at < Date.now() / 1000) return null;
  return row;
}

export async function destroySession(db: D1Database, cookies: AstroCookies) {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (token) await db.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256(token)).run();
  cookies.delete(SESSION_COOKIE, { path: '/' });
}

// ---------- Brute-force protection (emoji PINs are short) ----------

const MAX_FAILS = 8;
const WINDOW = 10 * 60;

export async function isLocked(db: D1Database, key: string): Promise<boolean> {
  const r = await db.prepare('SELECT count, window_start FROM login_failures WHERE key = ?').bind(key)
    .first<{ count: number; window_start: number }>();
  if (!r) return false;
  if (Date.now() / 1000 - r.window_start > WINDOW) return false;
  return r.count >= MAX_FAILS;
}

export async function recordFailure(db: D1Database, key: string) {
  const now = Math.floor(Date.now() / 1000);
  await db.prepare(`INSERT INTO login_failures (key, count, window_start) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET
      count = CASE WHEN ? - window_start > ? THEN 1 ELSE count + 1 END,
      window_start = CASE WHEN ? - window_start > ? THEN ? ELSE window_start END`)
    .bind(key, now, now, WINDOW, now, WINDOW, now).run();
}

export async function clearFailures(db: D1Database, key: string) {
  await db.prepare('DELETE FROM login_failures WHERE key = ?').bind(key).run();
}

// ---------- Coach password re-check (for destructive actions) ----------

/** Returns null when the password is right, otherwise a Spanish error message. Shares the brute-force lockout. */
export async function checkCoachPassword(db: D1Database, coachId: number, password: unknown): Promise<string | null> {
  const key = `coach-confirm:${coachId}`;
  if (await isLocked(db, key)) return 'Demasiados intentos. Espera unos minutos.';
  const row = await db.prepare('SELECT password_hash FROM coaches WHERE id = ?').bind(coachId).first<{ password_hash: string }>();
  if (!row || typeof password !== 'string' || !password || !(await verifySecret(password, row.password_hash))) {
    await recordFailure(db, key);
    return 'Contraseña incorrecta';
  }
  await clearFailures(db, key);
  return null;
}

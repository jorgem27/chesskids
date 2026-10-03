// Opt-in Web Push streak reminders. Notifications carry NO payload (so no message encryption is
// needed and no personal data leaves the server): the service worker shows a fixed friendly text.
// Requests are authenticated with VAPID (RFC 8292): an ES256 JWT signed with WebCrypto.
import { dayKey } from './rewards';
import { addDays } from './dates';

/** Only real browser push services: the server POSTs to this URL, so never accept arbitrary hosts. */
const PUSH_HOSTS = ['fcm.googleapis.com', 'android.googleapis.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com'];

export function validPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 800) return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && !u.port && PUSH_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...(buf instanceof Uint8Array ? buf : new Uint8Array(buf)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

export interface VapidKeys { publicKey: string; privateKey: string; subject: string }

/** The VAPID JWT for one push service origin, valid for 12 hours. */
export async function vapidJwt(audience: string, keys: VapidKeys, now = Math.floor(Date.now() / 1000)): Promise<string> {
  const pub = unb64url(keys.publicKey); // 65 bytes: 0x04 || x || y
  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', d: keys.privateKey, x: b64url(pub.slice(1, 33)), y: b64url(pub.slice(33, 65)), ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const enc = new TextEncoder();
  const head = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64url(enc.encode(JSON.stringify({ aud: audience, exp: now + 12 * 3600, sub: keys.subject })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(sig)}`;
}

/** Sends an empty push. Returns 'gone' when the subscription no longer exists. */
export async function sendPush(endpoint: string, keys: VapidKeys): Promise<'ok' | 'gone' | 'error'> {
  try {
    const jwt = await vapidJwt(new URL(endpoint).origin, keys);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { TTL: String(6 * 3600), Urgency: 'normal', Authorization: `vapid t=${jwt}, k=${keys.publicKey}`, 'Content-Length': '0' },
      redirect: 'manual', // the allowlist only vouches for the first URL
    });
    if (res.status === 404 || res.status === 410) return 'gone';
    return res.ok ? 'ok' : 'error';
  } catch {
    return 'error';
  }
}

export function vapidFromEnv(e: Partial<Env>): VapidKeys | null {
  if (!e.VAPID_PUBLIC_KEY || !e.VAPID_PRIVATE_KEY) return null;
  return { publicKey: e.VAPID_PUBLIC_KEY, privateKey: e.VAPID_PRIVATE_KEY, subject: e.VAPID_SUBJECT || 'mailto:admin@example.com' };
}

// Per cron run: stays under the Workers subrequest limit (50 on the free plan). The cron runs
// every 10 minutes during one hour (wrangler.jsonc), so up to ~270 reminders a day.
const BATCH = 45;

/**
 * Daily cron: remind students whose streak ends tonight (they played yesterday but not today).
 * A system job over opt-in subscriptions only; it reads no data beyond the student's own streak.
 */
export async function sendStreakReminders(db: D1Database, e: Partial<Env>): Promise<number> {
  const keys = vapidFromEnv(e);
  if (!keys) return 0;
  const today = dayKey(new Date());
  const { results } = await db.prepare(
    `SELECT ps.endpoint FROM push_subscriptions ps JOIN students s ON s.id = ps.student_id
     WHERE s.archived = 0 AND s.streak >= 1 AND s.last_active_day = ? AND (ps.last_sent_day IS NULL OR ps.last_sent_day < ?) LIMIT ?`,
  ).bind(addDays(today, -1), today, BATCH).all<{ endpoint: string }>();
  const outcome = await Promise.all(results.map(async (r) => ({ endpoint: r.endpoint, res: await sendPush(r.endpoint, keys) })));
  const stmts = outcome.map((o) => o.res === 'gone'
    ? db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(o.endpoint)
    : db.prepare('UPDATE push_subscriptions SET last_sent_day = ? WHERE endpoint = ?').bind(today, o.endpoint));
  if (stmts.length) await db.batch(stmts);
  return outcome.filter((o) => o.res === 'ok').length;
}

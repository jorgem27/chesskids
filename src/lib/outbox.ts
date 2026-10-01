// Offline outbox: results that could not be sent (no connection) wait in localStorage and are
// re-sent when the student is back online. Endpoints are idempotent (attempt nonce /
// single-use practice session), so sending twice is harmless. Every entry belongs to one
// student: on a shared tablet it is only sent while that same student is logged in.

const KEY = 'ck-outbox';
const MAX_AGE_MS = 3 * 24 * 3600 * 1000;

interface Entry { url: string; body: unknown; at: number; student: string }

function read(): Entry[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Entry[]; } catch { return []; }
}
function write(list: Entry[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage full or blocked */ }
}
function currentStudent(): string {
  return typeof document !== 'undefined' ? document.documentElement.dataset.student ?? '' : '';
}

export function queueResult(url: string, body: unknown) {
  const student = currentStudent();
  if (!student) return;
  write([...read(), { url, body, at: Date.now(), student }].slice(-30));
}

export function pendingCount(): number {
  const me = currentStudent();
  return read().filter((e) => e.student === me).length;
}

let flushing = false;

/** Sends the current student's queued results. Returns how many were delivered. */
export async function flushOutbox(): Promise<number> {
  const me = currentStudent();
  if (flushing || !me || (typeof navigator !== 'undefined' && !navigator.onLine)) return 0;
  flushing = true;
  let sent = 0;
  try {
    const keep: Entry[] = [];
    for (const e of read()) {
      if (Date.now() - e.at > MAX_AGE_MS) continue;
      if (e.student !== me) { keep.push(e); continue; } // another kid's result waits for them
      try {
        const res = await fetch(e.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(e.body) });
        if (res.ok) sent++;
        else if (res.status >= 500 || res.status === 401) keep.push(e); // retry later (or after logging in again)
      } catch {
        keep.push(e);
      }
    }
    write(keep);
  } finally {
    flushing = false;
  }
  return sent;
}

/** Fetch failed before reaching the server (offline, DNS, dropped connection). */
export function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError;
}

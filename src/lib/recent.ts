// Profiles that have logged in on this device (for shared family phones/tablets).
export interface RecentProfile { id: number; name: string; avatar: string; code: string }
const KEY = 'ck-recent-profiles';

export function getRecent(): RecentProfile[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}

export function rememberProfile(p: RecentProfile) {
  try {
    const list = [p, ...getRecent().filter((r) => r.id !== p.id)].slice(0, 6);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch { /* ignore */ }
}

export function forgetProfile(id: number) {
  try { localStorage.setItem(KEY, JSON.stringify(getRecent().filter((r) => r.id !== id))); } catch { /* ignore */ }
}

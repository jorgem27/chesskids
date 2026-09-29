// Shared, pure data used by both server and client (avatars, PIN emojis, age groups).

export const AVATARS = [
  '🦁', '🐯', '🐼', '🐨', '🦊', '🐸', '🐵', '🦄', '🐲', '🐙',
  '🦉', '🐧', '🐰', '🐶', '🐱', '🦖', '🐳', '🦋', '🐢', '🦒',
] as const;

/** The 9 picture-password emojis. A PIN is 3 of them in order (e.g. "🍎🚀⭐"). */
export const PIN_EMOJIS = ['🍎', '🍌', '🍇', '🍓', '🍉', '⭐', '🌙', '⚽', '🚀'] as const;

export const PIN_NAMES: Record<string, string> = {
  '🍎': 'manzana', '🍌': 'plátano', '🍇': 'uvas', '🍓': 'fresa', '🍉': 'sandía',
  '⭐': 'estrella', '🌙': 'luna', '⚽': 'balón', '🚀': 'cohete',
};

export type AgeGroup = 'peque' | 'explorador' | 'maestro';

export const AGE_GROUPS: Record<AgeGroup, { label: string; range: string; emoji: string }> = {
  peque: { label: 'Peques', range: '5–7 años', emoji: '🐣' },
  explorador: { label: 'Exploradores', range: '8–11 años', emoji: '🧭' },
  maestro: { label: 'Maestros', range: '12–15 años', emoji: '🎓' },
};

export const CLASS_COLORS = ['violet', 'sky', 'emerald', 'amber', 'rose', 'orange'] as const;

/** Splits an emoji PIN string into its emojis (handles surrogate pairs). */
export function splitPin(pin: string): string[] {
  return Array.from(pin).filter((c) => (PIN_EMOJIS as readonly string[]).includes(c));
}

const USER_WORDS = ['peon', 'torre', 'caballo', 'alfil', 'dama', 'rey', 'enroque', 'jaque'];

function slugName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 10) || 'alumno';
}

function rnd(n: number): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
}

export function makeUsername(name: string): string {
  return `${slugName(name)}.${USER_WORDS[rnd(USER_WORDS.length)]}${10 + rnd(90)}`;
}

/** Kid-friendly password: "caballo-verde-42". */
export function makeKidPassword(): string {
  const a = ['caballo', 'torre', 'alfil', 'dama', 'peon', 'rey', 'dragon', 'cohete', 'tigre', 'panda'];
  const b = ['azul', 'verde', 'rojo', 'lila', 'rosa', 'feliz', 'veloz', 'magico', 'loco', 'genial'];
  return `${a[rnd(a.length)]}-${b[rnd(b.length)]}-${10 + rnd(90)}`;
}

export function makeRandomPin(): string {
  return [0, 1, 2].map(() => PIN_EMOJIS[rnd(PIN_EMOJIS.length)]).join('');
}

/** Short, unambiguous class code, e.g. "KX7P2". */
export function makeClassCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => chars[rnd(chars.length)]).join('');
}

export function makeToken(bytes = 18): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

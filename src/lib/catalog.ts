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

/** Legacy named class colors (stored before the free color picker) mapped to hex. */
// 'violet' (the old default, still the column default) now renders as the brand blue.
const LEGACY_COLORS: Record<string, string> = { violet: '#2a4c9d', sky: '#0ea5e9', emerald: '#10b981', amber: '#f59e0b', rose: '#f43f5e', orange: '#f97316' };
export const DEFAULT_CLASS_COLOR = LEGACY_COLORS.violet;
export const CLASS_COLOR_PRESETS = [DEFAULT_CLASS_COLOR, '#c9921f', LEGACY_COLORS.sky, LEGACY_COLORS.emerald, LEGACY_COLORS.rose, LEGACY_COLORS.orange];
const HEX = /^#[0-9a-f]{6}$/i;

/** Returns a valid #rrggbb for a stored class color (hex or legacy name). */
export function classColorHex(value: string | null | undefined): string {
  const v = String(value ?? '').trim();
  if (HEX.test(v)) return v.toLowerCase();
  return LEGACY_COLORS[v] ?? DEFAULT_CLASS_COLOR;
}

/** Card gradient for a class color; darkened so white text stays readable. */
export function classGradient(value: string | null | undefined): string {
  const n = parseInt(classColorHex(value).slice(1), 16);
  const shade = (f: number) => [n >> 16, (n >> 8) & 255, n & 255].map((c) => Math.round(c * f).toString(16).padStart(2, '0')).join('');
  return `linear-gradient(135deg, #${shade(0.85)}, #${shade(0.6)})`;
}

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

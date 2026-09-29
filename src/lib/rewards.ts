// Gamification rules. Pure functions shared by server (authoritative) and client (animations).

// ---------- XP & levels ----------

/** Total XP needed to reach `level` (level 1 = 0 XP). 50, 150, 300, 500, 750... */
export function xpForLevel(level: number): number {
  return 25 * level * (level - 1);
}

export function levelFromXp(xp: number): number {
  let l = 1;
  while (xpForLevel(l + 1) <= xp) l++;
  return l;
}

export function levelProgress(xp: number) {
  const level = levelFromXp(xp);
  const from = xpForLevel(level);
  const to = xpForLevel(level + 1);
  return { level, from, to, inLevel: xp - from, needed: to - from, pct: (xp - from) / (to - from) };
}

export function starsFor(score: number, maxScore: number): number {
  if (maxScore <= 0) return 3;
  const r = score / maxScore;
  if (r >= 0.95) return 3;
  if (r >= 0.6) return 2;
  if (r > 0) return 1;
  return 0;
}

export interface XpInput {
  baseXp: number;
  score: number;
  maxScore: number;
  seconds: number;
  firstTime: boolean;
  isHomework: boolean;
}

export interface XpBreakdown {
  performance: number;
  stars: number;
  time: number;
  homework: number;
  total: number;
  starCount: number;
}

/** XP for finishing an activity: performance + star bonus + minutes learning (+ homework bonus). */
export function computeXp(i: XpInput): XpBreakdown {
  const starCount = starsFor(i.score, i.maxScore);
  const ratio = i.maxScore > 0 ? Math.max(0, Math.min(1, i.score / i.maxScore)) : 1;
  let performance = Math.round(i.baseXp * ratio);
  let stars = starCount * 5;
  if (!i.firstTime) {
    performance = Math.round(performance * 0.4);
    stars = Math.round(stars * 0.4);
  }
  const minutes = Math.floor(Math.min(i.seconds, 1800) / 60);
  const time = Math.min(minutes, 10);
  const homework = i.isHomework && i.firstTime ? 10 : 0;
  const total = Math.max(2, performance + stars + time + homework);
  return { performance, stars, time, homework, total, starCount };
}

export const DAILY_GOAL_XP = 30;

// ---------- Streaks (days in Europe/Madrid) ----------

export function dayKey(date: Date, tz = 'Europe/Madrid'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function prevDay(key: string): string {
  const d = new Date(key + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function nextStreak(lastDay: string | null, current: number, today: string): { streak: number; extended: boolean } {
  if (lastDay === today) return { streak: Math.max(1, current), extended: false };
  if (lastDay && prevDay(today) === lastDay) return { streak: current + 1, extended: true };
  return { streak: 1, extended: true };
}

/** Monday of the current week (Europe/Madrid) as YYYY-MM-DD. */
export function weekStart(date: Date): string {
  const key = dayKey(date);
  const d = new Date(key + 'T12:00:00Z');
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

// ---------- Kingdoms (world map) ----------

export interface Kingdom {
  id: string;
  name: string;
  emoji: string;
  xp: number;
  color: string; // tailwind-ish hex
  sky: string;
  tagline: string;
}

export const KINGDOMS: Kingdom[] = [
  { id: 'aldea', name: 'Aldea del Peón', emoji: '🏡', xp: 0, color: '#84cc16', sky: '#ecfccb', tagline: '¡Aquí empieza tu aventura!' },
  { id: 'bosque', name: 'Bosque del Caballo', emoji: '🌲', xp: 150, color: '#16a34a', sky: '#dcfce7', tagline: 'Salta como un caballo entre los árboles' },
  { id: 'lago', name: 'Lago del Alfil', emoji: '🏝️', xp: 400, color: '#0ea5e9', sky: '#e0f2fe', tagline: 'Navega en diagonal' },
  { id: 'montana', name: 'Montaña de la Torre', emoji: '🏔️', xp: 800, color: '#64748b', sky: '#f1f5f9', tagline: 'Sube recto hasta la cima' },
  { id: 'desierto', name: 'Desierto del Enroque', emoji: '🐪', xp: 1400, color: '#f59e0b', sky: '#fef3c7', tagline: 'Protege a tu rey en las dunas' },
  { id: 'volcan', name: 'Volcán del Jaque', emoji: '🌋', xp: 2200, color: '#ef4444', sky: '#fee2e2', tagline: '¡Cuidado, que quema!' },
  { id: 'palacio', name: 'Palacio de la Dama', emoji: '🏰', xp: 3300, color: '#a855f7', sky: '#f3e8ff', tagline: 'La pieza más poderosa te espera' },
  { id: 'estrellas', name: 'Reino de las Estrellas', emoji: '🌌', xp: 5000, color: '#6366f1', sky: '#e0e7ff', tagline: 'Solo para leyendas del ajedrez' },
];

export function kingdomIndex(xp: number): number {
  let i = 0;
  KINGDOMS.forEach((k, idx) => { if (xp >= k.xp) i = idx; });
  return i;
}

// ---------- Stickers (collectibles) ----------

export interface Stats {
  xp: number;
  streak: number;
  puzzlesSolved: number;
  gamesCompleted: number;
  totalSeconds: number;
  threeStars: number;
  lessonsDone: number;
  fruitPerfect: number;
  blitzDone: number;
  homeworkDone: number;
}

export interface Sticker {
  id: string;
  emoji: string;
  name: string;
  hint: string;
  rarity: 'común' | 'rara' | 'épica' | 'legendaria';
  test: (s: Stats) => boolean;
}

export const STICKERS: Sticker[] = [
  { id: 'primer-paso', emoji: '👣', name: 'Primer paso', hint: 'Termina tu primera actividad', rarity: 'común', test: (s) => s.gamesCompleted >= 1 },
  { id: 'resuelve-1', emoji: '🧩', name: 'Detective', hint: 'Resuelve 1 problema', rarity: 'común', test: (s) => s.puzzlesSolved >= 1 },
  { id: 'resuelve-10', emoji: '🔍', name: 'Lupa de oro', hint: 'Resuelve 10 problemas', rarity: 'común', test: (s) => s.puzzlesSolved >= 10 },
  { id: 'resuelve-50', emoji: '🧠', name: 'Supercerebro', hint: 'Resuelve 50 problemas', rarity: 'rara', test: (s) => s.puzzlesSolved >= 50 },
  { id: 'resuelve-200', emoji: '🦾', name: 'Máquina de táctica', hint: 'Resuelve 200 problemas', rarity: 'épica', test: (s) => s.puzzlesSolved >= 200 },
  { id: 'resuelve-500', emoji: '👑', name: 'Rey de los problemas', hint: 'Resuelve 500 problemas', rarity: 'legendaria', test: (s) => s.puzzlesSolved >= 500 },
  { id: 'racha-3', emoji: '🔥', name: 'En llamas', hint: 'Juega 3 días seguidos', rarity: 'común', test: (s) => s.streak >= 3 },
  { id: 'racha-7', emoji: '☄️', name: 'Semana perfecta', hint: 'Juega 7 días seguidos', rarity: 'rara', test: (s) => s.streak >= 7 },
  { id: 'racha-30', emoji: '🌞', name: 'Imparable', hint: 'Juega 30 días seguidos', rarity: 'legendaria', test: (s) => s.streak >= 30 },
  { id: 'estrellas-1', emoji: '⭐', name: 'Estrellita', hint: 'Consigue 3 estrellas en una actividad', rarity: 'común', test: (s) => s.threeStars >= 1 },
  { id: 'estrellas-10', emoji: '🌟', name: 'Constelación', hint: 'Consigue 3 estrellas 10 veces', rarity: 'rara', test: (s) => s.threeStars >= 10 },
  { id: 'estrellas-50', emoji: '💫', name: 'Galaxia', hint: 'Consigue 3 estrellas 50 veces', rarity: 'épica', test: (s) => s.threeStars >= 50 },
  { id: 'leccion-1', emoji: '📖', name: 'Buen alumno', hint: 'Termina una lección', rarity: 'común', test: (s) => s.lessonsDone >= 1 },
  { id: 'leccion-10', emoji: '🎓', name: 'Sabio', hint: 'Termina 10 lecciones', rarity: 'rara', test: (s) => s.lessonsDone >= 10 },
  { id: 'fruta-1', emoji: '🍓', name: 'Frutero experto', hint: 'Recoge toda la fruta por el camino más corto', rarity: 'común', test: (s) => s.fruitPerfect >= 1 },
  { id: 'fruta-10', emoji: '🧺', name: 'Cesta llena', hint: 'Camino perfecto en 10 niveles de fruta', rarity: 'rara', test: (s) => s.fruitPerfect >= 10 },
  { id: 'rayo-1', emoji: '⚡', name: 'Rayo', hint: 'Termina un reto relámpago', rarity: 'común', test: (s) => s.blitzDone >= 1 },
  { id: 'deberes-1', emoji: '🎒', name: 'Deberes hechos', hint: 'Termina una misión de la semana', rarity: 'común', test: (s) => s.homeworkDone >= 1 },
  { id: 'deberes-10', emoji: '🏅', name: 'Responsable', hint: 'Termina 10 misiones de la semana', rarity: 'rara', test: (s) => s.homeworkDone >= 10 },
  { id: 'tiempo-60', emoji: '⏰', name: 'Una hora de ajedrez', hint: 'Aprende durante 1 hora en total', rarity: 'rara', test: (s) => s.totalSeconds >= 3600 },
  { id: 'tiempo-600', emoji: '⌛', name: 'Diez horas', hint: 'Aprende durante 10 horas en total', rarity: 'épica', test: (s) => s.totalSeconds >= 36000 },
  { id: 'reino-2', emoji: '🗺️', name: 'Explorador', hint: 'Llega al Bosque del Caballo', rarity: 'común', test: (s) => s.xp >= KINGDOMS[1].xp },
  { id: 'reino-5', emoji: '🧭', name: 'Aventurero', hint: 'Llega al Desierto del Enroque', rarity: 'rara', test: (s) => s.xp >= KINGDOMS[4].xp },
  { id: 'reino-8', emoji: '🏆', name: 'Leyenda', hint: 'Llega al Reino de las Estrellas', rarity: 'legendaria', test: (s) => s.xp >= KINGDOMS[7].xp },
];

export function earnedStickers(stats: Stats): string[] {
  return STICKERS.filter((s) => s.test(stats)).map((s) => s.id);
}

export function stickerById(id: string): Sticker | undefined {
  return STICKERS.find((s) => s.id === id);
}

// ---------- Cheering copy ----------

export const PRAISE = ['¡Genial!', '¡Increíble!', '¡Muy bien!', '¡Eres un crack!', '¡Fantástico!', '¡Bravo!', '¡Perfecto!', '¡Así se juega!'];
export const ENCOURAGE = ['¡Casi!', '¡Prueba otra vez!', '¡Tú puedes!', 'Mmm… mira bien', '¡Sigue intentándolo!'];

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

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
  dailyDone: number; // daily puzzles solved
  reviewFixed: number; // failed items later solved in "Repaso"
  campaignsDone: number;
  rating: number; // "Entrena" tactics rating (0 = not placed)
}

export interface Sticker {
  id: string;
  emoji: string;
  name: string;
  hint: string;
  rarity: 'común' | 'rara' | 'épica' | 'legendaria';
  test: (s: Stats) => boolean;
  /** Not derived from Stats: granted when something happens (see eventStickers / campaign rewards). */
  event?: true;
}

const never = () => false;

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
  { id: 'diario-1', emoji: '☀️', name: 'Buenos días', hint: 'Resuelve el problema del día', rarity: 'común', test: (s) => s.dailyDone >= 1 },
  { id: 'diario-10', emoji: '📅', name: 'Puntual', hint: 'Resuelve 10 problemas del día', rarity: 'rara', test: (s) => s.dailyDone >= 10 },
  { id: 'repaso-1', emoji: '🩹', name: 'Arreglafallos', hint: 'Arregla un fallo en el Repaso', rarity: 'común', test: (s) => s.reviewFixed >= 1 },
  { id: 'repaso-25', emoji: '🔧', name: 'Mecánico de errores', hint: 'Arregla 25 fallos en el Repaso', rarity: 'épica', test: (s) => s.reviewFixed >= 25 },
  { id: 'campana-1', emoji: '🚩', name: 'Conquistador', hint: 'Completa un mapa de aventura', rarity: 'rara', test: (s) => s.campaignsDone >= 1 },
  { id: 'campana-3', emoji: '🏴‍☠️', name: 'Gran explorador', hint: 'Completa 3 mapas de aventura', rarity: 'épica', test: (s) => s.campaignsDone >= 3 },
  { id: 'rating-1200', emoji: '📈', name: 'Táctica 1200', hint: 'Llega a 1200 puntos en Entrena', rarity: 'rara', test: (s) => s.rating >= 1200 },
  { id: 'rating-1600', emoji: '🚀', name: 'Táctica 1600', hint: 'Llega a 1600 puntos en Entrena', rarity: 'épica', test: (s) => s.rating >= 1600 },
  { id: 'sin-fallos', emoji: '🎯', name: 'Diana perfecta', hint: 'Resuelve 10 problemas o más en una actividad sin fallar', rarity: 'rara', test: never, event: true },
  { id: 'madrugador', emoji: '🐓', name: 'Madrugador', hint: 'Juega antes de las 9 de la mañana', rarity: 'común', test: never, event: true },
  { id: 'finde', emoji: '🏖️', name: 'Ajedrez en finde', hint: 'Juega un sábado o un domingo', rarity: 'común', test: never, event: true },
  { id: 'reto-clase', emoji: '🤝', name: 'Trabajo en equipo', hint: 'Ayuda a tu clase a superar el reto de la semana', rarity: 'rara', test: never, event: true },
  { id: 'dragon-dorado', emoji: '🐲', name: 'Dragón Dorado', hint: 'Premio especial de un mapa de aventura', rarity: 'legendaria', test: never, event: true },
];

/** Madrid wall clock: hour (0-23) and weekday (0 = Sunday). */
export function madridClock(date: Date): { hour: number; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: 'numeric', hour12: false, weekday: 'short' }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const wd = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  return { hour, weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd) };
}

/** Stickers earned by *how* a game was played (not by totals). */
export function eventStickers(e: { hour: number; weekday: number; puzzlesSolved: number; mistakes: number }): string[] {
  const out: string[] = [];
  if (e.puzzlesSolved >= 10 && e.mistakes === 0) out.push('sin-fallos');
  if (e.hour >= 5 && e.hour < 9) out.push('madrugador');
  if (e.weekday === 0 || e.weekday === 6) out.push('finde');
  return out;
}

export function earnedStickers(stats: Stats): string[] {
  return STICKERS.filter((s) => !s.event && s.test(stats)).map((s) => s.id);
}

// ---------- Practice (Repaso / Problema del día / Entrena) ----------

export type PracticeKind = 'repaso' | 'diario' | 'entrena';

/** Max XP per day from "Entrena", so endless training can't farm the league. */
export const TRAINING_DAILY_XP_CAP = 60;

/** XP for a practice session. `cap` = XP still allowed today for this kind (Infinity if none). */
export function practiceXp(kind: PracticeKind, solved: number, total: number, seconds: number, cap = Infinity): XpBreakdown {
  const starCount = starsFor(solved, total);
  const performance = kind === 'diario' ? (solved > 0 ? 15 : 5) : (kind === 'repaso' ? 4 : 3) * solved;
  const stars = kind === 'diario' ? 0 : starCount * 2;
  const time = Math.min(10, Math.floor(Math.min(seconds, 1800) / 60));
  const total_ = Math.max(0, Math.min(Math.max(2, performance + stars + time), cap));
  return { performance, stars, time, homework: 0, total: total_, starCount };
}

// ---------- Tactics rating (Entrena) ----------

export const RATING_MIN = 400;
export const RATING_MAX = 2800;

export function startRating(ageGroup: string): number {
  return ageGroup === 'peque' ? 600 : ageGroup === 'maestro' ? 1000 : 800;
}

/** Most a session can move the rating (results are reported by the client). */
export const RATING_SESSION_CAP = 60;

/** Elo-style update after one puzzle: bigger steps while the student is still being placed. */
export function nextRating(rating: number, games: number, puzzleRating: number, solved: boolean): number {
  const k = games < 10 ? 60 : games < 30 ? 40 : 24;
  const expected = 1 / (1 + 10 ** ((puzzleRating - rating) / 400));
  const r = Math.round(rating + k * ((solved ? 1 : 0) - expected));
  return Math.max(RATING_MIN, Math.min(RATING_MAX, r));
}

/** Friendly label for a rating (kids see an animal, not only a number). */
export function ratingBand(r: number): { name: string; emoji: string } {
  if (r < 700) return { name: 'Pollito', emoji: '🐣' };
  if (r < 900) return { name: 'Aprendiz', emoji: '🐥' };
  if (r < 1100) return { name: 'Explorador', emoji: '🦊' };
  if (r < 1300) return { name: 'Cazador', emoji: '🦅' };
  if (r < 1600) return { name: 'Maestro', emoji: '🦁' };
  return { name: 'Leyenda', emoji: '🐉' };
}

// ---------- Weekly class challenge ----------

/** Puzzles the whole class should solve this week: the coach's number, or 12 per student (min 20). */
export function weeklyGoal(custom: number, students: number): number {
  if (custom > 0) return custom;
  return Math.max(20, students * 12);
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

// Class chat: pure helpers shared by the server (/api/chat, /api/coach/chat) and the chat islands.
// No DB access here, so tests/chat.test.ts can cover it. Server queries live in chatServer.ts.
import { Chess } from 'chess.js';
import type { PuzzleSetContent, PuzzleStep } from '../games/puzzle/logic';

export const MAX_TEXT = 300;
export const MAX_GAME_PLIES = 300;
export const RATE_LIMIT = 12; // messages per sender per minute
export const RETENTION_DAYS = 180; // older messages are deleted by the daily cron
export const GROUP_THREAD = 'clase';
export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export type ChatMode = 'on' | 'group' | 'off';
export const CHAT_MODES: ChatMode[] = ['on', 'group', 'off'];
export const asChatMode = (v: unknown): ChatMode => (CHAT_MODES.includes(v as ChatMode) ? (v as ChatMode) : 'on');

/** Puzzle shared in the chat: the start position (sharer's side to move) and the full UCI line. */
export interface ChatPuzzle { fen: string; moves: string[]; prompt: string; steps?: PuzzleStep[] }
/** Game or position shared in the chat (no moves = just a position). `fen` = final position. */
export interface ChatGame { start: string; moves: string[]; fen: string }

export type ChatKind = 'text' | 'puzzle' | 'game';

/** What the composer sends besides text: a mission puzzle (copied on the server) or a game to replay. */
export type ShareInput = { type: 'puzzle'; activityId: number; index: number } | { type: 'game'; start?: string; moves?: string[] };

export interface ChatMessage {
  id: number;
  thread: string;
  mine: boolean;
  who: { type: 'student' | 'coach'; id: number; name: string; avatar: string };
  kind: ChatKind;
  body: string;
  puzzle?: ChatPuzzle;
  game?: ChatGame;
  at: number; // unix seconds
  hidden?: boolean; // coach view only
  flagged?: number; // coach view only: 1 = reported by a student, 2 = caught by the word filter
}

// ---------- Threads ----------

export function dmThread(a: number, b: number): string {
  return `dm:${Math.min(a, b)}-${Math.max(a, b)}`;
}

/** 'clase' → group; 'dm:3-7' → the two student ids; anything else → null. */
export function parseThread(t: string): { group: true } | { group: false; a: number; b: number } | null {
  if (t === GROUP_THREAD) return { group: true };
  const m = /^dm:(\d{1,10})-(\d{1,10})$/.exec(t);
  if (!m) return null;
  const a = Number(m[1]), b = Number(m[2]);
  return a < b ? { group: false, a, b } : null;
}

// ---------- Text filter ----------

// Insults and swear words that kids commonly use to hurt each other. Matched as whole words,
// with or without accents and with repeated letters ("tontooo"). A hit masks the word and flags
// the message for the coach; the message is still delivered (with the word hidden).
const BAD_WORDS = [
  'tonto', 'tonta', 'idiota', 'imbecil', 'estupido', 'estupida', 'gilipollas', 'subnormal', 'mierda', 'joder',
  'puta', 'puto', 'cabron', 'cabrona', 'maricon', 'retrasado', 'retrasada', 'capullo', 'capulla', 'mongolo',
  'mongola', 'zorra', 'polla', 'coño', 'pringado', 'pringada', 'inutil', 'asqueroso', 'asquerosa', 'imbeciles', 'idiotas', 'tontos', 'tontas', 'subnormales', 'gilipolla',
  'muerete', 'callate', 'te odio', 'nadie te quiere', 'eres feo', 'eres fea', 'gordo asqueroso', 'gorda asquerosa',
];

const ACCENTS: Record<string, string> = { a: 'aáàä', e: 'eéèë', i: 'iíìï', o: 'oóòö', u: 'uúùü', n: 'nñ', ñ: 'ñn' };

// One `[x]+` per run of equal letters ("polla" → p o l a): adjacent `[l]+[l]+` would backtrack badly.
function wordPattern(w: string): string {
  return [...w].filter((c, i, a) => c !== a[i - 1]).map((c) => (c === ' ' ? '\\s+' : `[${ACCENTS[c] ?? c}]+`)).join('');
}

const BAD_RE = new RegExp(`(?<![\\p{L}\\p{N}])(?:${BAD_WORDS.map(wordPattern).join('|')})(?![\\p{L}\\p{N}])`, 'giu');
const LINK_RE = /\b(?:https?:\/\/|www\.)\S+|\b[\w-]+(?:\.[\w-]+)*\.(?:com|es|net|org|io|tv|me|gg|ly|app|xyz|info|link|be|co|eu|cat|gal|eus)\b\S*/giu;
const EMAIL_RE = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+/gu;
const PHONE_RE = /(?:\+\s?)?(?:\d[\s.-]?){6,}\d/g;
// Control characters and invisible formatting (zero-width, bidi overrides) that can hide text.
const INVISIBLE_RE = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f​-‏‪-‮⁠-⁤﻿]/g;

/**
 * Cleans a chat message: removes links, e-mails and phone numbers (kids shouldn't share contact
 * data or send people elsewhere), masks insults, trims whitespace and cuts it to MAX_TEXT.
 * `flagged` = an insult was found (the coach sees it in the "to review" list).
 */
export function cleanText(raw: unknown): { text: string; flagged: boolean } {
  // Cut long input before any regex runs (cheap CPU bound; the final cut to MAX_TEXT is below).
  let t = typeof raw === 'string' ? raw.slice(0, MAX_TEXT * 4) : '';
  t = t.normalize('NFC').replace(INVISIBLE_RE, '').replace(/\r\n?/g, '\n');
  t = t.replace(EMAIL_RE, '(correo quitado)').replace(LINK_RE, '(enlace quitado)').replace(PHONE_RE, '(número quitado)');
  let flagged = false;
  t = t.replace(BAD_RE, (m) => { flagged = true; return m[0] + '★'.repeat(Math.max(2, m.length - 1)); });
  t = t.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if ([...t].length > MAX_TEXT) t = [...t].slice(0, MAX_TEXT).join('').trimEnd() + '…';
  return { text: t, flagged };
}

// ---------- Chess shares ----------

function loadFen(fen: unknown): Chess | null {
  if (typeof fen !== 'string' || fen.length > 100) return null;
  try { return new Chess(fen.trim()); } catch { return null; }
}

/** Validates a game/position by replaying it with chess.js. Returns null if anything is illegal. */
export function validateGame(start: unknown, moves: unknown): ChatGame | null {
  const chess = loadFen(start ?? START_FEN);
  if (!chess) return null;
  const list = moves ?? [];
  if (!Array.isArray(list) || list.length > MAX_GAME_PLIES) return null;
  const fen0 = chess.fen();
  const ucis: string[] = [];
  for (const u of list) {
    if (typeof u !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(u)) return null;
    try {
      const m = chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
      ucis.push(m.from + m.to + (m.promotion ?? ''));
    } catch { return null; }
  }
  return { start: fen0, moves: ucis, fen: chess.fen() };
}

/**
 * What a kid pasted: a FEN (a position) or a PGN (a game, possibly from a [FEN] header).
 * Returns null when it is neither.
 */
export function parsePastedChess(text: string): ChatGame | null {
  const t = text.trim();
  if (!t || t.length > 20000) return null;
  if (/^[1-8pnbrqkPNBRQK]+(\/[1-8pnbrqkPNBRQK]+){7}(\s|$)/.test(t)) {
    // FEN without the counters is common: fill in the defaults chess.js needs.
    const parts = t.split(/\s+/);
    const fen = [parts[0], parts[1] ?? 'w', parts[2] ?? '-', parts[3] ?? '-', parts[4] ?? '0', parts[5] ?? '1'].join(' ');
    return validateGame(fen, []);
  }
  try {
    const chess = new Chess();
    chess.loadPgn(t);
    const history = chess.history({ verbose: true });
    // A PGN with only a [FEN] header is a position.
    if (!history.length) return chess.getHeaders().FEN ? validateGame(chess.fen(), []) : null;
    const start = history[0].before;
    return validateGame(start, history.slice(0, MAX_GAME_PLIES).map((m) => m.from + m.to + (m.promotion ?? '')));
  } catch {
    return null;
  }
}

/** One puzzle of a puzzle activity, ready to be shared (null if the index/content is not valid). */
export function puzzleFromContent(content: unknown, index: unknown): ChatPuzzle | null {
  const puzzles = (content as PuzzleSetContent | null)?.puzzles;
  const i = Number(index);
  if (!Array.isArray(puzzles) || !Number.isInteger(i) || i < 0 || i >= puzzles.length) return null;
  const p = puzzles[i];
  const game = validateGame(p?.fen, p?.moves);
  // Student, reply, …, student: always an odd number of moves.
  if (!game || game.moves.length % 2 === 0) return null;
  const out: ChatPuzzle = { fen: game.start, moves: game.moves, prompt: typeof p.prompt === 'string' ? p.prompt.slice(0, 80) : '' };
  // Keep the coach's accepted alternatives (rules), not the hint texts.
  if (Array.isArray(p.steps) && p.steps.some((s) => Array.isArray(s?.rules) && s.rules.length)) {
    out.steps = p.steps.slice(0, game.moves.length).map((s) => (Array.isArray(s?.rules) ? { rules: s.rules.slice(0, 10) } : {}));
  }
  return out;
}

/** Side to move in a FEN ('w' / 'b'). */
export const sideToMove = (fen: string): 'w' | 'b' => (fen.split(' ')[1] === 'b' ? 'b' : 'w');

/** Short label for a game share: "Partida (12 jugadas)" / "Posición". */
export function gameLabel(g: ChatGame): string {
  if (!g.moves.length) return 'Posición';
  const n = Math.ceil(g.moves.length / 2);
  return `Partida (${n} ${n === 1 ? 'jugada' : 'jugadas'})`;
}

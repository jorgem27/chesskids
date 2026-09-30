// Play-against-the-bot: content model, validation and pure helpers (server-safe, no UI/worker imports).
import { Chess } from 'chess.js';
import { applyUci } from '../puzzle/logic';

export type BotLevel = 'easy' | 'normal' | 'strong';

/** One page of the "notebook": some text plus the moves (both colours, UCI) shown on the board. */
export interface ExplainStep {
  text: string;
  moves?: string[]; // played on the demo board, on top of the previous steps' moves
}

export interface BotPosition {
  fen: string; // the STUDENT plays the side to move
  title?: string; // e.g. "Rey y torre contra rey"
  prompt?: string; // mascot text at the start
  level: BotLevel;
  maxMoves: number; // student moves allowed before the game is lost
  parMoves: number; // student moves for 3⭐ (≈1.5× for 2⭐)
  explain?: boolean; // show the notebook before playing
  steps?: ExplainStep[];
}

export interface BotContent { positions: BotPosition[] }

export const LEVELS: Record<BotLevel, { label: string; emoji: string; skill: number; depth: number; movetime: number }> = {
  easy: { label: 'Fácil', emoji: '🐣', skill: 2, depth: 2, movetime: 80 },
  normal: { label: 'Normal', emoji: '🦊', skill: 10, depth: 8, movetime: 150 },
  strong: { label: 'Difícil', emoji: '🐲', skill: 20, depth: 14, movetime: 250 },
};

export const START_FEN = '4k3/8/8/8/8/8/8/4K2R w - - 0 1';

export function newPosition(fen = START_FEN): BotPosition {
  return { fen, level: 'strong', maxMoves: 30, parMoves: 20, explain: false, steps: [] };
}

export const hasExplanation = (p: BotPosition) => !!p.explain && !!p.steps?.length;

/** Position shown on the notebook board after steps 0..k (k = -1 → the starting position). */
export function positionAtStep(p: BotPosition, k: number): { chess: Chess; last?: string } {
  const chess = new Chess(p.fen);
  let last: string | undefined;
  for (let i = 0; i <= k; i++) {
    for (const m of p.steps?.[i]?.moves ?? []) {
      if (!applyUci(chess, m)) return { chess, last };
      last = m;
    }
  }
  return { chess, last };
}

export function starsForMoves(moves: number, par: number): number {
  if (moves <= par) return 3;
  return moves <= Math.ceil(par * 1.5) ? 2 : 1;
}

export type Outcome = 'win' | 'lose' | 'draw' | null;

/** The game from the student's point of view: did they mate, get mated, or draw (stalemate…)? */
export function outcome(chess: Chess, student: 'w' | 'b'): Outcome {
  if (chess.isCheckmate()) return chess.turn() === student ? 'lose' : 'win';
  if (chess.isDraw()) return 'draw';
  return null;
}

export function validateBotSet(c: BotContent): string[] {
  const errs: string[] = [];
  if (!c?.positions?.length) return ['Añade al menos una posición'];
  c.positions.forEach((p, i) => {
    const n = `Posición ${i + 1}`;
    let chess: Chess;
    try {
      chess = new Chess(p.fen);
    } catch {
      errs.push(`${n}: la posición no es válida (¿falta un rey?)`);
      return;
    }
    if (chess.isGameOver()) errs.push(`${n}: la partida ya ha terminado`);
    if (!LEVELS[p.level]) errs.push(`${n}: elige el nivel del bot`);
    if (!(p.maxMoves >= 1)) errs.push(`${n}: pon un máximo de jugadas`);
    if (!(p.parMoves >= 1) || p.parMoves > p.maxMoves) errs.push(`${n}: las jugadas para 3⭐ deben ser entre 1 y el máximo`);
    if (p.explain && !p.steps?.length) errs.push(`${n}: activaste la explicación pero no tiene pasos`);
    const demo = new Chess(p.fen);
    (p.steps ?? []).forEach((s, k) => {
      if (!s.text?.trim()) errs.push(`${n}, paso ${k + 1}: escribe el texto del paso`);
      for (const m of s.moves ?? []) if (!applyUci(demo, m)) { errs.push(`${n}, paso ${k + 1}: jugada ilegal ${m}`); break; }
    });
  });
  return errs;
}

// ---- Fallback bot (only used if the Stockfish worker can't load) ----
const VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function material(chess: Chess, me: 'w' | 'b'): number {
  let t = 0;
  for (const row of chess.board()) for (const sq of row) if (sq) t += (sq.color === me ? 1 : -1) * VAL[sq.type];
  return t;
}

/** Tiny 2-ply material search: takes free pieces, avoids losing its own, mates in one when it sees it. */
export function fallbackMove(fen: string): string | null {
  const chess = new Chess(fen);
  const me = chess.turn();
  let best: { uci: string; score: number } | null = null;
  for (const m of chess.moves({ verbose: true })) {
    chess.move(m);
    let score: number;
    if (chess.isCheckmate()) score = 1000;
    else if (chess.isDraw()) score = -50;
    else {
      score = 1000;
      for (const r of chess.moves({ verbose: true })) {
        chess.move(r);
        score = Math.min(score, chess.isCheckmate() ? -1000 : material(chess, me));
        chess.undo();
      }
    }
    chess.undo();
    score += Math.random() * 0.5;
    if (!best || score > best.score) best = { uci: m.from + m.to + (m.promotion ?? ''), score };
  }
  return best?.uci ?? null;
}

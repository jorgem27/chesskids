// Compiles a PGN (with [%ask] tags) into a list of lesson steps using chess.js.
import { Chess } from 'chess.js';
import { sameMove, type MoveRule } from '../rules';
import { parseComment, parsePgn, type PgnMove, type Shape } from './parser';

/** Coach edits for one question, stored next to the PGN and keyed by the position before the answer. */
export interface QuestionCfg {
  question?: string;
  hint?: string;
  pts?: number; // points of the main answer
  rules?: MoveRule[]; // when present, REPLACES the alternatives written in the PGN
}

export type QuestionOverrides = Record<string, QuestionCfg>;

export interface Answer {
  uci: string;
  san: string;
  pts: number; // points for playing it (main answer defaults to 100)
  text: string; // feedback / explanation
  isMain: boolean;
}

export interface WrongKnown { uci: string; san: string; text: string }

export type Step =
  | { kind: 'auto'; fenBefore: string; uci: string; san: string; text: string; shapes: Shape[]; wait: boolean }
  | {
      kind: 'ask';
      fenBefore: string;
      question: string;
      questionShapes: Shape[];
      answers: Answer[];
      wrong: WrongKnown[];
      almost: WrongKnown[]; // "not the best": back to the same position, no mistake
      hint: string;
      main: Answer;
      afterText: string; // comment of the main move (shown after answering)
      afterShapes: Shape[];
      afterWait: boolean;
    }
  /** Move the board to another line: into a variation (depth > 0) or back. `path` is shown one frame at a time. */
  | { kind: 'jump'; depth: number; text: string; path: JumpFrame[] };

export interface JumpFrame { fen: string; lastMove?: string }

export interface Lesson {
  title: string;
  startFen: string;
  intro: string;
  introShapes: Shape[];
  steps: Step[];
  maxScore: number;
  orientation: 'white' | 'black';
}

function toUci(m: { from: string; to: string; promotion?: string }): string {
  return m.from + m.to + (m.promotion ?? '');
}

function tryMove(chess: Chess, san: string | { from: string; to: string; promotion?: string }) {
  try {
    return chess.move(san);
  } catch {
    return null;
  }
}

/** A variation that contains a question is played as a side line ("¿Y si…?") instead of being ignored. */
export function hasAsk(line: PgnMove[]): boolean {
  // An [%ask] on the last move has no answer to ask for, so it doesn't count.
  return line.some((m, i) => (i < line.length - 1 && parseComment(m.comment).ask !== undefined) || m.variations.some(hasAsk));
}

/** "2...d6" / "3.d4" for the move `san` played from `fen`. */
function moveLabel(fen: string, san: string): string {
  const [, turn, , , , full] = fen.split(' ');
  return `${full}${turn === 'w' ? '.' : '...'}${san}`;
}

interface PendingAsk { question: string; shapes: Shape[]; hint: string }

/**
 * Compiles one line (the game or a variation) from `startFen`, appending its steps to `out`.
 * Variations on a question move are answer alternatives (good / almost / wrong). Any variation with a question
 * further on is also a side line, spliced in right after the move: jump back, play the variation, rewind it,
 * replay the game move. So an alternative or a typical mistake can be explored with its own questions.
 */
function compileLine(
  moves: PgnMove[], startFen: string, depth: number, firstAsk: PendingAsk | null,
  overrides: QuestionOverrides | undefined, out: Step[], acc: { maxScore: number; firstAskFen?: string },
): void {
  const chess = new Chess(startFen);
  let pendingAsk = firstAsk;

  moves.forEach((mv: PgnMove, idx) => {
    const fenBefore = chess.fen();
    const info = parseComment(mv.comment);
    const played = tryMove(chess, mv.san);
    if (!played) {
      throw new Error(depth ? `Jugada ilegal en una variante: ${mv.san}` : `Jugada ilegal en la línea principal (${idx + 1}): ${mv.san}`);
    }

    if (pendingAsk) {
      const alternatives = mv.variations.map((v) => v[0]).filter(Boolean);
      const cfg = overrides?.[fenBefore];
      const main: Answer = { uci: toUci(played), san: played.san, pts: cfg?.pts ?? info.pts ?? 100, text: info.text, isMain: true };
      const answers: Answer[] = [main];
      const wrong: WrongKnown[] = [];
      const almost: WrongKnown[] = [];
      const add = (uci: string, san: string, kind: 'good' | 'almost' | 'wrong', pts: number | undefined, text: string) => {
        if (sameMove(uci, main.uci)) return;
        if (kind === 'good') answers.push({ uci, san, pts: pts ?? main.pts, text, isMain: false });
        else if (kind === 'almost') almost.push({ uci, san, text });
        else wrong.push({ uci, san, text });
      };
      if (cfg?.rules) {
        for (const r of cfg.rules) {
          const am = tryMove(new Chess(fenBefore), { from: r.uci.slice(0, 2), to: r.uci.slice(2, 4), promotion: r.uci[4] });
          if (am) add(toUci(am), am.san, r.kind, r.pts, r.text ?? '');
        }
      } else {
        for (const alt of alternatives) {
          const c = new Chess(fenBefore);
          const am = tryMove(c, alt.san);
          if (!am) throw new Error(`Jugada ilegal en una variante: ${alt.san}`);
          const ai = parseComment(alt.comment);
          add(toUci(am), am.san, ai.retry ? 'almost' : (ai.pts ?? 0) > 0 ? 'good' : 'wrong', ai.pts, ai.text);
        }
      }
      acc.maxScore += main.pts;
      if (!depth) acc.firstAskFen ??= fenBefore;
      out.push({
        kind: 'ask', fenBefore, question: cfg?.question?.trim() || pendingAsk.question, questionShapes: pendingAsk.shapes,
        answers, wrong, almost, hint: cfg?.hint?.trim() ?? pendingAsk.hint, main, afterText: info.text, afterShapes: info.shapes, afterWait: info.wait,
      });
    } else {
      out.push({ kind: 'auto', fenBefore, uci: toUci(played), san: played.san, text: info.text, shapes: info.shapes, wait: info.wait });
    }
    const sideLines = mv.variations.filter((v) => v.length && hasAsk(v));
    pendingAsk = info.ask ? { question: info.ask, shapes: info.shapes, hint: info.hint ?? '' } : null;

    const fenAfter = chess.fen();
    for (const line of sideLines) {
      const c = new Chess(fenBefore);
      const first = tryMove(c, line[0].san);
      if (!first) throw new Error(`Jugada ilegal en una variante: ${line[0].san}`);
      // Positions the side line goes through, to rewind them one by one at the end.
      const fens = [c.fen()];
      for (const m of line.slice(1)) { if (!tryMove(c, m.san)) break; fens.push(c.fen()); }
      const who = fenBefore.split(' ')[1] === 'w' ? 'las blancas' : 'las negras';
      out.push({ kind: 'jump', depth: depth + 1, text: `🔀 ¿Y si ${who} hubieran jugado ${moveLabel(fenBefore, first.san)}?`, path: [{ fen: fenBefore }] });
      compileLine(line, fenBefore, depth + 1, null, overrides, out, acc);
      out.push({
        kind: 'jump',
        depth,
        text: depth ? '🔙 Volvemos a la variante de antes' : '🔙 Volvemos a la partida',
        path: [...fens.slice(0, -1).reverse().map((fen) => ({ fen })), { fen: fenBefore }, { fen: fenAfter, lastMove: toUci(played) }],
      });
    }
  });
}

export function compileLesson(pgn: string, overrides?: QuestionOverrides): Lesson {
  const game = parsePgn(pgn);
  const startFen =
    game.headers.FEN ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const intro = parseComment(game.startComment);
  const steps: Step[] = [];
  const acc: { maxScore: number; firstAskFen?: string } = { maxScore: 0 };
  const introAsk = intro.ask ? { question: intro.ask, shapes: intro.shapes, hint: intro.hint ?? '' } : null;
  compileLine(game.moves, startFen, 0, introAsk, overrides, steps, acc);
  const maxScore = acc.maxScore;

  // The student's side comes from the first question of the game itself, not from one inside a variation.
  const anyAsk = steps.find((s) => s.kind === 'ask') as Extract<Step, { kind: 'ask' }> | undefined;
  const askColor = new Chess(acc.firstAskFen ?? anyAsk?.fenBefore ?? startFen).turn();
  const orientation = (game.headers.Orientation?.toLowerCase() === 'black' || (!game.headers.Orientation && askColor === 'b'))
    ? 'black' : 'white';

  return {
    title: game.headers.Event && game.headers.Event !== '?' ? game.headers.Event : 'Lección',
    startFen,
    intro: intro.text,
    introShapes: intro.shapes,
    steps,
    maxScore,
    orientation,
  };
}

export function validateLessonPgn(pgn: string, overrides?: QuestionOverrides): string[] {
  if (!pgn?.trim()) return ['Pega un PGN'];
  try {
    const l = compileLesson(pgn, overrides);
    if (!l.steps.length) return ['El PGN no tiene jugadas'];
    if (!l.steps.some((s) => s.kind === 'ask')) return ['Añade al menos una pregunta con {[%ask ¿...?]}'];
    return [];
  } catch (e) {
    return [(e as Error).message];
  }
}

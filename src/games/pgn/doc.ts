// Editable model of a lesson PGN for the visual editor (pure, no Preact).
// The lesson is still stored as PGN: the editor parses it with parsePgn, edits comments/variations
// through these helpers and writes it back with serializePgn.
import { Chess } from 'chess.js';
import type { QuestionOverrides } from './lesson';
import { parseComment, parsePgn, type CommentInfo, type PgnGame, type PgnMove, type Shape } from './parser';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export type AltKind = 'good' | 'almost' | 'wrong';

const BRUSH_LETTER: Record<string, string> = { green: 'G', red: 'R', yellow: 'Y', blue: 'B' };

/** Text typed by the coach can't break the PGN comment or a [%tag]. */
const clean = (s: string) => s.replace(/[{}\[\]]/g, '').replace(/\s+/g, ' ').trim();

/** Inverse of parseComment. */
export function buildComment(info: CommentInfo): string {
  const parts: string[] = [];
  if (info.text.trim()) parts.push(clean(info.text));
  if (info.ask !== undefined) parts.push(`[%ask ${clean(info.ask) || '¿Cuál es la mejor jugada?'}]`);
  if (info.hint?.trim()) parts.push(`[%hint ${clean(info.hint)}]`);
  if (info.pts !== undefined) parts.push(`[%pts ${Math.round(info.pts)}]`);
  if (info.retry) parts.push('[%retry]');
  if (info.wait) parts.push('[%wait]');
  const brush = (s: Shape) => BRUSH_LETTER[s.brush] ?? 'G';
  const arrows = info.shapes.filter((s) => s.dest && s.dest !== s.orig).map((s) => brush(s) + s.orig + s.dest);
  const circles = info.shapes.filter((s) => !s.dest || s.dest === s.orig).map((s) => brush(s) + s.orig);
  if (arrows.length) parts.push(`[%cal ${arrows.join(',')}]`);
  if (circles.length) parts.push(`[%csl ${circles.join(',')}]`);
  return parts.join(' ');
}

export function startFenOf(game: PgnGame): string {
  return game.headers.FEN ?? START_FEN;
}

/** FEN after the first `ply` moves of the main line (throws on an illegal move). */
export function fenAt(game: PgnGame, ply: number): string {
  const c = new Chess(startFenOf(game));
  for (const m of game.moves.slice(0, ply)) c.move(m.san);
  return c.fen();
}

/** Comment that belongs to the position after `ply` moves (the start comment for ply 0). */
export function noteAt(game: PgnGame, ply: number): CommentInfo {
  return parseComment(ply === 0 ? game.startComment : game.moves[ply - 1]?.comment ?? '');
}

const cloneMove = (m: PgnMove): PgnMove => ({ ...m, nags: [...m.nags], variations: m.variations.map((v) => v.map(cloneMove)) });
export const cloneGame = (g: PgnGame): PgnGame => ({ headers: { ...g.headers }, startComment: g.startComment, moves: g.moves.map(cloneMove) });

export function setNoteAt(game: PgnGame, ply: number, patch: Partial<CommentInfo>): PgnGame {
  const g = cloneGame(game);
  const comment = buildComment({ ...noteAt(g, ply), ...patch });
  if (ply === 0) g.startComment = comment;
  else g.moves[ply - 1].comment = comment;
  return g;
}

/** Points of the main answer at `ply` (stored as [%pts] on the move itself). */
export function mainPts(game: PgnGame, ply: number): number {
  return parseComment(game.moves[ply]?.comment ?? '').pts ?? 100;
}

export function setMainPts(game: PgnGame, ply: number, pts: number | undefined): PgnGame {
  const g = cloneGame(game);
  const m = g.moves[ply];
  if (m) m.comment = buildComment({ ...parseComment(m.comment), pts });
  return g;
}

export interface Alt { index: number; san: string; kind: AltKind; pts?: number; text: string }

export function altKind(info: CommentInfo): AltKind {
  return info.retry ? 'almost' : (info.pts ?? 0) > 0 ? 'good' : 'wrong';
}

/** Alternatives to the move played from position `ply` (first move of each variation). */
export function altsAt(game: PgnGame, ply: number): Alt[] {
  return (game.moves[ply]?.variations ?? []).map((v, index) => {
    const info = parseComment(v[0]?.comment ?? '');
    return { index, san: v[0]?.san ?? '?', kind: altKind(info), pts: info.pts, text: info.text };
  });
}

function altComment(kind: AltKind, text: string, pts: number | undefined, keepShapes: Shape[] = []): string {
  return buildComment({
    text, wait: false, shapes: keepShapes,
    retry: kind === 'almost',
    pts: kind === 'good' ? Math.max(1, pts ?? 50) : undefined,
  });
}

export function addAlt(game: PgnGame, ply: number, san: string, kind: AltKind, pts?: number, text = ''): PgnGame {
  const g = cloneGame(game);
  const m = g.moves[ply];
  if (!m) return g;
  // Compare by from/to so "Bxc6" from a pasted PGN matches "Bxc6+" from the board.
  let fen: string;
  try { fen = fenAt(g, ply); } catch { return g; }
  const key = (s: string) => { try { const x = new Chess(fen).move(s); return x.from + x.to; } catch { return s; } };
  if (key(m.san) === key(san)) return g; // the main answer is not an alternative
  const at = m.variations.findIndex((v) => v[0] && key(v[0].san) === key(san));
  const move: PgnMove = { san, comment: altComment(kind, text, pts), nags: [], variations: [] };
  if (at >= 0) m.variations[at] = [move, ...m.variations[at].slice(1)];
  else m.variations.push([move]);
  return g;
}

export function updateAlt(game: PgnGame, ply: number, index: number, patch: Partial<Pick<Alt, 'kind' | 'pts' | 'text'>>): PgnGame {
  const g = cloneGame(game);
  const first = g.moves[ply]?.variations[index]?.[0];
  if (!first) return g;
  const info = parseComment(first.comment);
  const cur = { kind: altKind(info), pts: info.pts, text: info.text, ...patch };
  first.comment = altComment(cur.kind, cur.text, cur.pts, info.shapes);
  return g;
}

export function removeAlt(game: PgnGame, ply: number, index: number): PgnGame {
  const g = cloneGame(game);
  g.moves[ply]?.variations.splice(index, 1);
  return g;
}

/** Plays `san` from position `ply`, dropping the rest of the main line. */
export function replaceFrom(game: PgnGame, ply: number, san: string): PgnGame {
  const g = cloneGame(game);
  g.moves = [...g.moves.slice(0, ply), { san, comment: '', nags: [], variations: [] }];
  return g;
}

export function truncateAt(game: PgnGame, ply: number): PgnGame {
  const g = cloneGame(game);
  g.moves = g.moves.slice(0, ply);
  return g;
}

// ---------- Serializer ----------

/** Pasted comments (e.g. from `;` line comments) may contain braces that would end the comment early. */
const safe = (c: string) => c.replace(/[{}]/g, '').trim();

function lineToPgn(moves: PgnMove[], fen: string): string {
  const c = new Chess(fen);
  const out: string[] = [];
  let needNumber = true;
  for (const m of moves) {
    const before = c.fen();
    const [, turn, , , , full] = before.split(' ');
    if (turn === 'w') out.push(`${full}.`);
    else if (needNumber) out.push(`${full}...`);
    let played;
    try { played = c.move(m.san); } catch { played = null; }
    out.push(played?.san ?? m.san);
    needNumber = false;
    if (m.nags.length) out.push(...m.nags.map((n) => `$${n}`));
    if (m.comment.trim()) { out.push(`{ ${safe(m.comment)} }`); needNumber = true; }
    for (const v of m.variations) {
      if (v.length) { out.push(`( ${lineToPgn(v, before)} )`); needNumber = true; }
    }
    if (!played) break; // an illegal move ends the line: nothing after it can be replayed
  }
  return out.join(' ');
}

export function serializePgn(game: PgnGame): string {
  const headers: Record<string, string> = { Event: 'Lección', ...game.headers };
  if (headers.FEN) headers.SetUp = '1';
  const head = Object.entries(headers).map(([k, v]) => `[${k} "${String(v).replace(/"/g, "'")}"]`).join('\n');
  const intro = game.startComment.trim() ? `{ ${safe(game.startComment)} } ` : '';
  return `${head}\n\n${intro}${lineToPgn(game.moves, startFenOf(game))} *`.replace(/ +/g, ' ');
}

/** Builds a lesson PGN from what the coach pasted: a PGN, a FEN, or both (the FEN is the start position). */
export function importPgn(pgnText: string, fenText: string): { game?: PgnGame; error?: string } {
  const fen = fenText.trim();
  if (fen) {
    try { new Chess(fen); } catch { return { error: 'La posición (FEN) no es válida' }; }
  }
  const game = parsePgn(pgnText ?? '');
  if (fen) game.headers.FEN = fen;
  if (game.headers.FEN === START_FEN) { delete game.headers.FEN; delete game.headers.SetUp; }
  let c: Chess;
  try { c = new Chess(startFenOf(game)); } catch { return { error: 'La posición (FEN) del PGN no es válida' }; }
  for (let i = 0; i < game.moves.length; i++) {
    try { c.move(game.moves[i].san); } catch {
      return { error: `Jugada ilegal en la partida (${i + 1}): ${game.moves[i].san}` };
    }
  }
  return { game };
}

/** Old lessons kept per-question edits in `questions` (keyed by FEN): fold them into the PGN. */
export function foldOverrides(game: PgnGame, overrides: QuestionOverrides | undefined): PgnGame {
  if (!overrides || !Object.keys(overrides).length) return game;
  let g = cloneGame(game);
  const c = new Chess(startFenOf(g));
  const fens: string[] = [c.fen()];
  for (const m of g.moves) { c.move(m.san); fens.push(c.fen()); }
  fens.forEach((fen, ply) => {
    const cfg = overrides[fen];
    if (!cfg || ply >= g.moves.length || noteAt(g, ply).ask === undefined) return;
    const patch: Partial<CommentInfo> = {};
    if (cfg.question?.trim()) patch.ask = cfg.question.trim();
    if (cfg.hint !== undefined) patch.hint = cfg.hint.trim() || undefined;
    g = setNoteAt(g, ply, patch);
    if (cfg.pts !== undefined) g = setMainPts(g, ply, cfg.pts);
    if (cfg.rules) {
      g.moves[ply].variations = [];
      for (const r of cfg.rules) {
        try {
          const mv = new Chess(fen).move({ from: r.uci.slice(0, 2), to: r.uci.slice(2, 4), promotion: r.uci[4] });
          g = addAlt(g, ply, mv.san, r.kind, r.pts ?? mainPts(g, ply), r.text ?? '');
        } catch { /* illegal rule: drop it */ }
      }
    }
  });
  return g;
}

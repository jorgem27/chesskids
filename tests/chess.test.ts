import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileLesson } from '../src/games/pgn/lesson';
import { GAME_META } from '../src/games/meta';
import { validatePuzzleSet, isCorrectMove, fromLichess } from '../src/games/puzzle/logic';
import { Chess } from 'chess.js';

test('sample lesson compiles with 2 questions', () => {
  const l = compileLesson(GAME_META['pgn-lesson'].defaultContent().pgn);
  const asks = l.steps.filter((s) => s.kind === 'ask');
  assert.equal(asks.length, 2);
  assert.equal(l.orientation, 'black');
  const a = asks[0];
  if (a.kind !== 'ask') throw 0;
  assert.equal(a.main.uci, 'g7g6');
  assert.equal(a.answers.length, 2);
  assert.equal(a.answers[1].pts, 60);
  assert.equal(a.wrong[0].uci, 'g8f6');
  assert.equal(l.maxScore, 200);
});

test('puzzle validation and mate acceptance', () => {
  // Back-rank mate: white Ra1, black king g8 with pawns f7 g7 h7
  const fen = '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1';
  assert.deepEqual(validatePuzzleSet({ puzzles: [{ fen, moves: ['a1a8'] }] }), []);
  assert.ok(validatePuzzleSet({ puzzles: [{ fen, moves: ['a1a9'] }] }).length > 0);
  assert.equal(isCorrectMove(fen, 'a1a8', 'a1a8'), true);
  assert.equal(isCorrectMove(fen, 'a1a7', 'a1a8'), false);
});

test('Lichess CSV rows convert to valid student-to-move puzzles', () => {
  // Real rows from lichess_db_puzzle.csv: FEN is before the opponent's move, Moves starts with it.
  const rows = [
    ['r6k/pp2r2p/4Rp1Q/3p4/8/1N1P2R1/PqP2bPP/7K b - - 0 24', 'f2g3 e6e7 b2b1 b3c1 b1c1 h6c1', 'w'],
    ['5rk1/1p3ppp/pq3b2/8/8/1P1Q1N2/P4PPP/3R2K1 w - - 2 27', 'd3d6 f8d8 d6d8 f6d8', 'b'],
  ] as const;
  for (const [fen, moves, toMove] of rows) {
    const p = fromLichess(fen, moves.split(' '));
    assert.ok(p);
    assert.equal(new Chess(p.fen).turn(), toMove);
    assert.deepEqual(p.moves, moves.split(' ').slice(1));
    assert.deepEqual(validatePuzzleSet({ puzzles: [p] }), []);
  }
  assert.equal(fromLichess('8/8/8/8/8/8/8/8 w - - 0 1', ['a1a2', 'a2a3']), null);
  assert.equal(fromLichess(rows[0][0], ['a1a8', 'e6e7']), null);
  assert.equal(fromLichess(rows[0][0], ['f2g3']), null);
  // Illegal move later in the line, and an odd-length line.
  assert.equal(fromLichess(rows[0][0], ['f2g3', 'e6e7', 'a1a1', 'b3c1']), null);
  assert.equal(fromLichess(rows[0][0], ['f2g3', 'e6e7', 'b2b1']), null);
  // Promotion in the solution (lowercase UCI suffix).
  const promo = fromLichess('8/4P1k1/8/8/8/8/6K1/8 b - - 0 1', ['g7g6', 'e7e8q']);
  assert.ok(promo);
  assert.deepEqual(promo.moves, ['e7e8q']);
  assert.equal(isCorrectMove(promo.fen, 'e7e8q', 'e7e8q'), true);
});

test('demo seed puzzles and fruit levels are valid', async () => {
  const { readFileSync } = await import('node:fs');
  const sql = readFileSync(new URL('../seed/demo.sql', import.meta.url), 'utf8');
  const rows = [...sql.matchAll(/INSERT INTO activities .*? VALUES \(\d+, 1, 1, '([^']+)', '[^']*', '[^']*', '((?:[^']|'')*)', \d+\);/g)];
  assert.equal(rows.length, 4);
  for (const [, type, json] of rows) {
    const content = JSON.parse(json.replace(/''/g, "'"));
    assert.deepEqual(GAME_META[type].validate(content), [], type);
  }
});

test('puzzle: alternatives, "not the best" and per-move points', async () => {
  const { judgeMove, earnedPts, puzzleMaxScore } = await import('../src/games/puzzle/logic');
  const fen = '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1';
  const p = { fen, moves: ['a1a8'], steps: [{ pts: 10, rules: [
    { uci: 'a1a2', kind: 'good' as const, pts: 5 },
    { uci: 'g1f1', kind: 'almost' as const },
    { uci: 'g1h1', kind: 'wrong' as const, text: 'no' },
  ] }] };
  assert.equal(judgeMove(p, 0, fen, 'a1a8').kind, 'best');
  assert.equal(judgeMove(p, 0, fen, 'a1a2').kind, 'good');
  assert.equal(judgeMove(p, 0, fen, 'g1f1').kind, 'almost');
  const w = judgeMove(p, 0, fen, 'g1h1');
  assert.equal(w.kind, 'wrong');
  assert.equal(judgeMove(p, 0, fen, 'g1g2').kind, 'wrong');
  assert.equal(puzzleMaxScore(p, 'hint'), 10);
  assert.equal(puzzleMaxScore({ fen, moves: ['a1a8'] }, 'hint'), 3);
  assert.deepEqual([0, 1, 2].map((m) => earnedPts(3, m, 'hint')), [3, 2, 1]);
  assert.equal(earnedPts(3, 2, 'blitz'), 3);
  assert.deepEqual(validatePuzzleSet({ puzzles: [p] }), []);
  assert.ok(validatePuzzleSet({ puzzles: [{ ...p, steps: [{ rules: [{ uci: 'a1a9', kind: 'good' }] }] }] }).length > 0);
});

test('lesson: [%retry], [%hint] and coach overrides', () => {
  const pgn = `[FEN "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"]\n1. e4 {[%ask ¿Apertura? ] [%hint Centro]} e5 (1... c5 {[%retry] casi}) (1... a6 {mal}) *`;
  const l = compileLesson(pgn);
  // ask is attached to the move BEFORE the answer: no ask on move 1 → uses the comment on 1. e4
  const a = l.steps.find((s) => s.kind === 'ask');
  assert.ok(a && a.kind === 'ask');
  assert.equal(a.hint, 'Centro');
  assert.equal(a.almost[0].uci, 'c7c5');
  assert.equal(a.wrong[0].uci, 'a7a6');
  const o = compileLesson(pgn, { [a.fenBefore]: { pts: 40, hint: 'Otra', rules: [{ uci: 'd7d5', kind: 'good', pts: 20 }] } });
  const b = o.steps.find((s) => s.kind === 'ask');
  if (!b || b.kind !== 'ask') throw 0;
  assert.equal(b.main.pts, 40);
  assert.equal(b.hint, 'Otra');
  assert.equal(b.answers[1].uci, 'd7d5');
  assert.equal(b.almost.length, 0);
  assert.equal(o.maxScore, 40);
});

test('play-bot: validation, outcomes, stars and fallback bot', async () => {
  const { Chess } = await import('chess.js');
  const { validateBotSet, newPosition, outcome, starsForMoves, fallbackMove, positionAtStep } = await import('../src/games/bot/logic');
  const def = GAME_META['play-bot'].defaultContent();
  assert.deepEqual(validateBotSet(def), []);
  assert.ok(validateBotSet({ positions: [] }).length > 0);
  assert.ok(validateBotSet({ positions: [{ ...newPosition(), fen: 'nope' }] }).length > 0);
  assert.ok(validateBotSet({ positions: [{ ...newPosition(), explain: true, steps: [] }] }).length > 0);
  assert.ok(validateBotSet({ positions: [{ ...newPosition(), steps: [{ text: 'x', moves: ['e1e5'] }] }] }).length > 0);
  assert.deepEqual([10, 20, 25, 40].map((m) => starsForMoves(m, 20)), [3, 3, 2, 1]);
  // Ra8# : student (white) mates; stalemate is a draw, not a win
  assert.equal(outcome(new Chess('R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1'), 'w'), 'win');
  assert.equal(outcome(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'), 'w'), 'draw');
  // Fallback bot delivers mate in one and returns a legal move
  const mv = fallbackMove('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
  assert.equal(mv, 'a1a8');
  const p = { ...newPosition(), steps: [{ text: 'a', moves: ['e1e2'] }, { text: 'b', moves: ['e8e7'] }] };
  assert.equal(positionAtStep(p, 1).chess.fen().split(' ')[0], '8/4k3/8/8/8/8/4K3/7R');
});

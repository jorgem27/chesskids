import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileLesson } from '../src/games/pgn/lesson';
import { GAME_META } from '../src/games/meta';
import { validatePuzzleSet, isCorrectMove } from '../src/games/puzzle/logic';

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

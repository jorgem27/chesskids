import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solve, pieceMoves, validateLevel } from '../src/games/fruit/logic';
import { parsePgn, parseComment } from '../src/games/pgn/parser';
import { computeXp, levelFromXp, nextStreak, xpForLevel, earnedStickers, kingdomIndex } from '../src/lib/rewards';

test('knight moves from corner', () => {
  assert.deepEqual(pieceMoves('N', 'a1', new Set()).sort(), ['b3', 'c2']);
});

test('rook blocked by rocks', () => {
  assert.deepEqual(pieceMoves('R', 'a1', new Set(['a2', 'c1'])).sort(), ['b1']);
});

test('fruit solver: rook needs 2 moves to reach a corner', () => {
  const s = solve({ piece: 'R', start: 'a1', fruits: ['h8'] });
  assert.equal(s.moves, 2);
  assert.equal(s.path.length, 3);
});

test('fruit solver: order matters', () => {
  const s = solve({ piece: 'K', start: 'a1', fruits: ['h1', 'b1', 'a2'] });
  // a1->a2(1)->b1(1)->h1(6) = 8 ; a1->b1->a2... also 1+1+7
  assert.equal(s.moves, 8);
  assert.equal(s.order.at(-1), 'h1');
});

test('knight to adjacent diagonal needs 2 moves, same square 0', () => {
  assert.equal(solve({ piece: 'N', start: 'd4', fruits: ['e5'] }).moves, 2);
  assert.equal(solve({ piece: 'N', start: 'd4', fruits: ['d4'] }).moves, 0);
});

test('bishop colour validation', () => {
  assert.ok(validateLevel({ piece: 'B', start: 'c1', fruits: ['c2'] }).length > 0);
  assert.equal(validateLevel({ piece: 'B', start: 'c1', fruits: ['h6'] }).length, 0);
});

test('pgn parser: headers, comments, variations, nags', () => {
  const g = parsePgn(`[Event "Test"]\n[FEN "8/8/8/8/8/8/8/8 w - - 0 1"]\n{intro [%ask Q?]} 1. e4! {c1} (1. d4 {alt [%pts 50]} d5) (1. c4?) e5 2. Nf3 $1 *`);
  assert.equal(g.headers.Event, 'Test');
  assert.equal(g.startComment, 'intro [%ask Q?]');
  assert.equal(g.moves.length, 3);
  assert.equal(g.moves[0].san, 'e4');
  assert.deepEqual(g.moves[0].nags, [1]);
  assert.equal(g.moves[0].variations.length, 2);
  assert.equal(g.moves[0].variations[0][0].san, 'd4');
  assert.equal(g.moves[0].variations[0][1].san, 'd5');
  assert.equal(g.moves[0].variations[1][0].san, 'c4');
  assert.equal(g.moves[2].san, 'Nf3');
});

test('comment tags', () => {
  const c = parseComment('Mira esto [%cal Ge2e4,Rd1d8] [%csl Yd4] [%ask ¿Qué juegas?] [%pts 40] [%wait] [%clk 0:01:00]');
  assert.equal(c.text, 'Mira esto');
  assert.equal(c.ask, '¿Qué juegas?');
  assert.equal(c.pts, 40);
  assert.equal(c.wait, true);
  assert.equal(c.shapes.length, 3);
  assert.deepEqual(c.shapes[0], { brush: 'green', orig: 'e2', dest: 'e4' });
});

test('levels and xp', () => {
  assert.equal(levelFromXp(0), 1);
  assert.equal(levelFromXp(49), 1);
  assert.equal(levelFromXp(50), 2);
  assert.equal(levelFromXp(xpForLevel(7)), 7);
  const x = computeXp({ baseXp: 30, score: 3, maxScore: 3, seconds: 125, firstTime: true, isHomework: true });
  assert.equal(x.starCount, 3);
  assert.equal(x.total, 30 + 15 + 2 + 10);
  const r = computeXp({ baseXp: 30, score: 0, maxScore: 3, seconds: 5, firstTime: false, isHomework: true });
  assert.equal(r.total, 2);
});

test('streaks', () => {
  assert.deepEqual(nextStreak(null, 0, '2026-09-28'), { streak: 1, extended: true });
  assert.deepEqual(nextStreak('2026-09-27', 4, '2026-09-28'), { streak: 5, extended: true });
  assert.deepEqual(nextStreak('2026-09-28', 5, '2026-09-28'), { streak: 5, extended: false });
  assert.deepEqual(nextStreak('2026-09-20', 5, '2026-09-28'), { streak: 1, extended: true });
  assert.deepEqual(nextStreak('2026-02-28', 2, '2026-03-01'), { streak: 3, extended: true });
});

test('stickers & kingdoms', () => {
  const base = { xp: 0, streak: 0, puzzlesSolved: 0, gamesCompleted: 0, totalSeconds: 0, threeStars: 0, lessonsDone: 0, fruitPerfect: 0, blitzDone: 0, homeworkDone: 0 };
  assert.deepEqual(earnedStickers(base), []);
  assert.ok(earnedStickers({ ...base, gamesCompleted: 1, puzzlesSolved: 12 }).includes('resuelve-10'));
  assert.equal(kingdomIndex(0), 0);
  assert.equal(kingdomIndex(400), 2);
  assert.equal(kingdomIndex(99999), 7);
});

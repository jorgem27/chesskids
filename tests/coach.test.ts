import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scheduleDates } from '../src/lib/dates';
import { cellState, failRate, puzzleAt, themeStats } from '../src/lib/insights';

test('schedule: all at once keeps the same dates', () => {
  assert.deepEqual(scheduleDates('2026-10-05', '2026-10-11', 2, 'all', 7), [
    { startsOn: '2026-10-05', dueOn: '2026-10-11' },
    { startsOn: '2026-10-05', dueOn: '2026-10-11' },
  ]);
});

test('schedule: one per day, each open N days', () => {
  assert.deepEqual(scheduleDates('2026-10-30', null, 3, 'daily', 3), [
    { startsOn: '2026-10-30', dueOn: '2026-11-01' },
    { startsOn: '2026-10-31', dueOn: '2026-11-02' },
    { startsOn: '2026-11-01', dueOn: '2026-11-03' },
  ]);
  assert.equal(scheduleDates('2026-10-05', null, 2, 'weekly', 7)[1].startsOn, '2026-10-12');
  assert.equal(scheduleDates('2026-10-05', null, 1, 'every2', 0)[0].dueOn, '2026-10-11'); // bad span -> 7 days
});

test('insights: cell states and first-try fail rate', () => {
  assert.equal(cellState(undefined), 'none');
  assert.equal(cellState({ firstOk: true, oks: 1, tries: 1 }), 'ok');
  assert.equal(cellState({ firstOk: false, oks: 1, tries: 2 }), 'fixed');
  assert.equal(cellState({ firstOk: false, oks: 0, tries: 3 }), 'fail');
  assert.equal(failRate([undefined, undefined]), null);
  assert.equal(failRate([{ firstOk: false, oks: 1, tries: 2 }, { firstOk: true, oks: 1, tries: 1 }, undefined]), 0.5);
});

test('insights: weak themes skip generic tags and need enough data', () => {
  const rows = [
    { themes: 'fork middlegame short', ok: false },
    { themes: 'fork short', ok: false },
    { themes: 'fork', ok: true },
    { themes: 'pin endgame', ok: true },
    { themes: 'pin', ok: true },
    { themes: 'pin', ok: false },
  ];
  const st = themeStats(rows, 3);
  assert.deepEqual(st.map((s) => s.key), ['fork', 'pin']);
  assert.equal(st[0].failed, 2);
  assert.ok(!themeStats(rows, 1).some((s) => s.key === 'short' || s.key === 'middlegame'));
});

test('insights: puzzleAt reads a puzzle item safely', () => {
  const json = JSON.stringify({ puzzles: [{ fen: '8/8/8/8/8/8/8/K6k w - - 0 1', moves: ['a1a2'] }] });
  assert.equal(puzzleAt(json, 0)?.moves[0], 'a1a2');
  assert.equal(puzzleAt(json, 3), null);
  assert.equal(puzzleAt('{bad', 0), null);
});

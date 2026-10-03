import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accuracy, dailySeries, fmtDuration, totals, trend } from '../src/lib/analytics';

test('analytics: daily series fills missing days with zeros, oldest first', () => {
  const s = dailySeries([{ day: '2026-10-02', xp: 20, secs: 300, solved: 4 }], '2026-10-03', 3);
  assert.deepEqual(s.map((d) => d.day), ['2026-10-01', '2026-10-02', '2026-10-03']);
  assert.deepEqual(s.map((d) => d.xp), [0, 20, 0]);
});

test('analytics: series crosses month boundaries and ignores rows outside the window', () => {
  const s = dailySeries([{ day: '2026-09-01', xp: 99, secs: 0, solved: 0 }, { day: '2026-09-30', xp: 5, secs: 0, solved: 1 }], '2026-10-01', 2);
  assert.deepEqual(s.map((d) => [d.day, d.xp]), [['2026-09-30', 5], ['2026-10-01', 0]]);
});

test('analytics: totals count active days', () => {
  const t = totals([{ day: 'a', xp: 10, secs: 60, solved: 2 }, { day: 'b', xp: 0, secs: 0, solved: 0 }, { day: 'c', xp: 0, secs: 30, solved: 1 }]);
  assert.deepEqual(t, { xp: 10, secs: 90, solved: 3, activeDays: 2 });
});

test('analytics: trend and accuracy need a baseline', () => {
  assert.equal(trend(15, 10), 50);
  assert.equal(trend(5, 10), -50);
  assert.equal(trend(5, 0), null);
  assert.equal(accuracy(3, 4), 75);
  assert.equal(accuracy(0, 0), null);
});

test('analytics: durations', () => {
  assert.equal(fmtDuration(59), '0 min');
  assert.equal(fmtDuration(3720), '1 h 2 min');
});

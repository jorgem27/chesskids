import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampBudget, creditedSeconds, distributeXp, fmtPoints, isAllowedBudget, kidPoints, validateTournament, type KidTally } from '../src/lib/projector';

const kid = (studentId: number, team: number, picks = 0, solved = 0, points = 0): KidTally => ({ studentId, team, picks, solved, points });

test('projector xp: best kid of winning team gets the full budget', () => {
  const kids = [kid(1, 0, 2, 2, 6), kid(2, 0), kid(3, 1, 1, 0, 0), kid(4, 1)];
  const r = distributeXp(10, [6, 0], kids);
  assert.deepEqual(r.map((x) => x.total), [10, 7, 3, 3]);
  // 3+4+3 ; 3+4+0 ; 3+0+3/8 ; 3
});

test('projector xp: losing team scores proportionally', () => {
  const r = distributeXp(20, [9, 3], [kid(1, 0), kid(2, 1)]);
  // no dice: each lone kid gets all their team's points. 6+8+6 = 20 ; 6 + 8/3 + 6/3 = 10.67
  assert.deepEqual(r.map((x) => x.total), [20, 11]);
});

test('projector xp: nobody scored -> everyone gets the whole budget for playing', () => {
  const r = distributeXp(10, [0, 0, 0], [kid(1, 0), kid(2, 1), kid(3, 2)]);
  assert.ok(r.every((x) => x.total === 10));
});

test('projector xp: dice pick counts even without solving', () => {
  const [a, b] = distributeXp(30, [3, 3], [kid(1, 0, 1, 0, 0), kid(2, 1)]);
  assert.ok(a.total > b.total);
});

test('projector xp: zero budget gives nothing, tiny budget gives at least 1, never above budget', () => {
  assert.ok(distributeXp(0, [3, 0], [kid(1, 0, 1, 1, 3)]).every((x) => x.total === 0));
  assert.ok(distributeXp(1, [3, 0], [kid(1, 0, 1, 1, 3), kid(2, 1)]).every((x) => x.total === 1));
  for (const b of [5, 10, 20, 30, 50]) {
    const r = distributeXp(b, [12, 7, 1], [kid(1, 0, 4, 4, 12), kid(2, 1, 3, 3, 7), kid(3, 2, 1, 1, 1), kid(4, 2)]);
    assert.ok(r.every((x) => x.total >= 1 && x.total <= b));
  }
});

test('projector xp: budget is clamped', () => {
  assert.equal(clampBudget(500), 50);
  assert.equal(clampBudget(-3), 0);
  assert.equal(clampBudget('abc'), 0);
});

test('projector validation', () => {
  const ok = { teams: [{ score: 4 }, { score: 3 }], kids: [kid(1, 0, 2, 2, 4), kid(2, 1, 1, 1, 3)], puzzlesPlayed: 3 };
  assert.equal(validateTournament(ok), null);
  assert.ok(validateTournament({ ...ok, teams: [1, 2, 3, 4, 5].map(() => ({ score: 0 })) }), 'too many teams');
  assert.ok(validateTournament({ ...ok, teams: [] }), 'no teams');
  assert.ok(validateTournament({ ...ok, teams: [{ score: 9 }, { score: 3 }] }), 'more points than puzzles');
  assert.ok(validateTournament({ ...ok, kids: [kid(1, 0, 2, 2, 4), kid(1, 1)] }), 'duplicate kid');
  assert.ok(validateTournament({ ...ok, kids: [kid(1, 0, 1, 2, 4)] }), 'solved > picks');
  assert.ok(validateTournament({ ...ok, kids: [kid(1, 0, 2, 2, 4), kid(2, 0, 1, 1, 1)] }), 'kid points exceed team');
  assert.ok(validateTournament({ ...ok, kids: [kid(1, 5)] }), 'bad team index');
});

test('projector: only UI budgets are accepted, time is capped per puzzle', () => {
  assert.ok(isAllowedBudget(10) && isAllowedBudget(0));
  assert.ok(!isAllowedBudget(100) && !isAllowedBudget(7) && !isAllowedBudget('x'));
  assert.equal(creditedSeconds(10_000, 2), 600);
  assert.equal(creditedSeconds(900, 10), 900);
  assert.equal(creditedSeconds(99_999, 100), 7200);
  assert.equal(creditedSeconds(-5, 3), 0);
});

test('projector: team points nobody won with the dice are shared by the team', () => {
  // Unicornios 10 pts (Sofía won 3 with the dice), Dragones 6 (only Jorge), Cohetes 6 (Gabriel + Kevin), no dice.
  const kids = [kid(1, 0, 2, 1, 3), kid(2, 1), kid(3, 2), kid(4, 2)];
  const pts = kidPoints([10, 6, 6], kids);
  assert.deepEqual([...pts.values()], [10, 6, 3, 3]);
  assert.deepEqual(distributeXp(10, [10, 6, 6], kids).map((x) => x.total), [10, 7, 6, 6]);
  // Dice points stay with their owner, the rest is split: team of 3 scored 7, Ana won 3 -> Ana 3+4/3, others 4/3.
  const p2 = kidPoints([7], [kid(5, 0, 1, 1, 3), kid(6, 0), kid(7, 0)]);
  assert.equal(fmtPoints(p2.get(5)!), '4,3');
  assert.equal(fmtPoints(p2.get(6)!), '1,3');
  assert.equal(fmtPoints(6), '6');
});

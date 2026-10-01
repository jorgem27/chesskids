import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fail, isExhausted, isRebound, newRound, pickSpeaker, rollDice, roundPoints } from '../src/lib/lessonRound';
import { POINTS } from '../src/lib/projector';

test('lesson round: whoever misses leaves the dice, until nobody is left', () => {
  let r = newRound(['a', 'b', 'c']);
  assert.ok(!isRebound(r));
  r = fail(r, 'b');
  assert.deepEqual(r.pool, ['a', 'c']);
  assert.ok(isRebound(r));
  for (let i = 0; i < 20; i++) assert.notEqual(rollDice(r), 'b');
  r = fail(fail(r, 'a'), 'c');
  assert.ok(isExhausted(r));
  assert.equal(rollDice(r), null);
});

test('lesson round: failing twice or an unknown id changes nothing', () => {
  const r = fail(newRound(['a', 'b']), 'a');
  assert.equal(fail(r, 'a'), r);
  assert.equal(fail(r, 'zzz'), r);
  assert.equal(r.failed.length, 1);
});

test('lesson round: dice covers every contender', () => {
  const r = newRound(['a', 'b', 'c']);
  assert.equal(rollDice(r, () => 0), 'a');
  assert.equal(rollDice(r, () => 0.5), 'b');
  assert.equal(rollDice(r, () => 0.999), 'c');
});

test('lesson round: points by first throw, alternative and rebound', () => {
  assert.equal(roundPoints(false, 100, 100), POINTS.solve);
  assert.equal(roundPoints(false, 50, 100), 2);
  assert.equal(roundPoints(true, 100, 100), POINTS.steal);
  assert.equal(roundPoints(true, 50, 100), POINTS.steal);
});

test('lesson round: team speaker rotates to whoever has spoken least', () => {
  const kids = [{ id: 1 }, { id: 2 }, { id: 3 }];
  assert.equal(pickSpeaker(kids, { 1: 2, 2: 1, 3: 2 })?.id, 2);
  assert.equal(pickSpeaker([], {}), null);
  assert.ok([1, 2, 3].includes(pickSpeaker(kids, {})!.id));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  earnedStickers, eventStickers, madridClock, nextRating, practiceXp, ratingBand, startRating, STICKERS, TRAINING_DAILY_XP_CAP, weeklyGoal,
  type Stats,
} from '../src/lib/rewards';
import { dailyPick } from '../src/lib/practice';
import { cleanItems } from '../src/lib/progress';
import { itemTracker } from '../src/games/items';

const base: Stats = {
  xp: 0, streak: 0, puzzlesSolved: 0, gamesCompleted: 0, totalSeconds: 0, threeStars: 0, lessonsDone: 0, fruitPerfect: 0,
  blitzDone: 0, homeworkDone: 0, dailyDone: 0, reviewFixed: 0, campaignsDone: 0, rating: 0,
};

test('practice XP: review pays per fixed puzzle, daily pays once, cap is respected', () => {
  assert.equal(practiceXp('repaso', 3, 4, 0).performance, 12);
  assert.equal(practiceXp('diario', 1, 1, 30).total, 15);
  assert.equal(practiceXp('diario', 0, 1, 30).total, 5);
  assert.equal(practiceXp('diario', 1, 1, 30, 0).total, 0);
  assert.equal(practiceXp('entrena', 5, 5, 600, 7).total, 7);
  assert.ok(practiceXp('entrena', 5, 5, 600).total <= 5 * 3 + 3 * 2 + 10);
  assert.ok(TRAINING_DAILY_XP_CAP > 0);
});

test('rating: solving a harder puzzle raises more than an easier one', () => {
  const up = nextRating(800, 50, 1000, true) - 800;
  const upEasy = nextRating(800, 50, 600, true) - 800;
  assert.ok(up > upEasy && upEasy > 0);
  assert.ok(nextRating(800, 50, 800, false) < 800);
  // New students move faster while being placed.
  assert.ok(nextRating(800, 0, 800, true) - 800 > nextRating(800, 50, 800, true) - 800);
  assert.equal(nextRating(400, 50, 400, false), 400); // floor
  assert.equal(startRating('peque'), 600);
  assert.equal(ratingBand(1200).name, 'Cazador');
});

test('event stickers: clean run, early bird, weekend', () => {
  assert.deepEqual(eventStickers({ hour: 17, weekday: 3, puzzlesSolved: 10, mistakes: 0 }), ['sin-fallos']);
  assert.deepEqual(eventStickers({ hour: 17, weekday: 3, puzzlesSolved: 10, mistakes: 1 }), []);
  assert.deepEqual(eventStickers({ hour: 8, weekday: 6, puzzlesSolved: 1, mistakes: 3 }), ['madrugador', 'finde']);
  assert.deepEqual(eventStickers({ hour: 2, weekday: 2, puzzlesSolved: 1, mistakes: 0 }), []);
});

test('madrid clock', () => {
  // 2026-07-01 06:30 UTC = 08:30 in Madrid (CEST), a Wednesday.
  assert.deepEqual(madridClock(new Date('2026-07-01T06:30:00Z')), { hour: 8, weekday: 3 });
});

test('new stat stickers and event stickers never derived from stats', () => {
  const got = earnedStickers({ ...base, dailyDone: 1, reviewFixed: 1, campaignsDone: 1, rating: 1200 });
  for (const id of ['diario-1', 'repaso-1', 'campana-1', 'rating-1200']) assert.ok(got.includes(id), id);
  assert.ok(!earnedStickers({ ...base, rating: startRating('maestro') + 60 }).includes('rating-1200'));
  const events = STICKERS.filter((s) => s.event).map((s) => s.id);
  assert.ok(events.includes('dragon-dorado'));
  assert.ok(!earnedStickers({ ...base, xp: 99999, puzzlesSolved: 9999 }).some((id) => events.includes(id)));
  assert.equal(new Set(STICKERS.map((s) => s.id)).size, STICKERS.length);
});

test('weekly goal: coach value or 12 per student (min 20)', () => {
  assert.equal(weeklyGoal(50, 8), 50);
  assert.equal(weeklyGoal(0, 8), 96);
  assert.equal(weeklyGoal(0, 1), 20);
});

test('daily puzzle pick: same for everyone in an age group on a day, inside its band', () => {
  const a = dailyPick('2026-10-01', 'peque');
  assert.deepEqual(a, dailyPick('2026-10-01', 'peque'));
  assert.ok(a.rating >= 450 && a.rating < 750);
  assert.notDeepEqual(dailyPick('2026-10-01', 'peque'), dailyPick('2026-10-02', 'peque'));
});

test('cleanItems bounds what the client sends', () => {
  const items = cleanItems([{ ok: 1, mistakes: -3, seconds: 99999 }, { ok: 0, mistakes: 2.4 }, {}, {}], 3);
  assert.deepEqual(items, [{ ok: true, mistakes: 0, seconds: 3600 }, { ok: false, mistakes: 2, seconds: 0 }, { ok: false, mistakes: 0, seconds: 0 }]);
  assert.deepEqual(cleanItems('nope', 3), []);
});

test('item tracker: first try decides ok, retries add mistakes, gaps are filled', () => {
  const t = itemTracker();
  t.start();
  t.done(0, false, 2);
  t.done(0, true, 0);
  t.done(2, true, 0);
  const l = t.list(3);
  assert.equal(l[0].ok, false);
  assert.equal(l[0].mistakes, 2);
  assert.deepEqual(l[1], { ok: false, mistakes: 0, seconds: 0 });
  assert.equal(l[2].ok, true);
});

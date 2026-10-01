import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COACHES, coachTemplates, VOICE_PREFS } from '../src/lib/voice/coaches';
import { BANKS, cleanForSpeech, clipId, ENUMERABLE, expand, pickFresh, placeholders, render, type Cue } from '../src/lib/voice/phrases';

const CUES = Object.keys(BANKS) as Cue[];
const KNOWN_VARS = new Set([...Object.keys(ENUMERABLE), 'name']);

test('voice: core cues have plenty of variety and no duplicates', () => {
  for (const cue of ['correct', 'perfect', 'wrong', 'streak', 'start'] as Cue[]) assert.ok(BANKS[cue].length >= 12, cue);
  for (const cue of CUES) assert.equal(new Set(BANKS[cue]).size, BANKS[cue].length, `duplicate in ${cue}`);
});

test('voice: templates only use known placeholders', () => {
  for (const cue of CUES) {
    for (const t of BANKS[cue]) for (const k of placeholders(t)) assert.ok(KNOWN_VARS.has(k), `${cue}: {${k}}`);
  }
});

test('voice: every cue can be said with a pre-recordable line', () => {
  const needsName = new Set<Cue>(['kidPoint', 'kidPicked']);
  for (const cue of CUES) {
    if (needsName.has(cue)) continue;
    assert.ok(BANKS[cue].some((t) => expand(t).length > 0), cue);
  }
});

test('voice: render fills vars and rejects missing ones', () => {
  assert.equal(render('¡Subes al nivel {level}!', { level: 4 }), '¡Subes al nivel 4!');
  assert.equal(render('¡Hola, {name}!', {}), null);
  assert.equal(render('¡Hola, {name}!', { name: '' }), null);
});

test('voice: expand covers every enumerable value and leaves no braces', () => {
  const lines = expand('Turno de los {team}.');
  assert.equal(lines.length, ENUMERABLE.team.length);
  assert.ok(lines.every((l) => !l.includes('{')));
  assert.deepEqual(expand('¡Hola, {name}!'), []);
});

test('voice: clipId ignores emoji and spacing, differs between lines', () => {
  assert.equal(clipId('¡Bravo! 🎉'), clipId('¡Bravo!'));
  assert.equal(clipId('¡Muy  bien!'), clipId('¡Muy bien!'));
  assert.notEqual(clipId('¡Muy bien!'), clipId('¡Muy bien'));
  assert.equal(cleanForSpeech('👑 ¡Jaque! ✨'), '¡Jaque!');
});

test('voice: clip ids are unique across every recordable line', () => {
  const all = new Set<string>();
  for (const c of COACHES) for (const cue of CUES) for (const t of coachTemplates(c, cue, BANKS[cue])) for (const l of expand(t)) all.add(cleanForSpeech(l));
  const ids = new Set([...all].map(clipId));
  assert.equal(ids.size, all.size);
});

test('voice: pickFresh never repeats the recent lines', () => {
  const pool = BANKS.correct;
  const recent: string[] = [];
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const said: string[] = [];
  for (let i = 0; i < 200; i++) said.push(pickFresh(pool, recent, rnd));
  for (let i = 1; i < said.length; i++) assert.ok(!said.slice(Math.max(0, i - 8), i).includes(said[i]), `repeat at ${i}`);
  assert.ok(new Set(said).size > pool.length * 0.8, 'uses most of the bank');
});

test('voice: pickFresh copes with tiny pools', () => {
  assert.equal(pickFresh([], []), '');
  const recent: string[] = [];
  assert.equal(pickFresh(['a'], recent), 'a');
  assert.equal(pickFresh(['a'], recent), 'a');
  const r2: string[] = [];
  const a = pickFresh(['x', 'y'], r2), b = pickFresh(['x', 'y'], r2);
  assert.notEqual(a, b);
});

test('voice: coaches have unique ids, an intro and valid edge settings', () => {
  assert.equal(new Set(COACHES.map((c) => c.id)).size, COACHES.length);
  for (const c of COACHES) {
    assert.match(c.id, /^[a-z0-9-]+$/);
    assert.ok(c.intro.length > 0);
    assert.match(c.tts.rate, /^[+-]\d+%$/);
    assert.match(c.tts.pitch, /^[+-]\d+Hz$/);
  }
});

test('voice: every Potróculo voice has its own themed lines and a valid flavor', () => {
  for (const c of COACHES) {
    assert.ok(c.flavor >= 0 && c.flavor <= 1, c.id);
    for (const cue of ['correct', 'wrong'] as Cue[]) assert.ok((c.extra?.[cue]?.length ?? 0) >= 2, `${c.id}.${cue}`);
    for (const cue of Object.keys(c.extra ?? {}) as Cue[]) {
      assert.ok(cue in BANKS, `${c.id}: unknown cue ${cue}`);
      for (const t of c.extra![cue]!) for (const k of placeholders(t)) assert.ok(KNOWN_VARS.has(k), `${c.id}.${cue}: {${k}}`);
    }
  }
});

test('voice: stored preferences are the voice ids plus random/none', () => {
  assert.deepEqual([...VOICE_PREFS].sort(), [...COACHES.map((c) => c.id), 'none', 'random'].sort());
  for (const p of VOICE_PREFS) assert.ok(p.length <= 20);
});

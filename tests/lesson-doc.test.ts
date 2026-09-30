import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAME_META } from '../src/games/meta';
import {
  addAlt, altsAt, buildComment, foldOverrides, importPgn, mainPts, noteAt, removeAlt, replaceFrom,
  serializePgn, setMainPts, setNoteAt, updateAlt,
} from '../src/games/pgn/doc';
import { compileLesson } from '../src/games/pgn/lesson';
import { parseComment, parsePgn } from '../src/games/pgn/parser';

const SAMPLE = GAME_META['pgn-lesson'].defaultContent().pgn;
type Ask = Extract<ReturnType<typeof compileLesson>['steps'][number], { kind: 'ask' }>;
const asks = (pgn: string) => compileLesson(pgn).steps.filter((s) => s.kind === 'ask') as Ask[];

test('buildComment is the inverse of parseComment', () => {
  const raw = 'Bien hecho [%ask ¿Y ahora?] [%hint Mira f7] [%pts 80] [%wait] [%cal Gc4f7,Re1e8] [%csl Bd4]';
  const info = parseComment(raw);
  assert.deepEqual(parseComment(buildComment(info)), info);
});

test('coach text cannot break the PGN', () => {
  const c = buildComment({ text: 'a {b} [c]', ask: '¿x] y?', retry: false, wait: false, shapes: [] });
  const info = parseComment(c);
  assert.equal(info.text, 'a b c');
  assert.equal(info.ask, '¿x y?');
});

test('sample lesson survives a parse → serialize round trip', () => {
  const again = serializePgn(parsePgn(SAMPLE));
  assert.deepEqual(compileLesson(again), compileLesson(SAMPLE));
  assert.equal(serializePgn(parsePgn(again)), again);
});

test('question, hint, points and arrows added with the helpers compile into the lesson', () => {
  let g = importPgn('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5', '').game!;
  g = setNoteAt(g, 2, { ask: '¿Cómo atacas el peón?', hint: 'Usa el caballo', shapes: [{ orig: 'f3', dest: 'e5', brush: 'red' }] });
  g = setMainPts(g, 2, 80);
  g = addAlt(g, 2, 'Nc3', 'good', 40, 'También desarrolla');
  g = addAlt(g, 2, 'Bc4', 'almost');
  g = addAlt(g, 2, 'Qh5', 'wrong', undefined, 'Sale muy pronto');
  const pgn = serializePgn(g);
  const [a] = asks(pgn);
  assert.equal(a.question, '¿Cómo atacas el peón?');
  assert.equal(a.hint, 'Usa el caballo');
  assert.deepEqual(a.questionShapes, [{ orig: 'f3', dest: 'e5', brush: 'red' }]);
  assert.equal(a.main.san, 'Nf3');
  assert.equal(a.main.pts, 80);
  assert.deepEqual(a.answers.map((x) => [x.san, x.pts]), [['Nf3', 80], ['Nc3', 40]]);
  assert.deepEqual(a.almost.map((x) => x.san), ['Bc4']);
  assert.deepEqual(a.wrong.map((x) => [x.san, x.text]), [['Qh5', 'Sale muy pronto']]);
});

test('alternatives can be changed and removed', () => {
  let g = importPgn('1. e4 e5 2. Nf3', '').game!;
  g = setNoteAt(g, 2, { ask: '' });
  g = addAlt(g, 2, 'Nc3', 'good', 50);
  g = updateAlt(g, 2, 0, { kind: 'wrong', text: 'No' });
  assert.deepEqual(altsAt(g, 2).map((a) => [a.san, a.kind, a.text]), [['Nc3', 'wrong', 'No']]);
  g = removeAlt(g, 2, 0);
  assert.equal(altsAt(g, 2).length, 0);
  assert.equal(noteAt(g, 2).ask, '¿Cuál es la mejor jugada?');
});

test('importing a FEN alone, then playing moves, numbers black moves correctly', () => {
  const fen = '6k1/4pppp/8/8/8/8/5PPP/3R2K1 b - - 0 30';
  let g = importPgn('', fen).game!;
  g = replaceFrom(g, 0, 'Kf8');
  g = replaceFrom(g, 1, 'Rd8#');
  g = setNoteAt(g, 1, { ask: '¡Mate en una!' });
  const pgn = serializePgn(g);
  assert.match(pgn, /30\.\.\. Kf8/);
  assert.match(pgn, /31\. Rd8#/);
  const [a] = asks(pgn);
  assert.equal(a.main.uci, 'd1d8');
  assert.equal(compileLesson(pgn).startFen, fen);
});

test('import rejects illegal moves and bad FEN', () => {
  assert.ok(importPgn('1. e4 e4', '').error);
  assert.ok(importPgn('', 'not a fen').error);
});

test('legacy per-question overrides are folded into the PGN', () => {
  const g0 = parsePgn(SAMPLE);
  const [first] = asks(SAMPLE);
  const g = foldOverrides(g0, {
    [first.fenBefore]: { question: 'Nueva', hint: 'Mira g6', pts: 90, rules: [{ uci: 'd8e7', kind: 'almost' }] },
  });
  const [a] = asks(serializePgn(g));
  assert.equal(a.question, 'Nueva');
  assert.equal(a.hint, 'Mira g6');
  assert.equal(a.main.pts, 90);
  assert.equal(mainPts(g, 5), 90);
  assert.deepEqual(a.almost.map((x) => x.san), ['Qe7']);
  assert.equal(a.answers.length, 1);
  assert.equal(a.wrong.length, 0);
});

test('a bad [FEN] header in a pasted PGN is an error, not a crash', () => {
  assert.ok(importPgn('[FEN "garbage"]\n\n1. e4', '').error);
});

test('braces inside pasted line comments do not break the PGN', () => {
  const pgn = serializePgn(parsePgn('1. e4 ; a } b\n e5'));
  assert.deepEqual(parsePgn(pgn).moves.map((m) => m.san), ['e4', 'e5']);
});

test('alternatives are matched by move, not by SAN spelling, and never duplicate the main move', () => {
  let g = importPgn('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 ( 4. Bxc6 { [%pts 50] } ) 4... Nf6', '').game!;
  g = addAlt(g, 6, 'Bxc6', 'wrong', undefined, 'Cambia el alfil');
  assert.deepEqual(altsAt(g, 6).map((a) => [a.san, a.kind]), [['Bxc6', 'wrong']]);
  g = addAlt(g, 6, 'Ba4', 'wrong');
  assert.equal(altsAt(g, 6).length, 1);
});

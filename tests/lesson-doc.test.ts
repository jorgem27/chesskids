import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAME_META } from '../src/games/meta';
import {
  addAlt, addLine, altsAt, buildComment, foldOverrides, importPgn, lineAt, mainPts, noteAt, removeAlt, replaceFrom, truncateAt,
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

test('a variation with a question is played as a side line and then rewound', () => {
  const pgn = '1. e4 e5 2. Nf3 Nc6 ( 2... d6 { [%ask ¿Qué jugarías tú?] } 3. d4 ( 3. Bc4 { [%pts 50] } ) 3... exd4 ) 3. Bb5 { [%ask ¿Y ahora?] } 3... a6 *';
  const l = compileLesson(pgn);
  assert.deepEqual(l.steps.map((s) => (s.kind === 'auto' ? s.san : s.kind === 'ask' ? `?${s.main.san}` : `jump${s.depth}`)),
    ['e4', 'e5', 'Nf3', 'Nc6', 'jump1', 'd6', '?d4', 'exd4', 'jump0', 'Bb5', '?a6']);
  const [into, back] = l.steps.filter((s) => s.kind === 'jump') as Extract<typeof l.steps[number], { kind: 'jump' }>[];
  assert.match(into.text, /las negras hubieran jugado 2\.\.\.d6/);
  assert.equal(into.path.length, 1);
  assert.equal(into.path[0].fen, (l.steps[3] as { fenBefore: string }).fenBefore); // the board before 2...Nc6
  // Rewind exd4, d4, d6 one by one, then replay 2...Nc6.
  assert.equal(back.text, '🔙 Volvemos a la partida');
  assert.equal(back.path.length, 4);
  assert.equal(back.path[2].fen, into.path[0].fen);
  assert.equal(back.path[3].lastMove, 'b8c6');
  assert.equal(back.path[3].fen, (l.steps[9] as { fenBefore: string }).fenBefore); // the game goes on from 2...Nc6
  // The side-line question keeps its own alternatives and counts for the score.
  const side = l.steps[6] as Ask;
  assert.deepEqual(side.answers.map((a) => a.san), ['d4', 'Bc4']);
  assert.equal(l.maxScore, 200);
});

test('variations without a question are still ignored', () => {
  const l = compileLesson('1. e4 e5 ( 1... c5 2. Nf3 ) 2. Nf3 { [%ask ¿?] } 2... Nc6 *');
  assert.ok(!l.steps.some((s) => s.kind === 'jump'));
});

test('an illegal move inside a side line is reported', () => {
  assert.throws(() => compileLesson('1. e4 e5 ( 1... d6 { [%ask ¿?] } 2. Ke3 ) *'), /variante/);
});

test('a question inside a side line does not flip the board', () => {
  // Main-line question is for black; the side-line one is for white.
  const l = compileLesson('1. e4 e5 2. Nf3 Nc6 ( 2... d6 { [%ask ¿?] } 3. d4 ) 3. Bb5 { [%ask ¿?] } 3... a6 *');
  assert.equal(l.orientation, 'black');
});

test('a side line whose only [%ask] is on its last move is not entered', () => {
  const l = compileLesson('1. e4 e5 ( 1... d6 { [%ask ¿?] } ) 2. Nf3 *');
  assert.ok(!l.steps.some((s) => s.kind === 'jump'));
});

test('nested side lines return to the variation, then to the game', () => {
  const l = compileLesson('1. e4 e5 ( 1... c5 2. Nf3 ( 2. c3 { [%ask ¿?] } 2... d5 ) 2... d6 { [%ask ¿?] } 3. d4 ) 2. Nf3 *');
  const jumps = l.steps.flatMap((s) => (s.kind === 'jump' ? [`${s.depth}:${s.text}`] : []));
  assert.equal(jumps.length, 4);
  assert.match(jumps[1], /^2:.*blancas hubieran jugado 2\.c3/);
  assert.match(jumps[2], /^1:.*variante de antes/);
  assert.match(jumps[3], /^0:.*partida/);
  assert.equal(l.steps.filter((s) => s.kind === 'ask').length, 2);
});

test('an alternative to a question keeps its kind and its own questions play afterwards', () => {
  const pgn = '1. e4 e5 2. Nf3 { [%ask ¿Cómo defiendes e5?] } 2... Nc6 ( 2... d6 { [%pts 50] [%ask ¿Y ahora qué juegas?] } 3. d4 ) ( 2... f6 { Debilita al rey } ) 3. Bb5 *';
  const l = compileLesson(pgn);
  const first = l.steps.find((s) => s.kind === 'ask') as Ask;
  assert.deepEqual(first.answers.map((a) => [a.san, a.pts]), [['Nc6', 100], ['d6', 50]]);
  assert.deepEqual(first.wrong.map((w) => w.san), ['f6']);
  const kinds = l.steps.map((s) => (s.kind === 'auto' ? s.san : s.kind === 'ask' ? `?${s.main.san}` : `jump${s.depth}`));
  assert.deepEqual(kinds, ['e4', 'e5', 'Nf3', '?Nc6', 'jump1', 'd6', '?d4', 'jump0', 'Bb5']);
  assert.equal(l.maxScore, 200);
});

test('editor helpers edit a variation through its path', () => {
  let g = importPgn('1. e4 e5 2. Nf3 Nc6 3. Bb5 *', '').game!;
  // "¿Y si…?" 2...d6 from position 3 (before 2...Nc6), then play on and ask inside it.
  const r = addLine(g, 3, 'd6');
  assert.equal(r.index, 0);
  g = r.game;
  const path = [{ ply: 3, v: r.index }];
  g = replaceFrom(g, 1, 'd4', path);
  g = setNoteAt(g, 1, { ask: '¿Qué jugarías?' }, path);
  assert.deepEqual(lineAt(g, path)!.moves.map((m) => m.san), ['d6', 'd4']);
  assert.equal(noteAt(g, 1, path).ask, '¿Qué jugarías?');
  assert.equal(noteAt(g, 0, path).ask, undefined); // the branch point is the game's position
  assert.deepEqual(altsAt(g, 3).map((a) => [a.san, a.length, a.sideLine]), [['d6', 2, true]]);

  // Survives a save and plays as a side line.
  const again = serializePgn(parsePgn(serializePgn(g)));
  assert.ok(compileLesson(again).steps.some((s) => s.kind === 'jump'));

  // Turning the branch point into a question makes 2...d6 an answer, and keeps its question.
  g = setNoteAt(g, 3, { ask: '¿Cómo defiendes?' });
  g = updateAlt(g, 3, 0, { kind: 'good', pts: 40 });
  assert.equal(noteAt(g, 1, path).ask, '¿Qué jugarías?');
  const l = compileLesson(serializePgn(g));
  assert.equal(l.steps.filter((s) => s.kind === 'ask').length, 2);
  assert.ok(l.steps.some((s) => s.kind === 'jump'));

  // Cutting a variation to nothing removes it.
  assert.equal(altsAt(truncateAt(g, 0, path), 3).length, 0);
});

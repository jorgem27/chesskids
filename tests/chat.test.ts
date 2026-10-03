import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  asChatMode, cleanText, dmThread, gameLabel, MAX_GAME_PLIES, MAX_TEXT, parsePastedChess, parseThread, puzzleFromContent,
  START_FEN, validateGame,
} from '../src/lib/chat';

test('chat: thread keys', () => {
  assert.equal(dmThread(7, 3), 'dm:3-7');
  assert.equal(dmThread(3, 7), 'dm:3-7');
  assert.deepEqual(parseThread('clase'), { group: true });
  assert.deepEqual(parseThread('dm:3-7'), { group: false, a: 3, b: 7 });
  assert.equal(parseThread('dm:7-3'), null); // not canonical
  assert.equal(parseThread('dm:3-3'), null);
  assert.equal(parseThread("dm:1-2' OR 1=1"), null);
  assert.equal(asChatMode('group'), 'group');
  assert.equal(asChatMode('nope'), 'on');
});

test('chat: text filter removes contact data and links', () => {
  assert.deepEqual(cleanText('  ¡Hola!   ¿jugamos?  '), { text: '¡Hola! ¿jugamos?', flagged: false });
  assert.equal(cleanText('mira www.ejemplo.com ya').text, 'mira (enlace quitado) ya');
  assert.equal(cleanText('https://x.y/z?a=1').text, '(enlace quitado)');
  assert.equal(cleanText('entra en juegos.es').text, 'entra en (enlace quitado)');
  assert.equal(cleanText('mi correo es ana.p@gmail.com').text, 'mi correo es (correo quitado)');
  assert.equal(cleanText('llámame 612 345 678').text, 'llámame (número quitado)');
  assert.equal(cleanText('+34 612-34-56-78').text, '(número quitado)');
  // Chess talk and small numbers survive.
  assert.equal(cleanText('1. e4 e5 2. Cf3 ¡mate en 2! Tengo 1200 de nivel').text, '1. e4 e5 2. Cf3 ¡mate en 2! Tengo 1200 de nivel');
  // Invisible characters and too many blank lines go away.
  assert.equal(cleanText('ho​la\n\n\n\nadiós').text, 'hola\n\nadiós');
  assert.equal(cleanText(42 as unknown).text, '');
});

test('chat: insults are masked and flagged, innocent words are not', () => {
  const r = cleanText('eres TONTOOO');
  assert.equal(r.flagged, true);
  assert.ok(!/tonto/i.test(r.text));
  assert.ok(r.text.startsWith('eres T★'));
  assert.equal(cleanText('qué estúpido').flagged, true);
  assert.equal(cleanText('te odio').flagged, true);
  assert.equal(cleanText('¡Imbécil!').flagged, true);
  // Whole words only.
  assert.equal(cleanText('la computadora y el tontódromo... no: el montón').flagged, false);
  assert.equal(cleanText('¡Qué buena jugada!').flagged, false);
});

test('chat: long messages are cut', () => {
  const t = cleanText('a'.repeat(MAX_TEXT + 50)).text;
  assert.equal([...t].length, MAX_TEXT + 1); // + the ellipsis
  assert.ok(t.endsWith('…'));
  const emoji = cleanText('♟'.repeat(MAX_TEXT)).text; // counts characters, not UTF-16 units
  assert.equal([...emoji].length, MAX_TEXT);
});

test('chat: games are replayed with chess.js', () => {
  const g = validateGame(undefined, ['e2e4', 'e7e5', 'g1f3']);
  assert.ok(g);
  assert.equal(g.start, START_FEN);
  assert.equal(g.fen.split(' ')[0], 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R');
  assert.equal(gameLabel(g), 'Partida (2 jugadas)');
  assert.equal(validateGame(START_FEN, ['e2e5']), null); // illegal
  assert.equal(validateGame(START_FEN, ['e2e4', 'hack']), null);
  assert.equal(validateGame('not a fen', []), null);
  assert.equal(validateGame(START_FEN, 'e2e4' as unknown), null);
  assert.equal(validateGame(START_FEN, Array(MAX_GAME_PLIES + 1).fill('g1f3')), null);
  const pos = validateGame('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', []);
  assert.ok(pos);
  assert.equal(gameLabel(pos), 'Posición');
  // Promotion is kept.
  const promo = validateGame('8/P6k/8/8/8/8/8/K7 w - - 0 1', ['a7a8q']);
  assert.deepEqual(promo?.moves, ['a7a8q']);
});

test('chat: pasted PGN and FEN', () => {
  const pgn = parsePastedChess('[Event "Club"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *');
  assert.deepEqual(pgn?.moves, ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6']);
  const fen = parsePastedChess('6k1/5ppp/8/8/8/8/5PPP/R5K1 w');
  assert.equal(fen?.start, '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1');
  assert.deepEqual(fen?.moves, []);
  assert.equal(parsePastedChess('hola qué tal'), null);
  assert.equal(parsePastedChess(''), null);
});

test('chat: puzzles are copied from activity content', () => {
  const content = { puzzles: [
    { fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', moves: ['a1a8'], prompt: 'Mate en 1' },
    { fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', moves: ['a1a9'] },
  ] };
  assert.deepEqual(puzzleFromContent(content, 0), { fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', moves: ['a1a8'], prompt: 'Mate en 1' });
  assert.equal(puzzleFromContent(content, 1), null); // broken solution
  assert.equal(puzzleFromContent(content, 2), null);
  assert.equal(puzzleFromContent(content, -1), null);
  assert.equal(puzzleFromContent(content, '0x'), null);
  assert.equal(puzzleFromContent(null, 0), null);
});

test('chat: puzzles need an odd line and keep the coach alternatives', () => {
  const fen = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';
  assert.equal(puzzleFromContent({ puzzles: [{ fen, moves: ['a1a8', 'g8h7'] }] }, 0), null); // ends with the reply
  const rules = [{ move: 'a1a7', kind: 'almost' }];
  const p = puzzleFromContent({ puzzles: [{ fen, moves: ['a1a8'], steps: [{ hint: 'secreto', rules }] }] }, 0);
  assert.deepEqual(p?.steps, [{ rules }]); // hint texts are not copied
});

test('chat: PGN with only a FEN header is a position', () => {
  const g = parsePastedChess('[SetUp "1"]\n[FEN "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1"]\n\n*');
  assert.equal(g?.start, '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1');
  assert.deepEqual(g?.moves, []);
});

test('chat: the word filter stays fast on huge or hostile input', () => {
  const t0 = performance.now();
  for (const s of ['l'.repeat(100_000) + 'x', 'polla'.repeat(20_000), 'a.'.repeat(50_000), '1 '.repeat(50_000)]) cleanText(s);
  assert.ok(performance.now() - t0 < 500, 'cleanText too slow');
  assert.equal(cleanText('pollaaa').flagged, true); // collapsing double letters still matches
  assert.equal(cleanText('zorra').flagged, true);
});

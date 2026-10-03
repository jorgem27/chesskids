import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { GAME_META } from '../src/games/meta';
import { applyUci, type Puzzle } from '../src/games/puzzle/logic';
import { compileLesson } from '../src/games/pgn/lesson';
import { STARTER_ACTIVITIES, STARTER_CAMPAIGNS } from '../src/lib/starter';
import { CAMPAIGN_REWARDS, CAMPAIGN_THEMES } from '../src/lib/campaigns';

test('starter: every activity passes its game validator', () => {
  for (const a of STARTER_ACTIVITIES) {
    const meta = GAME_META[a.type];
    assert.ok(meta, `${a.key}: unknown type ${a.type}`);
    assert.deepEqual(meta.validate(a.content), [], `${a.key} should be valid`);
    assert.ok(meta.count(a.content) > 0, `${a.key} has items`);
  }
});

test('starter: keys are unique and campaigns point at activities of their level', () => {
  const keys = new Set(STARTER_ACTIVITIES.map((a) => a.key));
  assert.equal(keys.size, STARTER_ACTIVITIES.length);
  for (const c of STARTER_CAMPAIGNS) {
    assert.ok(CAMPAIGN_REWARDS.some((r) => r.id === c.reward), `${c.title}: reward`);
    assert.ok(CAMPAIGN_THEMES.some((t) => t.id === c.theme), `${c.title}: theme`);
    for (const k of c.nodes) {
      const a = STARTER_ACTIVITIES.find((x) => x.key === k);
      assert.ok(a, `${c.title}: node ${k} exists`);
      assert.equal(a!.level, c.level, `${k} matches the campaign level`);
    }
  }
});

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Material balance for `side`. */
function material(c: Chess, side: 'w' | 'b'): number {
  let t = 0;
  for (const row of c.board()) for (const sq of row) if (sq) t += (sq.color === side ? 1 : -1) * VALUE[sq.type];
  return t;
}

/** Tiny minimax on material (mate = ±100) from `side`'s point of view. */
function search(c: Chess, depth: number, side: 'w' | 'b'): number {
  if (c.isCheckmate()) return c.turn() === side ? -100 : 100;
  if (c.isDraw() || c.isStalemate()) return 0;
  if (depth === 0) return material(c, side);
  const mine = c.turn() === side;
  let best = mine ? -Infinity : Infinity;
  for (const m of c.moves()) {
    c.move(m);
    const v = search(c, depth - 1, side);
    c.undo();
    best = mine ? Math.max(best, v) : Math.min(best, v);
  }
  return best;
}

/** Plays a puzzle line and returns the final position. */
function play(p: Puzzle): Chess {
  const c = new Chess(p.fen);
  for (const m of p.moves) assert.ok(applyUci(c, m), `${p.fen}: ${m} is legal`);
  return c;
}

test('starter: "mate" puzzles really end in checkmate', () => {
  for (const a of STARTER_ACTIVITIES.filter((x) => x.type.startsWith('puzzle'))) {
    for (const p of (a.content as { puzzles: Puzzle[] }).puzzles) {
      const end = play(p);
      if (/mate/i.test(p.prompt ?? '')) assert.ok(end.isCheckmate(), `${a.key}: ${p.prompt} (${p.fen}) is mate`);
    }
  }
});

test('starter: mate in 2 replies are forced', () => {
  const a = STARTER_ACTIVITIES.find((x) => x.key === 'm-mate2')!;
  for (const p of (a.content as { puzzles: Puzzle[] }).puzzles) {
    const c = new Chess(p.fen);
    applyUci(c, p.moves[0]);
    assert.equal(c.moves().length, 1, `${p.fen}: only one defence after ${p.moves[0]}`);
  }
});

test('starter: forks and skewers attack two pieces and the moving piece is safe', () => {
  const keys = ['e-horquilla', 'm-tactica'];
  for (const a of STARTER_ACTIVITIES.filter((x) => keys.includes(x.key))) {
    for (const p of (a.content as { puzzles: Puzzle[] }).puzzles) {
      const c = new Chess(p.fen);
      const me = c.turn();
      const to = p.moves[0].slice(2, 4) as any;
      applyUci(c, p.moves[0]);
      if (/horquilla|ataca|rayos/i.test(p.prompt ?? '')) {
        // Nothing of the opponent can take the piece that just moved.
        const captures = c.moves({ verbose: true }).filter((m) => m.to === to);
        assert.equal(captures.length, 0, `${a.key}: ${p.fen} piece on ${to} can't be captured`);
        // Pretend it's our move again and count the enemy pieces we attack from the new square.
        const parts = c.fen().split(' ');
        parts[1] = me;
        parts[3] = '-';
        const again = new Chess(parts.join(' '), { skipValidation: true });
        const hits = again.moves({ square: to, verbose: true }).filter((m) => m.captured);
        const kingHit = c.inCheck() ? 1 : 0;
        assert.ok(hits.length + kingHit >= 2, `${a.key}: ${p.fen} attacks two targets (${hits.length} + ${kingHit})`);
        // And it really wins material against the best defence (checks and counter-attacks included).
        const before = material(new Chess(p.fen), me);
        assert.ok(search(c, 3, me) > before, `${a.key}: ${p.fen} ${p.moves[0]} wins material`);
      }
    }
  }
});

test('starter: lessons compile with questions', () => {
  for (const a of STARTER_ACTIVITIES.filter((x) => x.type === 'pgn-lesson')) {
    const l = compileLesson((a.content as { pgn: string }).pgn);
    assert.ok(l.steps.filter((s) => s.kind === 'ask').length >= 2, `${a.key} has questions`);
  }
  // The Légal mate line ends in checkmate.
  const c = new Chess();
  for (const m of ['e4', 'e5', 'Nf3', 'd6', 'Bc4', 'Bg4', 'Nc3', 'g6', 'Nxe5', 'Bxd1', 'Bxf7+', 'Ke7', 'Nd5#']) c.move(m);
  assert.ok(c.isCheckmate());
});

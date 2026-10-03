// Starter content pack: ready-made activities and adventure maps per age group, imported into a
// club so a new coach doesn't start with an empty library. Every activity is checked against its
// game validator in tests/starter.test.ts (and the puzzles against chess.js).
import type { AgeGroup } from './catalog';

/** Bump when the pack changes; clubs.starter_version remembers what a club already imported. */
export const STARTER_VERSION = 1;

export interface StarterActivity {
  key: string; // stable id inside the pack (campaigns point at it)
  level: AgeGroup;
  type: string;
  title: string;
  description: string;
  xp: number;
  content: unknown;
}

export interface StarterCampaign {
  level: AgeGroup;
  title: string;
  description: string;
  emoji: string;
  theme: string;
  reward: string;
  nodes: string[]; // activity keys, in order
}

const SHEPHERD_LESSON = `[Event "La trampa del pastor"]
[FEN "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"]

{ Vamos a ver una trampa muy famosa. ¡Atento! }
1. e4 e5 2. Bc4 { El alfil apunta a f7, la casilla más débil. [%cal Gc4f7] } 2... Nc6
3. Qh5 { [%ask ¿Qué debe jugar el negro? ¡La dama y el alfil atacan f7!] } 3... g6
( 3... Qe7 { [%pts 60] ¡Bien! También defiende f7. } )
( 3... Qf6 { [%pts 50] Defiende f7, aunque la dama sale muy pronto. } )
( 3... Nh6 { [%pts 50] El caballo defiende f7. ¡Bien visto! } )
( 3... Nf6 { ¡Cuidado! Ahora la dama da mate en f7. } )
{ ¡Eso es! El peón echa a la dama. [%csl Gg6] } 4. Qf3 { La dama vuelve a atacar f7. [%cal Gf3f7] [%ask ¡Tapa el ataque desarrollando una pieza!] } 4... Nf6 { ¡Perfecto! El caballo tapa la diagonal y se desarrolla. }
( 4... Qf6 { [%pts 50] Defiende, pero la dama sale muy pronto. } )
( 4... Qe7 { [%pts 50] Defiende f7, aunque el caballo era mejor. } )
( 4... Nh6 { [%pts 50] Defiende f7, pero en h6 el caballo está peor. } ) *`;

const LEGAL_LESSON = `[Event "El mate de Légal"]
[FEN "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"]

{ Una trampa de hace casi 300 años: ¡a veces regalar la dama gana la partida! }
1. e4 e5 2. Nf3 d6 3. Bc4 Bg4 { El alfil clava el caballo contra la dama. [%cal Gg4d1] }
4. Nc3 g6 { El negro juega lento. [%ask ¡Las blancas tienen un golpe sorprendente! ¿Cuál?] } 5. Nxe5 { ¡El caballo se lanza aunque esté clavado! [%cal Ge5f7] }
5... Bxd1 { ¡El negro se come la dama! [%ask ¿Cómo atacas al rey ahora?] } 6. Bxf7+ { ¡Jaque! }
6... Ke7 { [%ask ¡Remata con jaque mate!] } 7. Nd5# { ¡Mate de Légal! Tres piezas menores pueden más que una dama. } *`;

export const STARTER_ACTIVITIES: StarterActivity[] = [
  // ---------- Peques (5–7) ----------
  {
    key: 'p-fruta', level: 'peque', type: 'fruit-collector', title: '🍓 Así se mueven las piezas', xp: 25,
    description: 'Recoge la fruta con cada pieza y aprende cómo se mueve.',
    content: { levels: [
      { piece: 'R', start: 'a1', fruits: ['a4', 'd4', 'd8'], rocks: [] },
      { piece: 'B', start: 'c1', fruits: ['e3', 'g5', 'd8'], rocks: [] },
      { piece: 'Q', start: 'd1', fruits: ['d5', 'h5', 'a5'], rocks: [] },
      { piece: 'K', start: 'e1', fruits: ['e2', 'f3', 'g3'], rocks: [] },
      { piece: 'N', start: 'g1', fruits: ['f3', 'e5', 'c4'], rocks: [] },
    ] },
  },
  {
    key: 'p-comer', level: 'peque', type: 'puzzle-hint', title: '🍽️ ¡Come la pieza!', xp: 25,
    description: 'Captura la pieza que el rival ha dejado sola.',
    content: { puzzles: [
      { fen: '4k3/8/8/3n4/4P3/8/8/4K3 w - - 0 1', moves: ['e4d5'], prompt: 'El peón come en diagonal. ¡Come el caballo!' },
      { fen: 'q3k3/8/8/8/8/8/8/R3K3 w - - 0 1', moves: ['a1a8'], prompt: '¡La torre puede comerse la dama!' },
      { fen: '3k4/8/4r3/8/3N4/8/8/6K1 w - - 0 1', moves: ['d4e6'], prompt: 'Salta con el caballo y come la torre' },
      { fen: '4k2r/8/8/8/8/8/1B6/4K3 w - - 0 1', moves: ['b2h8'], prompt: 'El alfil corre por la diagonal larga…' },
      { fen: '4k3/8/8/8/b7/8/8/3QK3 w - - 0 1', moves: ['d1a4'], prompt: '¿Qué puede comer la dama?' },
    ] },
  },
  {
    key: 'p-mate1', level: 'peque', type: 'puzzle-hint', title: '👑 Mi primer jaque mate', xp: 30,
    description: 'Da jaque mate en una jugada. Si fallas, ¡te doy una pista!',
    content: { puzzles: [
      { fen: '3k4/8/3K4/8/8/8/8/R7 w - - 0 1', moves: ['a1a8'], prompt: 'Mate en 1: la torre sube hasta arriba' },
      { fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', moves: ['a1a8'], prompt: 'Mate en 1: ¡el rey no puede escapar por sus peones!' },
      { fen: '7k/R7/8/8/8/8/8/1R4K1 w - - 0 1', moves: ['b1b8'], prompt: 'Mate en 1 con las dos torres' },
      { fen: 'k7/8/1K6/8/8/8/8/7Q w - - 0 1', moves: ['h1h8'], prompt: 'Mate en 1 con la dama' },
    ] },
  },
  {
    key: 'p-pastor', level: 'peque', type: 'pgn-lesson', title: '📖 La trampa del pastor', xp: 40,
    description: 'Aprende a defenderte del mate más famoso.',
    content: { pgn: SHEPHERD_LESSON },
  },

  // ---------- Exploradores (8–11) ----------
  {
    key: 'e-caballo', level: 'explorador', type: 'fruit-collector', title: '🐴 Saltos de caballo', xp: 25,
    description: 'El caballo salta en forma de L. ¡Recoge la fruta con los mínimos saltos!',
    content: { levels: [
      { piece: 'N', start: 'b1', fruits: ['c3', 'e4', 'd6'], rocks: [] },
      { piece: 'N', start: 'a1', fruits: ['b3', 'd4', 'f5', 'h6'], rocks: ['c2'] },
      { piece: 'N', start: 'e4', fruits: ['e5', 'd4'], rocks: [] },
      { piece: 'B', start: 'c1', fruits: ['f4', 'h6', 'e7'], rocks: ['d2'] },
      { piece: 'Q', start: 'd1', fruits: ['a4', 'h5', 'd8', 'b8'], rocks: ['d4', 'e4'] },
    ] },
  },
  {
    key: 'e-horquilla', level: 'explorador', type: 'puzzle-hint', title: '🍴 Horquillas', xp: 30,
    description: 'Ataca dos piezas a la vez con una sola jugada.',
    content: { puzzles: [
      { fen: 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', moves: ['b5c7'], prompt: 'Da jaque y ataca también la torre' },
      { fen: '4k3/8/8/3q4/4N3/8/8/4K3 w - - 0 1', moves: ['e4f6'], prompt: 'Jaque al rey… ¡y la dama cae!' },
      { fen: '7k/8/8/2n1n3/8/8/3P4/7K w - - 0 1', moves: ['d2d4'], prompt: 'Un peón también puede hacer horquilla' },
      { fen: '8/r5k1/8/8/8/8/8/3QK3 w - - 0 1', moves: ['d1d4'], prompt: 'La dama da jaque… ¡y ataca la torre!' },
    ] },
  },
  {
    key: 'e-relampago', level: 'explorador', type: 'puzzle-blitz', title: '⚡ Mates relámpago', xp: 30,
    description: '¡Rápido! Mates en una jugada contra el reloj.',
    content: { timeLimitSec: 30, puzzles: [
      { fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', moves: ['d1d8'], prompt: 'Mate en 1' },
      { fen: '3k4/8/3K4/8/8/8/8/7R w - - 0 1', moves: ['h1h8'], prompt: 'Mate en 1' },
      { fen: '6k1/5ppp/8/8/8/8/8/1Q4K1 w - - 0 1', moves: ['b1b8'], prompt: 'Mate en 1' },
      { fen: '7k/6pp/8/8/8/8/8/2B1R1K1 w - - 0 1', moves: ['e1e8'], prompt: 'Mate en 1' },
      { fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1', moves: ['f3f7'], prompt: 'Mate en 1' },
    ] },
  },
  {
    key: 'e-pastor', level: 'explorador', type: 'pgn-lesson', title: '📖 La trampa del pastor', xp: 40,
    description: 'Aprende a defenderte del mate más famoso.',
    content: { pgn: SHEPHERD_LESSON },
  },

  // ---------- Maestros (12–15) ----------
  {
    key: 'm-mate2', level: 'maestro', type: 'puzzle-hint', title: '🎯 Mates en 2', xp: 40,
    description: 'Busca la jugada que obliga al mate en dos.',
    content: { puzzles: [
      { fen: '3r2k1/5ppp/8/8/8/8/4RPPP/4R1K1 w - - 0 1', moves: ['e2e8', 'd8e8', 'e1e8'], prompt: 'Mate en 2: ¡dobla las torres en la columna!' },
      { fen: 'r6k/6pp/7N/8/8/1Q6/8/6K1 w - - 0 1', moves: ['b3g8', 'a8g8', 'h6f7'], prompt: 'Mate en 2: el mate de la coz (sacrifica la dama)' },
      { fen: '3r2k1/5ppp/8/8/8/4Q3/5PPP/4R1K1 w - - 0 1', moves: ['e3e8', 'd8e8', 'e1e8'], prompt: 'Mate en 2: la dama se sacrifica en la última fila' },
    ] },
  },
  {
    key: 'm-tactica', level: 'maestro', type: 'puzzle-blitz', title: '⚡ Clavadas y rayos X', xp: 35,
    description: 'Táctica rápida: clava, ensarta y gana material.',
    content: { timeLimitSec: 45, puzzles: [
      { fen: '6k1/8/4q3/8/8/1P6/8/5BK1 w - - 0 1', moves: ['f1c4'], prompt: 'Clava la dama contra su rey (tu peón defiende)' },
      { fen: '4q3/8/8/4k3/8/8/8/R5K1 w - - 0 1', moves: ['a1e1'], prompt: 'Rayos X: jaque… ¡y la dama queda detrás!' },
      { fen: '4k3/8/4n3/8/8/8/8/R5K1 w - - 0 1', moves: ['a1e1'], prompt: 'Clava el caballo contra su rey' },
      { fen: '6r1/8/8/3k4/8/8/8/1B2K3 w - - 0 1', moves: ['b1a2'], prompt: 'Rayos X con el alfil: jaque al rey y… ¡la torre!' },
    ] },
  },
  {
    key: 'm-legal', level: 'maestro', type: 'pgn-lesson', title: '📖 El mate de Légal', xp: 45,
    description: 'Una trampa clásica donde regalar la dama gana la partida.',
    content: { pgn: LEGAL_LESSON },
  },
  {
    key: 'm-final', level: 'maestro', type: 'play-bot', title: '🤖 Rey y torre contra rey', xp: 35,
    description: 'El final básico que todo ajedrecista debe saber. ¡Dale mate al robot!',
    content: { positions: [{
      fen: '4k3/8/8/8/8/8/8/4K2R w - - 0 1', title: 'Rey y torre contra rey',
      prompt: 'Encierra al rey negro con la torre y acércale tu rey. ¡No dejes la torre sola!',
      level: 'normal', maxMoves: 40, parMoves: 20, explain: false, steps: [],
    }] },
  },
];

export const STARTER_CAMPAIGNS: StarterCampaign[] = [
  { level: 'peque', title: 'El bosque de los peques', emoji: '🐣', theme: 'bosque', reward: 'pet_sunglasses',
    description: 'Primeros pasos: mueve las piezas, come y da tu primer mate.', nodes: ['p-fruta', 'p-comer', 'p-mate1', 'p-pastor'] },
  { level: 'explorador', title: 'La isla de los exploradores', emoji: '🧭', theme: 'playa', reward: 'sticker_dragon',
    description: 'Saltos de caballo, horquillas y mates relámpago.', nodes: ['e-caballo', 'e-horquilla', 'e-relampago', 'e-pastor'] },
  { level: 'maestro', title: 'El volcán de los maestros', emoji: '🎓', theme: 'volcan', reward: 'title_master',
    description: 'Mates en 2, clavadas, una trampa clásica y un final contra el robot.', nodes: ['m-mate2', 'm-tactica', 'm-legal', 'm-final'] },
];

/**
 * Imports the pack into a club as public activities (the club library) plus one adventure map per
 * level. Returns false if the club already has this version. Two batches: activities, then nodes.
 */
export async function importStarterPack(db: D1Database, clubId: number, coachId: number): Promise<boolean> {
  const claimed = await db.prepare('UPDATE clubs SET starter_version = ? WHERE id = ? AND starter_version < ? RETURNING id')
    .bind(STARTER_VERSION, clubId, STARTER_VERSION).first();
  if (!claimed) return false;
  try {
    await writePack(db, clubId, coachId);
  } catch (e) {
    await db.prepare('UPDATE clubs SET starter_version = 0 WHERE id = ?').bind(clubId).run();
    throw e;
  }
  return true;
}

async function writePack(db: D1Database, clubId: number, coachId: number) {
  const acts = await db.batch<{ id: number }>(STARTER_ACTIVITIES.map((a) => db.prepare(
    `INSERT INTO activities (club_id, created_by, type, title, description, content_json, xp_reward, visibility)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'public') RETURNING id`,
  ).bind(clubId, coachId, a.type, a.title, a.description, JSON.stringify(a.content), a.xp)));
  const idByKey = new Map(STARTER_ACTIVITIES.map((a, i) => [a.key, acts[i].results[0].id]));
  const camps = await db.batch<{ id: number }>(STARTER_CAMPAIGNS.map((c) => db.prepare(
    'INSERT INTO campaigns (club_id, created_by, title, description, reward_type, theme, emoji) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
  ).bind(clubId, coachId, c.title, c.description, c.reward, c.theme, c.emoji)));
  await db.batch(STARTER_CAMPAIGNS.flatMap((c, ci) => c.nodes.map((key, pos) => db.prepare(
    'INSERT INTO campaign_nodes (campaign_id, activity_id, position) VALUES (?, ?, ?)',
  ).bind(camps[ci].results[0].id, idByKey.get(key)!, pos + 1))));
}

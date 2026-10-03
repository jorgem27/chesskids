// Server-safe metadata for every game type (no UI imports here).
// To add a new game type: add its meta here + its Player/Editor in registry.ts. That's it.
import { newPosition, validateBotSet, type BotContent } from './bot/logic';
import { validateLevel, type FruitLevel } from './fruit/logic';
import { validateLessonPgn, type QuestionOverrides } from './pgn/lesson';
import { validatePuzzleSet, type PuzzleSetContent } from './puzzle/logic';

export interface GameMeta<C = any> {
  id: string;
  name: string;
  emoji: string;
  /** Tailwind gradient classes for cards */
  gradient: string;
  tagline: string;
  help: string;
  defaultXp: number;
  defaultContent: () => C;
  validate: (c: C) => string[];
  /** How many items (puzzles / questions / levels) the activity has, for cards. */
  count: (c: C) => number;
  countLabel: string;
}

export type { BotContent };
export interface FruitContent { levels: FruitLevel[] }
export interface LessonContent { pgn: string; questions?: QuestionOverrides }
export interface PdfContent { url: string }

const SAMPLE_LESSON = `[Event "Mate del pastor"]
[FEN "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"]

{ Vamos a ver una trampa muy famosa. ¡Atento! }
1. e4 e5 2. Bc4 { El alfil apunta a f7, la casilla más débil. [%cal Gc4f7] } 2... Nc6
3. Qh5 { [%ask ¿Qué debe jugar el negro para no perder? Defiende f7 y el peón de e5] } 3... g6
( 3... Qe7 { [%pts 60] ¡Bien! También defiende f7. } )
( 3... Nf6 { ¡Cuidado! Ahora la dama da mate en f7. } )
{ ¡Eso es! El peón echa a la dama. [%csl Gg6] } 4. Qf3 { La dama vuelve a atacar f7. [%cal Gf3f7] [%ask ¡Tapa el ataque desarrollando una pieza!] } 4... Nf6 { ¡Perfecto! El caballo tapa la diagonal y se desarrolla. }
( 4... Qf6 { [%pts 50] Defiende, pero la dama sale muy pronto. } ) *`;

export const GAME_META: Record<string, GameMeta> = {
  'pdf-viewer': {
    id: 'pdf-viewer',
    name: 'Documento PDF',
    emoji: '📄',
    gradient: 'from-gray-500 to-gray-700',
    tagline: 'Lee el documento en PDF',
    help: 'El estudiante leerá este documento.',
    defaultXp: 10,
    defaultContent: (): PdfContent => ({ url: '' }),
    validate: (c: PdfContent) => c?.url ? [] : ['Añade una URL'],
    count: () => 1,
    countLabel: 'documento',
  },
  'puzzle-hint': {
    id: 'puzzle-hint',
    name: 'Problemas con pistas',
    emoji: '🧩',
    gradient: 'from-brand-600 to-brand-800',
    tagline: 'Piensa con calma. Si fallas, ¡te doy una pista!',
    help: 'Si el alumno se equivoca, se ilumina la pieza que debe mover. Al segundo fallo, aparece una flecha.',
    defaultXp: 30,
    defaultContent: (): PuzzleSetContent => ({ puzzles: [] }),
    validate: validatePuzzleSet,
    count: (c: PuzzleSetContent) => c.puzzles?.length ?? 0,
    countLabel: 'problemas',
  },
  'puzzle-blitz': {
    id: 'puzzle-blitz',
    name: 'Reto relámpago',
    emoji: '⚡',
    gradient: 'from-amber-400 to-orange-500',
    tagline: '¡Rápido! Encadena aciertos para hacer combo.',
    help: 'Si el alumno falla, se muestra la solución y pasa al siguiente. Puedes poner un reloj por problema.',
    defaultXp: 30,
    defaultContent: (): PuzzleSetContent => ({ puzzles: [], timeLimitSec: 0 }),
    validate: validatePuzzleSet,
    count: (c: PuzzleSetContent) => c.puzzles?.length ?? 0,
    countLabel: 'problemas',
  },
  'pgn-lesson': {
    id: 'pgn-lesson',
    name: 'Lección interactiva',
    emoji: '📖',
    gradient: 'from-sky-400 to-blue-600',
    tagline: 'Mira la partida y responde a las preguntas.',
    help: 'La partida se reproduce sola y se para en las preguntas ([%ask]). Acepta jugadas alternativas con puntos ([%pts]).',
    defaultXp: 40,
    defaultContent: (): LessonContent => ({ pgn: SAMPLE_LESSON }),
    validate: (c: LessonContent) => validateLessonPgn(c?.pgn, c?.questions),
    count: (c: LessonContent) => (c?.pgn?.match(/\[%ask/gi) ?? []).length,
    countLabel: 'preguntas',
  },
  'play-bot': {
    id: 'play-bot',
    name: 'Juega contra el bot',
    emoji: '🤖',
    gradient: 'from-cyan-400 to-indigo-500',
    tagline: '¡Reta al robot y dale jaque mate!',
    help: 'El alumno juega contra Stockfish desde la posición que tú coloques (ideal para finales como rey y torre contra rey). Puedes añadir una explicación con tablero y cuaderno de pasos.',
    defaultXp: 35,
    defaultContent: (): BotContent => ({ positions: [newPosition()] }),
    validate: validateBotSet,
    count: (c: BotContent) => c.positions?.length ?? 0,
    countLabel: 'posiciones',
  },
  'fruit-collector': {
    id: 'fruit-collector',
    name: 'Recolector de fruta',
    emoji: '🍓',
    gradient: 'from-emerald-400 to-lime-500',
    tagline: 'Recoge toda la fruta con los mínimos movimientos.',
    help: 'Elige una pieza y coloca frutas y rocas. El sistema calcula el camino más corto para dar las estrellas.',
    defaultXp: 25,
    defaultContent: (): FruitContent => ({ levels: [{ piece: 'N', start: 'b1', fruits: ['c3', 'e4', 'd6'], rocks: [] }] }),
    validate: (c: FruitContent) => {
      if (!c?.levels?.length) return ['Añade al menos un nivel'];
      return c.levels.flatMap((l, i) => validateLevel(l).map((e) => `Nivel ${i + 1}: ${e}`));
    },
    count: (c: FruitContent) => c.levels?.length ?? 0,
    countLabel: 'niveles',
  },
};

export const GAME_TYPES = Object.keys(GAME_META);

export function getMeta(type: string): GameMeta {
  const m = GAME_META[type];
  if (!m) throw new Error(`Tipo de juego desconocido: ${type}`);
  return m;
}

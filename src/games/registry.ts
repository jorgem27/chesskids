// Client-side registry: metadata + Player + Editor for each game type.
//
// ➕ HOW TO ADD A NEW GAME TYPE
//   1. Add its metadata (name, emoji, validate, defaultContent…) in games/meta.ts
//   2. Create a Player component (receives `content` + `api`) and an Editor component
//   3. Register both below. The dashboard, coach panel, homework and rewards work automatically.
import { FruitEditor } from './fruit/FruitEditor';
import { FruitPlayer } from './fruit/FruitPlayer';
import { GAME_META, type GameMeta } from './meta';
import { PdfEditor } from './pdf/PdfEditor';
import { PdfPlayer } from './pdf/PdfPlayer';
import { LessonEditor } from './pgn/LessonEditor';
import { LessonPlayer } from './pgn/LessonPlayer';
import { PuzzleEditor } from './puzzle/PuzzleEditor';
import { makePuzzlePlayer } from './puzzle/PuzzlePlayer';
import type { GameUi } from './types';

const UI: Record<string, GameUi> = {
  'pdf-viewer': { Player: PdfPlayer, Editor: PdfEditor },
  'puzzle-hint': { Player: makePuzzlePlayer('hint'), Editor: PuzzleEditor },
  'puzzle-blitz': { Player: makePuzzlePlayer('blitz'), Editor: PuzzleEditor },
  'pgn-lesson': { Player: LessonPlayer, Editor: LessonEditor },
  'fruit-collector': { Player: FruitPlayer, Editor: FruitEditor },
};

export function getGame(type: string): GameMeta & GameUi {
  const meta = GAME_META[type];
  const ui = UI[type];
  if (!meta || !ui) throw new Error(`Juego no registrado: ${type}`);
  return { ...meta, ...ui };
}

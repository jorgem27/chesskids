/** Lichess puzzle themes offered to coaches (keys match the Themes column of the Lichess CSV). */
export interface LichessTheme { key: string; label: string; emoji: string }

export const LICHESS_THEMES: LichessTheme[] = [
  { key: 'mix', label: 'Variados', emoji: '🎲' },
  { key: 'mateIn1', label: 'Mate en 1', emoji: '♚' },
  { key: 'mateIn2', label: 'Mate en 2', emoji: '♛' },
  { key: 'mateIn3', label: 'Mate en 3', emoji: '👑' },
  { key: 'backRankMate', label: 'Mate del pasillo', emoji: '🚪' },
  { key: 'smotheredMate', label: 'Mate de la coz', emoji: '🐴' },
  { key: 'hangingPiece', label: 'Pieza colgada', emoji: '🎁' },
  { key: 'fork', label: 'Ataque doble', emoji: '🍴' },
  { key: 'pin', label: 'Clavada', emoji: '📌' },
  { key: 'skewer', label: 'Enfilada', emoji: '🍢' },
  { key: 'discoveredAttack', label: 'Ataque a la descubierta', emoji: '🔦' },
  { key: 'doubleCheck', label: 'Jaque doble', emoji: '⚡' },
  { key: 'trappedPiece', label: 'Pieza atrapada', emoji: '🪤' },
  { key: 'deflection', label: 'Desviación', emoji: '↪️' },
  { key: 'attraction', label: 'Atracción', emoji: '🧲' },
  { key: 'sacrifice', label: 'Sacrificio', emoji: '💥' },
  { key: 'defensiveMove', label: 'Jugada defensiva', emoji: '🛡️' },
  { key: 'promotion', label: 'Coronación', emoji: '👸' },
  { key: 'advancedPawn', label: 'Peón avanzado', emoji: '🏃' },
  { key: 'opening', label: 'Apertura', emoji: '🌅' },
  { key: 'middlegame', label: 'Medio juego', emoji: '⚔️' },
  { key: 'endgame', label: 'Final', emoji: '🏁' },
  { key: 'pawnEndgame', label: 'Final de peones', emoji: '♟️' },
  { key: 'rookEndgame', label: 'Final de torres', emoji: '♜' },
  { key: 'oneMove', label: 'Una jugada', emoji: '1️⃣' },
  { key: 'short', label: 'Corto (2 jugadas)', emoji: '✌️' },
];

export const LICHESS_THEME_KEYS = new Set(LICHESS_THEMES.map((t) => t.key));

export const ELO_PRESETS = [
  { label: 'Principiante', emoji: '🐣', min: 400, max: 900 },
  { label: 'Aprendiz', emoji: '🐥', min: 900, max: 1200 },
  { label: 'Intermedio', emoji: '🦅', min: 1200, max: 1500 },
  { label: 'Avanzado', emoji: '🐉', min: 1500, max: 1900 },
];

export const ELO_MIN = 400;
export const ELO_MAX = 2800;
export const MAX_PUZZLES = 30;
/** Widest Elo range per request (keeps D1 rows read small). */
export const MAX_ELO_SPAN = 1000;

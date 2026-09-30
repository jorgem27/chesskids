// Spanish lines the AI coaches say, grouped by situation ("cue").
// Pure data + helpers: shared by the client player and the clip generator (scripts/voices).
//
// Templates may use {placeholders}. A placeholder listed in ENUMERABLE has a finite set of
// values, so the generator pre-records every combination; any other placeholder (a kid's
// name) can only be spoken by the browser voice.

import { KINGDOMS, STICKERS } from '../rewards';

export type Cue =
  | 'correct' | 'perfect' | 'wrong' | 'streak' | 'start'
  | 'resultsPerfect' | 'resultsGood' | 'resultsOk'
  | 'levelUp' | 'kingdom' | 'sticker'
  | 'welcomeMissions' | 'welcomeFree'
  | 'teamTurn' | 'teamRebound' | 'teamPoint' | 'kidPoint' | 'kidPicked' | 'teamWin' | 'tie' | 'xpShared' | 'saved';

export type Vars = Record<string, string | number>;

export const BANKS: Record<Cue, readonly string[]> = {
  // A correct move / solved step.
  correct: [
    '¡Muy bien!', '¡Genial!', '¡Estupendo!', '¡Fenomenal!', '¡Fantástico!', '¡Bravo!', '¡Buenísimo!',
    '¡Excelente!', '¡Así se hace!', '¡Así se juega!', '¡Correcto!', '¡Eso es!', '¡Qué bien!',
    '¡Eres un crack!', '¡De maravilla!', '¡Increíble!', '¡Espectacular!', '¡Magnífico!', '¡Olé!',
    '¡Chapó!', '¡Ahí está!', '¡Qué jugada!', '¡Buena jugada!', '¡Jugadón!', '¡Lo tienes!',
    '¡Muy bien pensado!', '¡Bien visto!', '¡Qué buen ojo!', '¡Brillante!', '¡Impecable!', '¡Sigue así!',
    '¡Clavado!', '¡Perfecto!', '¡Qué máquina!', '¡Súper bien!', '¡Me encanta!', '¡Maravilloso!',
    '¡Lo has visto!', '¡Qué mente brillante!', '¡Así me gusta!', '¡Buenísima idea!', '¡Diez de diez!',
    '¡Buen movimiento!', '¡Qué bien piensas!', '¡Estás en llamas!', '¡Esa es la buena!', '¡Bingo!',
    '¡Premio!', '¡Exacto!', '¡Tal cual!',
  ],
  // Solved at the first try, 3 stars, a big moment.
  perfect: [
    '¡Perfecto, a la primera!', '¡Jugada maestra!', '¡Eso es de gran maestro!', '¡Sin fallos, espectacular!',
    '¡Nivel experto!', '¡Brutal!', '¡Qué pasada!', '¡Alucinante!', '¡Brillas como una estrella!',
    '¡Madre mía, qué jugada!', '¡Menudo jugadón!', '¡A la primera, sin dudar!', '¡Eres imparable!',
    '¡Impresionante!', '¡Esto es de leyenda!', '¡Ajedrez de otro planeta!', '¡Así juegan los grandes!',
    '¡Me dejas sin palabras!', '¡Tremendo!', '¡Qué nivelazo!', '¡Directo al álbum de las mejores jugadas!',
    '¡Ni un fallo! ¡Enorme!',
  ],
  // A mistake: always gentle.
  wrong: [
    '¡Casi!', '¡Uy, casi!', '¡Por poco!', '¡Prueba otra vez!', '¡Inténtalo de nuevo!', '¡Tú puedes!',
    '¡Venga, otra vez!', 'Mmm… casi, casi.', 'Mira otra vez, seguro que lo ves.', '¡No pasa nada, sigue!',
    '¡Otra oportunidad!', 'Esa no era, pero vas muy bien.', '¡Casi lo tienes!', 'Mira el tablero con calma.',
    '¡Equivocarse es aprender!', '¡Ánimo!', '¡Sin prisa, piénsalo!',
    'Respira y vuelve a mirar.', '¡Te falta muy poquito!', '¡Los grandes también fallan!',
    'Esa no… ¡prueba otra!', '¡Vamos, que tú sabes!', '¡Lo vas a conseguir!',
    '¡Otro intento y lo tienes!', '¡Cada error te enseña algo!', '¡Otra vez, con calma!',
    'Uy, esa se escapa. ¡Otra!', '¡Tranquilidad, que lo sacas!',
  ],
  // Combo of correct answers in a row.
  streak: [
    '¡Estás en racha!', '¡Racha de fuego!', '¡No hay quien te pare!', '¡Estás que ardes!', '¡Imparable!',
    '¡Una detrás de otra!', '¡Menuda racha!', '¡Sigue, sigue, sigue!', '¡Súper combo!', '¡Vas a toda máquina!',
    '¡Racha de {n}!', '¡{n} seguidas, increíble!', '¡Combo de {n}!',
  ],
  // Start of an activity.
  start: [
    '¡Vamos allá!', '¡A jugar!', '¡Empezamos!', '¡Que empiece la aventura!', '¡Tú puedes con esto!',
    '¡Preparados, listos, ya!', '¡Manos a la obra!', '¡A por ello!', '¡Hoy vas a brillar!', '¡A darlo todo!',
    '¡Piensa, mueve y gana!', '¡Al tablero!', '¡Comienza el reto!', '¡Vamos a divertirnos!',
    '¡Allá vamos!', '¡Que ruede el ajedrez!',
  ],
  resultsPerfect: [
    '¡Tres estrellas! ¡Perfecto!', '¡Lo has bordado!', '¡Actividad perfecta!', '¡Tres estrellas para ti!',
    '¡Sobresaliente! ¡Enhorabuena!', '¡Impresionante, todas las estrellas!', '¡Así se termina una actividad!',
    '¡De matrícula de honor!', '¡Perfecto de principio a fin!', '¡Eres una máquina del ajedrez!',
    '¡Qué forma de jugar! ¡Enhorabuena!', '¡Pleno total!',
  ],
  resultsGood: [
    '¡Lo has conseguido! ¡Enhorabuena!', '¡Muy buen trabajo!', '¡Genial, actividad terminada!',
    '¡Muy bien jugado!', '¡Enhorabuena, lo has hecho genial!', '¡Qué bien lo has hecho!',
    '¡Misión cumplida!', '¡Buenísimo! ¡A por las tres estrellas la próxima!', '¡Estás mejorando un montón!',
    '¡Gran partida!', '¡Eso ha estado muy bien!', '¡Bravo! ¡Otra actividad superada!',
  ],
  resultsOk: [
    '¡Buen trabajo! ¡Sigue practicando!', '¡Terminado! Cada partida te hace más fuerte.',
    '¡Puedes conseguir más estrellas!', '¡Bien hecho por no rendirte!', 'Practicando se aprende. ¡Sigue así!',
    '¡Lo importante es aprender, y has aprendido!', '¡Muy bien! ¿Lo intentas otra vez?',
    '¡Vas por buen camino!', '¡Cada fallo te enseña algo nuevo!', '¡Poco a poco, cada vez mejor!',
    '¡Gracias por esforzarte tanto!', '¡Ánimo, que la próxima sale mejor!',
  ],
  levelUp: [
    '¡Subes al nivel {level}!', '¡Nivel {level} conseguido!',
    '¡Has subido de nivel!', '¡Nuevo nivel! ¡Qué crack!', '¡Subes de nivel! ¡Sigue así!',
    '¡Arriba, arriba! ¡Nuevo nivel!', '¡Un nivel más! ¡Eres imparable!',
  ],
  kingdom: [
    '¡Nuevo reino desbloqueado! {kingdom}.', '¡Nuevo reino! {kingdom}. ¡A explorar!', '¡Rumbo a un nuevo reino! {kingdom}.',
  ],
  sticker: [
    '¡Nuevo cromo! {sticker}.', '¡Cromo conseguido! {sticker}.', '¡Para tu álbum! {sticker}.',
  ],
  welcomeMissions: [
    '¡Hola! Tienes {missions} esta semana.', '¡Qué alegría verte! Te esperan {missions}.',
    '¡Hola de nuevo! Hay {missions} para ti.', '¡Hola, {name}! Tienes {missions} esta semana.',
  ],
  welcomeFree: [
    '¡Hola! ¡Vamos a jugar!', '¡Qué alegría verte! ¿Jugamos?', '¡Hola de nuevo! El tablero te espera.',
    '¡Hola! ¿Aprendemos algo nuevo hoy?', '¡Hola, {name}! ¡Vamos a jugar!',
  ],
  // Classroom projector.
  teamTurn: [
    'Turno de los {team}.', '¡Os toca, {team}!', '¡Adelante, {team}!', '¡Vamos, {team}, vuestro turno!',
  ],
  teamRebound: [
    '¡Rebote para los {team}!', '¡Rebote! Ahora los {team}.', '¡Los {team} pueden robar el punto!',
  ],
  teamPoint: [
    '¡Muy bien, {team}!', '¡Punto para los {team}!', '¡Bravo, {team}!', '¡Genial, {team}!',
  ],
  kidPoint: ['¡Muy bien, {name}!', '¡Bravo, {name}!', '¡Genial, {name}!'],
  kidPicked: ['¡Sale {name}!', '¡Te toca, {name}!'],
  teamWin: [
    '¡Ganan los {team}!', '¡Victoria para los {team}!', '¡Los {team} son los campeones!',
  ],
  tie: ['¡Empate! ¡Todos sois campeones!', '¡Empate! ¡Qué igualdad!', '¡Empate! ¡Habéis jugado todos genial!'],
  xpShared: ['¡XP repartido! ¡Enhorabuena a todos!', '¡XP repartido! ¡Qué gran clase!', '¡Puntos repartidos! ¡Bien hecho, equipo!'],
  saved: ['¡Resultado guardado!'],
};

export const TEAM_NAMES = ['Dragones', 'Unicornios', 'Cohetes', 'Leones'] as const;

export function missionsText(n: number): string {
  return n === 1 ? 'una misión' : `${n} misiones`;
}

/** Placeholders with a finite set of values: the generator records every combination. */
export const ENUMERABLE: Record<string, readonly (string | number)[]> = {
  n: [3, 5, 10, 15, 20],
  level: Array.from({ length: 29 }, (_, i) => i + 2),
  kingdom: KINGDOMS.map((k) => k.name),
  sticker: STICKERS.map((s) => s.name),
  missions: Array.from({ length: 10 }, (_, i) => missionsText(i + 1)),
  team: TEAM_NAMES,
};

const PLACEHOLDER = /\{(\w+)\}/g;

export function placeholders(template: string): string[] {
  return [...template.matchAll(PLACEHOLDER)].map((m) => m[1]);
}

/** Fill a template. Returns null when a placeholder has no value. */
export function render(template: string, vars: Vars = {}): string | null {
  let missing = false;
  const out = template.replace(PLACEHOLDER, (_, k: string) => {
    if (vars[k] === undefined || vars[k] === '') { missing = true; return ''; }
    return String(vars[k]);
  });
  return missing ? null : out;
}

/** Every text a template can produce using only enumerable values (for pre-recording). */
export function expand(template: string): string[] {
  const keys = [...new Set(placeholders(template))];
  if (keys.some((k) => !ENUMERABLE[k])) return [];
  let combos: Vars[] = [{}];
  for (const k of keys) combos = combos.flatMap((c) => ENUMERABLE[k].map((v) => ({ ...c, [k]: v })));
  return combos.map((c) => render(template, c)!);
}

/** What is actually spoken: no emoji, collapsed spaces. */
export function cleanForSpeech(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Stable file id for a spoken text (FNV-1a, base36). Shared by generator and player. */
export function clipId(text: string): string {
  const s = cleanForSpeech(text);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * Choose a random candidate that was not said recently.
 * `recent` holds the last texts said for this cue (most recent last) and is updated in place.
 */
export function pickFresh(candidates: readonly string[], recent: string[], rnd: () => number = Math.random): string {
  if (candidates.length === 0) return '';
  const memory = Math.min(8, Math.floor(candidates.length / 2));
  const blocked = new Set(recent.slice(-memory));
  const pool = memory > 0 ? candidates.filter((c) => !blocked.has(c)) : candidates;
  const choice = (pool.length ? pool : candidates)[Math.floor(rnd() * (pool.length || candidates.length))];
  recent.push(choice);
  if (recent.length > 16) recent.splice(0, recent.length - 16);
  return choice;
}

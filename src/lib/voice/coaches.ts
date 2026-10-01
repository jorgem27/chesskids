// Potróculo's voices: the mascot is always Potróculo, but he can speak as a pirate, a robot,
// a cheerleader, a serious coach… Each voice = an Edge TTS voice + speed/pitch/effect + its own
// themed lines (mixed with the shared ones in phrases.ts).
// Pre-recorded clips live in public/voices/<id>/ (made by `npm run voices`); anything not
// recorded falls back to the browser's speechSynthesis using `web`.
//
// To add a voice: add an entry here, run `npm run voices -- <id>`, commit public/voices/<id>.
// Ids are stored in students.voice: never rename one, add a new id instead.

import type { Cue } from './phrases';

export interface CoachTts {
  engine: 'edge';
  voice: string;   // `python -m edge_tts --list-voices`
  rate: string;    // e.g. '+10%'
  pitch: string;   // e.g. '+15Hz'
  filter?: string; // extra ffmpeg audio filter (echo, robot…)
}

export interface Coach {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  gradient: string; // tailwind classes for the picker card
  image?: string;   // portrait in public/potroculo/ (made from assets/potroculo/)
  tts: CoachTts;
  web: { pitch: number; rate: number; male: boolean };
  intro: readonly string[];
  /** Themed lines per cue; one of them is said instead of a shared line `flavor` of the time (0-1). */
  extra?: Partial<Record<Cue, readonly string[]>>;
  flavor: number;
}

const ROBOT = "afftfilt=real='hypot(re,im)*sin(0)':imag='hypot(re,im)*cos(0)':win_size=512:overlap=0.75,volume=1.6";
const SHIP = 'aecho=0.8:0.5:30:0.15';
const CASTLE = 'aecho=0.8:0.6:45:0.22';

export const COACHES: readonly Coach[] = [
  {
    id: 'clasico', name: 'Clásico', emoji: '🎩', tagline: 'Un caballero muy elegante',
    gradient: 'from-amber-500 to-orange-700', image: '/potroculo/clasico.webp',
    tts: { engine: 'edge', voice: 'es-ES-AlvaroNeural', rate: '+5%', pitch: '+6Hz' },
    web: { pitch: 1.05, rate: 1, male: true },
    intro: ['¡Saludos! Soy Potróculo, a tu servicio. ¿Jugamos una partida elegante?'],
    flavor: 0.3,
    extra: {
      correct: ['¡Espléndido!', '¡Una jugada muy distinguida!', '¡Exquisito!', '¡Magnífico, sí señor!', '¡Qué elegancia!', '¡Formidable!'],
      perfect: ['¡Sublime! ¡Me quito el sombrero!', '¡Una obra de arte sobre el tablero!', '¡Brillante, absolutamente brillante!'],
      wrong: ['Casi, casi. Ajustemos el monóculo y miremos otra vez.', 'Con calma y elegancia, otra vez.', 'Ni el mejor caballero acierta siempre. ¡Otra!'],
      start: ['¡Que comience la partida!', 'Monóculo listo. ¡Empezamos!'],
      resultsPerfect: ['¡Impecable! ¡Me quito el sombrero!'],
      resultsGood: ['¡Muy bien jugado, sí señor!'],
      resultsOk: ['Buen esfuerzo. La elegancia llega practicando.'],
    },
  },
  {
    id: 'pirata', name: 'Pirata', emoji: '🏴‍☠️', tagline: '¡Arrr! Al abordaje',
    gradient: 'from-slate-700 to-red-700', image: '/potroculo/pirata.webp',
    tts: { engine: 'edge', voice: 'es-ES-AlvaroNeural', rate: '-6%', pitch: '-18Hz', filter: SHIP },
    web: { pitch: 0.75, rate: 0.95, male: true },
    intro: ['¡Arrr! ¡Hoy Potróculo navega como pirata! ¡Al abordaje, grumete!'],
    flavor: 0.6,
    extra: {
      correct: ['¡Arrr! ¡Buena jugada, grumete!', '¡Al abordaje!', '¡Eso vale un cofre de oro!', '¡Por mil barriles!', '¡Tierra a la vista!', '¡Viento en popa!', '¡Arrr, qué jugadón!', '¡Así navega un buen pirata!', '¡Doblones para ti!', '¡Buen rumbo, grumete!'],
      perfect: ['¡Tesoro encontrado!', '¡Por todos los mares, qué jugada!', '¡Eres el terror de los siete mares!', '¡Arrr! ¡Botín completo!'],
      wrong: ['¡Arrr, casi! Ajusta el rumbo.', '¡Al agua! Bueno… ¡otra vez!', 'Que no cunda el pánico, grumete. ¡Otra!', '¡Vira a babor y prueba de nuevo!', 'Ese mapa no lleva al tesoro. ¡Otra!', '¡Arrr! Mira bien el mapa.'],
      streak: ['¡Viento a favor! ¡Racha pirata!', '¡Arrr, no hay quien pare este barco!', '¡A toda vela!'],
      start: ['¡Levad anclas!', '¡Arrr! ¡Zarpamos!', '¡Todos a cubierta!'],
      resultsPerfect: ['¡Arrr! ¡Todo el botín es tuyo!', '¡Tres estrellas para la tripulación!'],
      resultsGood: ['¡Buena travesía, grumete!', '¡Arrr! ¡Misión pirata cumplida!'],
      resultsOk: ['Todo pirata empieza como grumete. ¡A seguir navegando!', '¡La próxima travesía será mejor!'],
      levelUp: ['¡Arrr! ¡Subes de rango, grumete!'],
    },
  },
  {
    id: 'robo', name: 'Robot', emoji: '🤖', tagline: 'Bip bup, modo ajedrez',
    gradient: 'from-cyan-400 to-violet-600', image: '/potroculo/robo.webp',
    tts: { engine: 'edge', voice: 'es-MX-JorgeNeural', rate: '+0%', pitch: '-5Hz', filter: ROBOT },
    web: { pitch: 0.6, rate: 0.95, male: true },
    intro: ['Bip, bup. Potróculo en modo robot. Mis circuitos están listos para jugar.'],
    flavor: 0.5,
    extra: {
      correct: ['Bip bup. Jugada correcta.', '¡Procesando… genial!', 'Cálculo perfecto. Bip.', 'Análisis completado: ¡muy bien!', 'Bip, bip. Nivel de genialidad alto.', 'Jugada validada. Bup.', '¡Mis luces se encienden de alegría!'],
      perfect: ['¡Error cero! ¡Sistema feliz!', '¡Precisión del cien por cien!', '¡Sobrecarga de genialidad! Bip bup.'],
      wrong: ['Bip. Recalculando. Prueba otra vez.', 'Error detectado. No pasa nada: reiniciando.', 'Bup. Esa no. Escaneando otra opción.', 'Mis sensores dicen: ¡casi!'],
      streak: ['¡Modo turbo activado!', 'Racha detectada. Bip, bip, bip.'],
      start: ['Iniciando partida. Tres, dos, uno.', 'Sistemas listos. ¡A jugar!'],
      resultsPerfect: ['Resultado: perfecto. Bip bup.'],
      resultsGood: ['Misión completada. ¡Bip bup, bien hecho!'],
      resultsOk: ['Datos guardados. La próxima vez, más estrellas. Bip.'],
    },
  },
  {
    id: 'animadora', name: 'Animadora', emoji: '📣', tagline: '¡Ra, ra, ra, a ganar!',
    gradient: 'from-fuchsia-400 to-amber-400', image: '/potroculo/animadora.webp',
    tts: { engine: 'edge', voice: 'es-ES-XimenaNeural', rate: '+14%', pitch: '+28Hz' },
    web: { pitch: 1.4, rate: 1.15, male: false },
    intro: ['¡Hola, hola! ¡Potróculo en modo animadora! ¡Vamos, vamos, vamos!'],
    flavor: 0.6,
    extra: {
      correct: ['¡Vamos, vamos, vamos!', '¡Ra, ra, ra, qué bien juegas!', '¡Bieeen!', '¡Eres la estrella del tablero!', '¡Uy, qué jugadón! ¡Bravo!', '¡Así se hace, sí, sí, sí!', '¡Dame una J! ¡Jugadón!', '¡Aplausos para ti!', '¡Arriba, arriba!'],
      perfect: ['¡Increíble, increíble, increíble!', '¡Esto es un espectáculo!', '¡Hip, hip, hurra!', '¡Ole, ole y ole!'],
      wrong: ['¡No pasa nada! ¡Ánimo, ánimo!', '¡Tú puedes, tú puedes!', '¡Venga, que estoy contigo!', '¡Otra vez, con más ganas!'],
      streak: ['¡Racha, racha, racha!', '¡Nadie te para!', '¡Esto está que arde!'],
      start: ['¡Un, dos, tres, a jugar!', '¡Que empiece el espectáculo!', '¡Vamos con todo!'],
      resultsPerfect: ['¡Tres estrellas! ¡Hip, hip, hurra!'],
      resultsGood: ['¡Bravo, bravo! ¡Lo has conseguido!'],
      resultsOk: ['¡Ánimo! ¡La próxima vamos a por todas!'],
    },
  },
  {
    id: 'entrenador', name: 'Entrenador', emoji: '📋', tagline: 'Serio y concentrado',
    gradient: 'from-blue-700 to-slate-800', image: '/potroculo/entrenador.webp',
    tts: { engine: 'edge', voice: 'es-ES-AlvaroNeural', rate: '-8%', pitch: '-6Hz' },
    web: { pitch: 0.9, rate: 0.9, male: true },
    intro: ['Hola. Soy Potróculo, tu entrenador. Concentración y a jugar con cabeza.'],
    flavor: 0.85,
    extra: {
      correct: ['Correcto.', 'Bien jugado.', 'Buena decisión.', 'Esa es la jugada correcta.', 'Bien calculado.', 'Así se juega con cabeza.', 'Has visto la idea. Bien.', 'Jugada sólida.', 'Precisa. Muy bien.', 'Eso es técnica.', 'Buen trabajo. Sigue así.', 'Exacto. Continúa.'],
      perfect: ['Excelente. Sin errores.', 'Precisión total.', 'Eso es nivel de torneo.', 'Muy bien calculado. Impecable.'],
      wrong: ['No es la mejor. Vuelve a calcular.', 'Revisa las amenazas del rival.', 'Tómate tu tiempo y calcula.', 'Todavía no. Piensa la siguiente.', 'Casi. Mira todas las opciones.', 'Con calma. Analiza otra vez.'],
      streak: ['Buena racha. Mantén la concentración.', 'Constancia. Así se mejora.'],
      start: ['Concentración. Empezamos.', 'Calienta la mente. Vamos.', 'Mira el tablero con calma. Adelante.'],
      resultsPerfect: ['Sesión perfecta. Excelente trabajo.', 'Tres estrellas. Así se entrena.'],
      resultsGood: ['Buen entrenamiento. Sigue así.', 'Bien trabajado. Repasa los fallos y mejorarás.'],
      resultsOk: ['Entrenar es esto: practicar y mejorar.', 'Repasa lo que has fallado. La próxima sale mejor.'],
      levelUp: ['Nuevo nivel. El trabajo da resultados.'],
    },
  },
  {
    id: 'caballero', name: 'Caballero', emoji: '🛡️', tagline: 'Noble guardián del tablero',
    gradient: 'from-slate-500 to-indigo-700',
    tts: { engine: 'edge', voice: 'es-CO-GonzaloNeural', rate: '-5%', pitch: '-8Hz', filter: CASTLE },
    web: { pitch: 0.85, rate: 0.9, male: true },
    intro: ['Saludos. Hoy Potróculo es un caballero del tablero. ¡Te acompañaré en cada partida!'],
    flavor: 0.45,
    extra: {
      correct: ['¡Por el rey y la dama!', '¡Digno de un caballero!', '¡Noble jugada!', '¡Por el honor del tablero!', '¡Bien jugado, valiente!'],
      perfect: ['¡Hazaña legendaria!', '¡Los juglares cantarán esta jugada!'],
      wrong: ['Hasta los caballeros tropiezan. ¡Inténtalo otra vez!', 'Escudo arriba y otra vez.'],
      start: ['¡A la partida!', '¡Que suenen las trompetas!'],
      resultsPerfect: ['¡Victoria digna de una leyenda!'],
    },
  },
];

/** Valid values for students.voice and the projector setting. */
export const VOICE_PREFS: readonly string[] = [...COACHES.map((c) => c.id), 'random', 'none'];

export function coachById(id: string | null | undefined): Coach | undefined {
  return COACHES.find((c) => c.id === id);
}

/** Every template this coach can say for a cue (shared bank + its own lines). */
export function coachTemplates(coach: Coach | undefined, cue: Cue, bank: readonly string[]): readonly string[] {
  const extra = coach?.extra?.[cue];
  return extra ? [...bank, ...extra] : bank;
}

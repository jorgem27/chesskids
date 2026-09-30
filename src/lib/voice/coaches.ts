// The "AI coaches": each one is a voice + personality that says the lines in phrases.ts.
// Pre-recorded clips live in public/voices/<id>/ (made by `npm run voices`); anything not
// recorded falls back to the browser's speechSynthesis using `web`.
//
// To add a coach: add an entry here, run `npm run voices -- <id>`, commit public/voices/<id>.

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
  tts: CoachTts;
  web: { pitch: number; rate: number; male: boolean };
  intro: readonly string[];
  extra?: Partial<Record<Cue, readonly string[]>>;
}

const ROBOT = "afftfilt=real='hypot(re,im)*sin(0)':imag='hypot(re,im)*cos(0)':win_size=512:overlap=0.75,volume=1.6";
const CASTLE = 'aecho=0.8:0.6:45:0.22';

export const COACHES: readonly Coach[] = [
  {
    id: 'elvira', name: 'Profe Elvira', emoji: '👩‍🏫', tagline: 'Cariñosa y paciente',
    gradient: 'from-rose-400 to-pink-500',
    tts: { engine: 'edge', voice: 'es-ES-ElviraNeural', rate: '+5%', pitch: '+10Hz' },
    web: { pitch: 1.15, rate: 0.95, male: false },
    intro: ['¡Hola! Soy la profe Elvira. Vamos a aprender ajedrez, paso a paso.'],
    extra: {
      correct: ['¡Qué orgullosa estoy!', '¡Eso es, cariño!'],
      wrong: ['Tranquilidad, que lo miramos juntos.', 'Sin prisa, que aquí se aprende.'],
    },
  },
  {
    id: 'alvaro', name: 'Capitán Álvaro', emoji: '🧑‍✈️', tagline: '¡Lleno de energía!',
    gradient: 'from-sky-400 to-blue-600',
    tts: { engine: 'edge', voice: 'es-ES-AlvaroNeural', rate: '+10%', pitch: '+5Hz' },
    web: { pitch: 1.05, rate: 1.05, male: true },
    intro: ['¡Hola, grumete! Soy el capitán Álvaro. ¡Rumbo a la victoria!'],
    extra: {
      correct: ['¡A toda vela!', '¡Así navega un buen capitán!'],
      perfect: ['¡Tesoro encontrado!'],
      wrong: ['¡Ajusta el timón y otra vez!'],
      start: ['¡Levad anclas!'],
    },
  },
  {
    id: 'ximena', name: 'Ximena Relámpago', emoji: '⚡', tagline: 'Rápida como un rayo',
    gradient: 'from-amber-400 to-orange-500',
    tts: { engine: 'edge', voice: 'es-ES-XimenaNeural', rate: '+18%', pitch: '+20Hz' },
    web: { pitch: 1.3, rate: 1.15, male: false },
    intro: ['¡Hola! Soy Ximena Relámpago. ¡Piensa rápido y juega mejor!'],
    extra: {
      correct: ['¡Zas! ¡Como un rayo!', '¡Rapidísimo!'],
      streak: ['¡Relámpago total!'],
      wrong: ['¡Frena un segundo y mira otra vez!'],
    },
  },
  {
    id: 'gonzalo', name: 'Sir Gonzalo', emoji: '🛡️', tagline: 'Caballero del tablero',
    gradient: 'from-slate-500 to-indigo-700',
    tts: { engine: 'edge', voice: 'es-CO-GonzaloNeural', rate: '-5%', pitch: '-8Hz', filter: CASTLE },
    web: { pitch: 0.85, rate: 0.9, male: true },
    intro: ['Saludos. Soy Sir Gonzalo, caballero del tablero. ¡Te acompañaré en cada partida!'],
    extra: {
      correct: ['¡Por el rey y la dama!', '¡Digno de un caballero!'],
      perfect: ['¡Hazaña legendaria!'],
      wrong: ['Hasta los caballeros tropiezan. ¡Inténtalo otra vez!'],
      start: ['¡A la partida!'],
    },
  },
  {
    id: 'dalia', name: 'Dalia la Dragona', emoji: '🐉', tagline: 'Una dragona muy divertida',
    gradient: 'from-emerald-400 to-teal-600',
    tts: { engine: 'edge', voice: 'es-MX-DaliaNeural', rate: '+8%', pitch: '+12Hz' },
    web: { pitch: 1.2, rate: 1, male: false },
    intro: ['¡Hola! Soy Dalia, la dragona del ajedrez. ¡Vamos a jugar con fuego!'],
    extra: {
      correct: ['¡Fuego, fuego!', '¡Eso sí que quema!'],
      streak: ['¡Llamarada de jugadas!'],
      wrong: ['¡Uy, se me apagó la llama! Otra vez.'],
    },
  },
  {
    id: 'robo', name: 'Robo-Peón', emoji: '🤖', tagline: 'Un robot que adora el ajedrez',
    gradient: 'from-cyan-400 to-violet-600',
    tts: { engine: 'edge', voice: 'es-MX-JorgeNeural', rate: '+0%', pitch: '-5Hz', filter: ROBOT },
    web: { pitch: 0.6, rate: 0.95, male: true },
    intro: ['Bip, bup. Soy Robo-Peón. Mis circuitos están listos para jugar.'],
    extra: {
      correct: ['Bip bup. Jugada correcta.', '¡Procesando… genial!'],
      perfect: ['¡Error cero! ¡Sistema feliz!'],
      wrong: ['Bip. Recalculando. Prueba otra vez.'],
    },
  },
];

export function coachById(id: string | null | undefined): Coach | undefined {
  return COACHES.find((c) => c.id === id);
}

/** Every template this coach can say for a cue (shared bank + its own lines). */
export function coachTemplates(coach: Coach | undefined, cue: Cue, bank: readonly string[]): readonly string[] {
  const extra = coach?.extra?.[cue];
  return extra ? [...bank, ...extra] : bank;
}

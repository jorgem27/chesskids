import { useEffect, useState } from 'preact/hooks';
import { sfx } from '../../lib/sfx';
import { COACHES, coachById } from '../../lib/voice/coaches';
import { currentCoach, getCoachPref, setCoachPref, speak, useVoiceId, type CoachPref } from '../../lib/voice/player';
import { Potroculo } from '../ui/Potroculo';

const OPTIONS = [
  ...COACHES.map((c) => ({ id: c.id, emoji: c.emoji, image: c.image, name: c.name, tagline: c.tagline, circle: `bg-gradient-to-br ${c.gradient} shadow` })),
  { id: 'random', emoji: '🎲', name: 'Sorpresa', tagline: 'Una distinta cada vez', circle: 'bg-gradient-to-br from-fuchsia-400 to-violet-600 shadow' },
  { id: 'none', emoji: '🔕', name: 'Sin voz', tagline: 'Solo sonidos', circle: 'bg-slate-200' },
];

/**
 * Choose Potróculo's voice. Students: saved on their account; coaches (projector): on this device.
 * `compact` is the smaller version used inside the projector setup.
 */
export default function CoachPicker({ compact = false }: { compact?: boolean }) {
  const [pref, setPref] = useState<CoachPref>(''); // real choice is read after hydration
  const [error, setError] = useState('');
  const voiceId = useVoiceId();
  useEffect(() => setPref(getCoachPref()), []);

  async function choose(p: CoachPref) {
    sfx.unlock();
    sfx.tap();
    const before = pref;
    setPref(p);
    setError('');
    try { await setCoachPref(p); } catch {
      setPref(before);
      setError('Uy, no se pudo guardar. ¿Tienes internet?');
      return;
    }
    const c = currentCoach();
    if (c) speak(c.intro[0]); // with 'random', the coach picked for this session introduces itself
  }

  const chosen = pref === 'random' ? 'Sorpresa' : pref === 'none' ? 'Sin voz' : coachById(pref)?.name;
  const title = compact ? 'Voz de Potróculo' : 'La voz de Potróculo';

  return (
    <section class={compact ? '' : 'ck-card mt-6'}>
      <div class="mb-3 flex items-center gap-3">
        {!compact && <Potroculo costume={voiceId} mood="wave" size={72} class="shrink-0" />}
        <div>
          <h2 id="coach-picker" class={`font-display font-extrabold ${compact ? 'text-lg' : 'text-2xl'}`}><span aria-hidden="true">🎙️</span> {title}</h2>
          <p class={`text-sm font-bold ${compact ? 'opacity-80' : 'text-slate-600'}`}>
            {compact ? 'Cómo os anima Potróculo en clase.' : 'Elige cómo te anima Potróculo mientras juegas. ¡Toca una voz para escucharla!'}
          </p>
        </div>
      </div>
      <div role="group" aria-labelledby="coach-picker" class={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${compact ? 'md:grid-cols-4 xl:grid-cols-8' : 'md:grid-cols-4'}`}>
        {OPTIONS.map((o) => {
          const active = pref === o.id;
          return (
            <button key={o.id} type="button" onClick={() => choose(o.id)} aria-pressed={active}
              class={`relative flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 p-3 text-center transition motion-safe:active:scale-95 ${
                active ? 'border-violet-500 bg-violet-50 ring-4 ring-violet-200' : 'border-slate-100 bg-white motion-safe:hover:-translate-y-0.5'
              }`}>
              {active && <span aria-hidden="true" class="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-sm font-black text-white">✓</span>}
              {'image' in o && o.image
                ? <img src={o.image} alt="" width={80} height={80} loading="lazy" class="h-20 w-20 rounded-2xl object-cover shadow" />
                : <span aria-hidden="true" class={`flex h-20 w-20 items-center justify-center rounded-2xl text-4xl ${o.circle}`}>{o.emoji}</span>}
              <span class="font-display text-base font-extrabold leading-tight text-slate-800">{o.name}</span>
              <span class="text-sm font-bold leading-tight text-slate-600">{o.tagline}</span>
            </button>
          );
        })}
      </div>
      {error && <p role="alert" class="mt-2 text-sm font-bold text-rose-600">{error}</p>}
      <p class="sr-only" aria-live="polite">{chosen ? `Voz elegida: ${chosen}` : ''}</p>
    </section>
  );
}

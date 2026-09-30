import { useEffect, useState } from 'preact/hooks';
import { sfx } from '../../lib/sfx';
import { COACHES, coachById } from '../../lib/voice/coaches';
import { currentCoach, getCoachPref, setCoachPref, speak, type CoachPref } from '../../lib/voice/player';

const OPTIONS = [
  ...COACHES.map((c) => ({ id: c.id, emoji: c.emoji, name: c.name, tagline: c.tagline, circle: `bg-gradient-to-br ${c.gradient} shadow` })),
  { id: 'random', emoji: '🎲', name: 'Sorpresa', tagline: 'Uno distinto cada vez', circle: 'bg-gradient-to-br from-fuchsia-400 to-violet-600 shadow' },
  { id: 'none', emoji: '🔕', name: 'Sin voz', tagline: 'Solo sonidos', circle: 'bg-slate-200' },
];

/** Lets a student choose which AI coach cheers them on (saved on this device). */
export default function CoachPicker() {
  const [pref, setPref] = useState<CoachPref>(''); // real choice is in localStorage: read after hydration
  useEffect(() => setPref(getCoachPref()), []);

  async function choose(p: CoachPref) {
    sfx.unlock();
    sfx.tap();
    setPref(p);
    try { await setCoachPref(p); } catch { /* clips unavailable: browser voice still works */ }
    const c = currentCoach();
    if (c) speak(c.intro[0]); // with 'random', the coach picked for this session introduces itself
  }

  const chosen = pref === 'random' ? 'Sorpresa' : pref === 'none' ? 'Sin voz' : coachById(pref)?.name;

  return (
    <section class="ck-card mt-6">
      <h2 id="coach-picker" class="font-display text-2xl font-extrabold"><span aria-hidden="true">🎙️</span> Tu entrenador</h2>
      <p class="mb-3 text-sm font-bold text-slate-600">Elige quién te anima mientras juegas. ¡Tócalo para escucharlo!</p>
      <div role="group" aria-labelledby="coach-picker" class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {OPTIONS.map((o) => {
          const active = pref === o.id;
          return (
            <button key={o.id} type="button" onClick={() => choose(o.id)} aria-pressed={active}
              class={`relative flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 p-3 text-center transition motion-safe:active:scale-95 ${
                active ? 'border-violet-500 bg-violet-50 ring-4 ring-violet-200' : 'border-slate-100 bg-white motion-safe:hover:-translate-y-0.5'
              }`}>
              {active && <span aria-hidden="true" class="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-sm font-black text-white">✓</span>}
              <span aria-hidden="true" class={`flex h-14 w-14 items-center justify-center rounded-full text-3xl ${o.circle}`}>{o.emoji}</span>
              <span class="font-display text-base font-extrabold leading-tight text-slate-800">{o.name}</span>
              <span class="text-sm font-bold leading-tight text-slate-600">{o.tagline}</span>
            </button>
          );
        })}
      </div>
      <p class="sr-only" aria-live="polite">{chosen ? `Entrenador elegido: ${chosen}` : ''}</p>
    </section>
  );
}

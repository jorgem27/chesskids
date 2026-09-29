import { useEffect, useState } from 'preact/hooks';
import { PIN_EMOJIS, PIN_NAMES } from '../../lib/catalog';
import { burst, speak } from '../../lib/fx';
import { rememberProfile } from '../../lib/recent';
import { sfx, vibrate } from '../../lib/sfx';

interface Kid { id: number; name: string; avatar: string }
interface Props { code: string; className: string; classEmoji: string; students: Kid[]; preselect: number | null }

export default function AvatarPinLogin({ code, className, classEmoji, students, preselect }: Props) {
  const [kid, setKid] = useState<Kid | null>(students.find((s) => s.id === preselect) ?? null);
  const [pin, setPin] = useState<string[]>([]);
  const [shake, setShake] = useState(false);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);

  useEffect(() => { if (kid) speak(`Hola ${kid.name}. Toca tus tres dibujos secretos.`); }, [kid?.id]);

  async function submit(p: string[]) {
    const res = await fetch('/api/auth/pin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, studentId: kid!.id, pin: p.join('') }) });
    if (res.ok) {
      setOk(true);
      sfx.levelUp();
      burst(0.5, 0.4, 1.3);
      rememberProfile({ id: kid!.id, name: kid!.name, avatar: kid!.avatar, code });
      setTimeout(() => (location.href = '/app?hola=1'), 1300);
      return;
    }
    const body = await (res.json() as Promise<any>).catch(() => ({}));
    sfx.wrong();
    vibrate([80, 60, 80]);
    setShake(true);
    setMsg(body.error ?? '¡Uy! Prueba otra vez');
    setTimeout(() => { setShake(false); setPin([]); }, 600);
  }

  function press(e: string) {
    if (pin.length >= 3 || ok) return;
    sfx.pop();
    setMsg('');
    const p = [...pin, e];
    setPin(p);
    if (p.length === 3) setTimeout(() => submit(p), 250);
  }

  if (!kid) {
    return (
      <div class="min-h-dvh bg-gradient-to-b from-sky-200 via-violet-100 to-fuchsia-100 px-4 py-6">
        <div class="mx-auto max-w-4xl">
          <a href="/entrar" class="text-sm font-bold text-violet-700">← Volver</a>
          <div class="mt-2 text-center">
            <span class="text-5xl">{classEmoji}</span>
            <h1 class="font-display text-4xl font-extrabold text-violet-800">{className}</h1>
            <p class="font-bold text-slate-600">¿Quién eres? Toca tu animal</p>
          </div>
          <div class="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {students.map((s, i) => (
              <button key={s.id} onClick={() => { sfx.tap(); setKid(s); }}
                class="ck-card ck-rise flex flex-col items-center !p-3 transition hover:-translate-y-1" style={{ animationDelay: `${i * 0.04}s` }}>
                <span class="text-6xl md:text-7xl">{s.avatar}</span>
                <span class="mt-1 w-full truncate text-center font-display text-lg font-extrabold">{s.name}</span>
              </button>
            ))}
          </div>
          {!students.length && <p class="ck-card mt-6 text-center">Esta clase aún no tiene alumnos.</p>}
        </div>
      </div>
    );
  }

  return (
    <div class="flex min-h-dvh flex-col items-center bg-gradient-to-b from-sky-200 via-violet-100 to-fuchsia-100 px-4 py-6">
      <button onClick={() => { setKid(null); setPin([]); setMsg(''); }} class="self-start text-sm font-bold text-violet-700">← No soy yo</button>
      <div class={`mt-2 text-8xl ${ok ? 'animate-bounce' : 'ck-float'}`}>{kid.avatar}</div>
      <h1 class="font-display text-4xl font-extrabold text-violet-800">{ok ? `¡Hola, ${kid.name}!` : kid.name}</h1>
      <p class="mb-4 font-bold text-slate-600">{ok ? '¡Vamos allá! 🚀' : 'Toca tus 3 dibujos secretos'}</p>

      <div class={`mb-5 flex gap-3 ${shake ? 'ck-shake' : ''}`}>
        {[0, 1, 2].map((i) => (
          <div key={i} class={`flex h-20 w-20 items-center justify-center rounded-2xl border-4 text-5xl ${pin[i] ? 'border-violet-500 bg-white' : 'border-dashed border-violet-300 bg-white/50'} ${ok ? 'border-emerald-500 bg-emerald-50' : ''}`}>
            {pin[i] && <span style="animation: ck-pop .25s ease-out">{pin[i]}</span>}
          </div>
        ))}
      </div>
      {msg && <p class="mb-3 rounded-2xl bg-rose-100 px-4 py-2 font-bold text-rose-700">{msg}</p>}

      <div class="grid w-full max-w-sm grid-cols-3 gap-3">
        {PIN_EMOJIS.map((e) => (
          <button key={e} onClick={() => press(e)} aria-label={PIN_NAMES[e]}
            class="ck-btn aspect-square !rounded-3xl bg-white !p-0 text-5xl active:scale-95 md:text-6xl">{e}</button>
        ))}
      </div>
      <button disabled={!pin.length || ok} onClick={() => setPin(pin.slice(0, -1))} class="mt-4 font-bold text-slate-500 disabled:opacity-30">⌫ Borrar</button>
      <p class="mt-6 max-w-sm text-center text-xs text-slate-500">Este dispositivo recordará que eres tú. ¿No te acuerdas de tus dibujos? Pregunta a tu profe.</p>
    </div>
  );
}

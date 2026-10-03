import { useEffect, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { Modal } from '../ui/Modal';
import { loadPrefs, savePrefs, type A11yPrefs } from '../../lib/a11y';
import { isMuted, setMuted, sfx } from '../../lib/sfx';

type PushState = 'unsupported' | 'off' | 'on' | 'denied' | 'busy';

const b64ToBytes = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

async function swRegistration() {
  return (await navigator.serviceWorker.getRegistration('/')) ?? navigator.serviceWorker.register('/sw.js');
}

function Toggle({ icon, label, hint, on, onChange, disabled = false }: { icon: string; label: string; hint: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)}
      class={`flex min-h-14 w-full items-center gap-3 rounded-2xl p-3 text-left transition ${on ? 'bg-brand-50 ring-2 ring-brand-400' : 'bg-slate-50'} disabled:opacity-50`}>
      <span class="text-3xl" aria-hidden="true">{icon}</span>
      <span class="min-w-0 flex-1">
        <span class="block font-display font-extrabold">{label}</span>
        <span class="block text-xs text-slate-600">{hint}</span>
      </span>
      <span class={`relative h-8 w-14 shrink-0 rounded-full transition ${on ? 'bg-brand-600' : 'bg-slate-300'}`} aria-hidden="true">
        <span class={`absolute top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-black shadow transition-all ${on ? 'left-7 text-brand-700' : 'left-1'}`}>{on ? '✓' : ''}</span>
      </span>
      <span class="w-7 shrink-0 text-sm font-extrabold" aria-hidden="true">{on ? 'Sí' : 'No'}</span>
    </button>
  );
}

/** ⚙️ Ajustes for students: accessibility (per device), sound and the opt-in streak reminder. */
export default function Settings() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<A11yPrefs>({ motion: false, text: false, contrast: false });
  const [sound, setSound] = useState(true);
  const [push, setPush] = useState<PushState>('unsupported');
  const [pushKey, setPushKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setPrefs(loadPrefs());
    setSound(!isMuted());
    setMsg(null);
    void (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return setPush('unsupported');
      const r = await fetch('/api/push').then((x) => x.json() as Promise<{ key: string | null }>).catch(() => ({ key: null }));
      if (!r.key) return setPush('unsupported');
      setPushKey(r.key);
      if (Notification.permission === 'denied') return setPush('denied');
      const reg = await navigator.serviceWorker.getRegistration('/');
      setPush((await reg?.pushManager.getSubscription()) ? 'on' : 'off');
    })();
  }, [open]);

  const set = (p: Partial<A11yPrefs>) => { const next = { ...prefs, ...p }; setPrefs(next); savePrefs(next); };

  async function togglePush(want: boolean) {
    setMsg(null);
    setPush('busy');
    try {
      const reg = await swRegistration();
      await navigator.serviceWorker.ready;
      const current = await reg.pushManager.getSubscription();
      if (!want) {
        if (current) {
          await fetch('/api/push', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: current.endpoint }) });
          await current.unsubscribe();
        }
        return setPush('off');
      }
      if ((await Notification.requestPermission()) !== 'granted') return setPush('denied');
      const sub = current ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(pushKey!) });
      const res = await fetch('/api/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      if (!res.ok) throw new Error();
      setPush('on');
      setMsg({ ok: true, text: '🔔 ¡Listo! Si un día no has jugado, te avisaremos por la tarde para que no pierdas tu racha.' });
    } catch {
      setPush('off');
      setMsg({ ok: false, text: 'Uy, no se han podido activar los avisos en este dispositivo.' });
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/10 text-xl" aria-label="Ajustes" title="Ajustes">⚙️</button>
      {/* Portal: the button lives in the sticky header, whose stacking context and white text would trap the dialog. */}
      {open && createPortal(<Modal open onClose={() => setOpen(false)}>
        <h2 class="font-display text-2xl font-extrabold">⚙️ Ajustes</h2>
        <p class="mb-4 text-sm text-slate-500">Se guardan en este dispositivo.</p>
        <div class="space-y-2">
          <Toggle icon="🔊" label="Sonido y voz" hint="Efectos y la voz de Potróculo" on={sound}
            onChange={(v) => { setSound(v); setMuted(!v); if (v) sfx.coin(); }} />
          <Toggle icon="🐢" label="Menos animaciones" hint="Sin confeti ni cosas que se mueven" on={prefs.motion} onChange={(v) => set({ motion: v })} />
          <Toggle icon="🔠" label="Letra grande" hint="Todo se ve más grande" on={prefs.text} onChange={(v) => set({ text: v })} />
          <Toggle icon="🌓" label="Alto contraste" hint="Colores más fuertes y bordes marcados" on={prefs.contrast} onChange={(v) => set({ contrast: v })} />
          {push !== 'unsupported' && (
            <Toggle icon="🔔" label="Avisarme de mi racha" hint={push === 'denied' ? 'Los avisos están bloqueados. Pídele a un adulto que los active.' : push === 'busy' ? 'Un momento…' : 'Un aviso por la tarde si aún no has jugado. Pide permiso a un adulto.'}
              on={push === 'on'} disabled={push === 'busy' || push === 'denied'} onChange={(v) => void togglePush(v)} />
          )}
        </div>
        <p role="status" aria-live="polite" class={msg ? `mt-3 rounded-xl p-3 text-sm font-bold ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}` : 'sr-only'}>{msg?.text ?? ''}</p>
        <p class="mt-4 text-xs text-slate-500"><a href="/privacidad" class="font-bold text-brand-700 underline">Privacidad</a> · Los avisos no envían ningún dato tuyo.</p>
      </Modal>, document.body)}
    </>
  );
}

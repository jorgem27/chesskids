import { useEffect, useRef, useState } from 'preact/hooks';
import { getRecent, type RecentProfile } from '../../lib/recent';
import { sfx } from '../../lib/sfx';
import { Potroculo } from '../ui/Potroculo';

type View = 'home' | 'code' | 'password' | 'scan';

export default function LoginHub({ error }: { error?: string | null }) {
  const [view, setView] = useState<View>('home');
  const [recent, setRecent] = useState<RecentProfile[]>([]);
  const [code, setCode] = useState('');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [msg, setMsg] = useState(error === 'enlace' ? 'Ese enlace ya no funciona. Pide uno nuevo a tu profe.' : error === 'codigo' ? 'No encontramos esa clase. Revisa el código.' : '');
  const [busy, setBusy] = useState(false);
  const canScan = typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices;

  useEffect(() => setRecent(getRecent()), []);

  function goCode(e?: Event) {
    e?.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length < 4) return setMsg('El código tiene 5 letras o números');
    sfx.tap();
    location.href = `/c/${encodeURIComponent(c)}`;
  }

  async function loginPassword(e: Event) {
    e.preventDefault();
    setBusy(true); setMsg('');
    const res = await fetch('/api/auth/password', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: user, password: pass }) });
    if (res.ok) { sfx.correct(); location.href = '/app?hola=1'; return; }
    sfx.wrong();
    setMsg((await (res.json() as Promise<any>).catch(() => ({}))).error ?? 'Error');
    setBusy(false);
  }

  const card = 'ck-card flex w-full items-center gap-4 text-left transition hover:-translate-y-0.5';

  return (
    <div class="flex min-h-dvh flex-col items-center bg-gradient-to-b from-violet-200 via-fuchsia-100 to-amber-100 px-4 py-8">
      <a href="/" class="self-start text-sm font-bold text-violet-700">← Inicio</a>
      <div><Potroculo size={110} mood="wave" /></div>
      <h1 class="mt-2 text-center font-display text-4xl font-extrabold text-violet-800">¡Hola, campeón!</h1>
      <p class="mb-6 text-center font-bold text-slate-600">¿Cómo quieres entrar?</p>
      {msg && <p class="mb-4 w-full max-w-md rounded-2xl bg-rose-100 p-3 text-center font-bold text-rose-700">{msg}</p>}

      <div class="w-full max-w-md space-y-3">
        {view === 'home' && (
          <>
            {recent.length > 0 && (
              <div class="ck-card">
                <p class="mb-3 font-display text-lg font-extrabold text-slate-700">¿Eres tú?</p>
                <div class="grid grid-cols-3 gap-3">
                  {recent.map((r) => (
                    <a key={r.id} href={`/c/${r.code}?s=${r.id}`} class="flex flex-col items-center rounded-2xl bg-violet-50 p-3 hover:bg-violet-100">
                      <span class="text-5xl">{r.avatar}</span>
                      <span class="mt-1 truncate text-sm font-bold">{r.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
            <button class={card} onClick={() => { sfx.tap(); setView('code'); }}>
              <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500 text-3xl">🔤</span>
              <span><b class="block font-display text-xl">Código de clase</b><span class="text-sm text-slate-500">Escribe el código que te dio tu profe</span></span>
            </button>
            <button class={card} onClick={() => { sfx.tap(); setView(canScan ? 'scan' : 'code'); if (!canScan) setMsg('Abre la cámara de tu móvil y apunta al código QR 📷'); }}>
              <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500 text-3xl">📷</span>
              <span><b class="block font-display text-xl">Escanear QR</b><span class="text-sm text-slate-500">Tu tarjeta o la pantalla de clase</span></span>
            </button>
            <button class={card} onClick={() => { sfx.tap(); setView('password'); }}>
              <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400 text-3xl">🔑</span>
              <span><b class="block font-display text-xl">Usuario y contraseña</b><span class="text-sm text-slate-500">Para entrar desde otro dispositivo</span></span>
            </button>
            <p class="pt-2 text-center text-sm text-slate-500">¿Te han mandado un enlace por WhatsApp? ¡Solo tócalo y entrarás directamente! 💬</p>
          </>
        )}

        {view === 'code' && (
          <form onSubmit={goCode} class="ck-card space-y-4 text-center">
            <p class="font-display text-2xl font-extrabold">Código de tu clase</p>
            <input autoFocus value={code} maxLength={6} onInput={(e) => setCode((e.target as HTMLInputElement).value.toUpperCase())}
              class="ck-input w-full text-center font-display text-4xl font-extrabold uppercase tracking-[0.4em]" placeholder="ABC12" autocomplete="off" autocapitalize="characters" />
            <button class="ck-btn ck-btn-primary w-full">Entrar ▶</button>
            <button type="button" class="text-sm font-bold text-slate-500" onClick={() => setView('home')}>← Volver</button>
          </form>
        )}

        {view === 'password' && (
          <form onSubmit={loginPassword} class="ck-card space-y-3">
            <p class="text-center font-display text-2xl font-extrabold">Usuario y contraseña</p>
            <input value={user} onInput={(e) => setUser((e.target as HTMLInputElement).value)} class="ck-input w-full text-lg" placeholder="usuario (ej: lucia.torre42)" autocomplete="username" autocapitalize="none" />
            <input value={pass} onInput={(e) => setPass((e.target as HTMLInputElement).value)} type="password" class="ck-input w-full text-lg" placeholder="contraseña" autocomplete="current-password" autocapitalize="none" />
            <button disabled={busy} class="ck-btn ck-btn-primary w-full">{busy ? '…' : 'Entrar ▶'}</button>
            <button type="button" class="block w-full text-sm font-bold text-slate-500" onClick={() => setView('home')}>← Volver</button>
          </form>
        )}

        {view === 'scan' && <Scanner onBack={() => setView('home')} onError={(m) => { setMsg(m); setView('code'); }} />}
      </div>
    </div>
  );
}

function Scanner({ onBack, onError }: { onBack: () => void; onError: (m: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        const loop = async () => {
          if (stopped || !video.current) return;
          try {
            const codes = await detector.detect(video.current);
            const raw: string | undefined = codes[0]?.rawValue;
            if (raw) {
              const url = new URL(raw, location.origin);
              if (url.origin === location.origin && (url.pathname.startsWith('/u/') || url.pathname.startsWith('/c/'))) {
                sfx.correct();
                location.href = url.pathname + url.search;
                return;
              }
            }
          } catch { /* keep scanning */ }
          raf = requestAnimationFrame(loop);
        };
        loop();
      } catch {
        onError('No puedo usar la cámara. Abre la cámara del móvil y apunta al QR, o escribe el código.');
      }
    })();
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, []);
  return (
    <div class="ck-card space-y-3 text-center">
      <p class="font-display text-2xl font-extrabold">Apunta al código QR</p>
      <div class="relative overflow-hidden rounded-2xl bg-black">
        <video ref={video} class="aspect-square w-full object-cover" playsInline muted />
        <div class="pointer-events-none absolute inset-8 rounded-3xl border-4 border-white/80" />
      </div>
      <button class="text-sm font-bold text-slate-500" onClick={onBack}>← Volver</button>
    </div>
  );
}

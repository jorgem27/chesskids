import { useEffect, useState } from 'preact/hooks';
import type { GameResult } from '../../games/types';
import { burst, cheer, emojiRain, sideCannons, speak, starShower } from '../../lib/fx';
import { useVoiceId } from '../../lib/voice/player';
import type { CampaignReward } from '../../lib/campaigns';
import { KINGDOMS, stickerById, type XpBreakdown } from '../../lib/rewards';
import { sfx, vibrate } from '../../lib/sfx';
import { Potroculo } from '../ui/Potroculo';

export interface RewardResponse {
  xp: XpBreakdown;
  firstTime: boolean;
  before: { xp: number; level: number; kingdom: number };
  after: { xp: number; level: number; kingdom: number };
  streak: { value: number; extended: boolean };
  newStickers: string[];
  dailyXp: number;
  /** Set when this activity was a campaign level the student just passed. */
  campaign?: { id: number; title: string; reward: CampaignReward; levelDone: boolean; finished: boolean } | null;
  /** Set for practice sessions (Repaso / Problema del día / Entrena). */
  practice?: { kind: string; solved: number; total: number; capped: boolean; rating: { before: number; after: number } | null };
}

type Overlay =
  | { kind: 'level'; level: number }
  | { kind: 'kingdom'; index: number }
  | { kind: 'sticker'; id: string }
  | { kind: 'campaign'; title: string; reward: CampaignReward };

interface Props {
  result: GameResult; reward: RewardResponse | null; preview: boolean; error: string;
  /** Saved on the phone because there was no connection. */
  queued?: boolean;
  exitUrl: string; onReplay: () => void; stars: number;
}

export function Results({ result, reward, preview, error, queued = false, exitUrl, onReplay, stars }: Props) {
  const [shownStars, setShownStars] = useState(0);
  const [xpShown, setXpShown] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [ready, setReady] = useState(false);
  const costume = useVoiceId();

  useEffect(() => {
    const timers: number[] = [];
    const T = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    sfx.fanfare();
    sideCannons();
    cheer(stars >= 3 ? 'resultsPerfect' : stars === 2 ? 'resultsGood' : 'resultsOk');
    for (let i = 0; i < stars; i++) T(500 + i * 420, () => { setShownStars(i + 1); sfx.star(i); vibrate(40); });
    const afterStars = 500 + stars * 420 + 200;
    if (stars === 3) T(afterStars, starShower);
    const total = reward?.xp.total ?? 0;
    T(afterStars + 200, () => {
      setShowDetails(true);
      if (!total) return;
      const steps = Math.min(total, 30);
      for (let k = 1; k <= steps; k++) {
        T(k * 35, () => { setXpShown(Math.round((total * k) / steps)); if (k % 3 === 0) sfx.coin(); });
      }
    });
    T(afterStars + 1600, () => {
      const q: Overlay[] = [];
      if (reward) {
        if (reward.campaign?.finished) q.push({ kind: 'campaign', title: reward.campaign.title, reward: reward.campaign.reward });
        if (reward.after.level > reward.before.level) q.push({ kind: 'level', level: reward.after.level });
        if (reward.after.kingdom > reward.before.kingdom) q.push({ kind: 'kingdom', index: reward.after.kingdom });
        reward.newStickers.forEach((id) => q.push({ kind: 'sticker', id }));
      }
      setOverlays(q);
      setReady(true);
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  const current = overlays[0];
  useEffect(() => {
    if (!current) return;
    if (current.kind === 'campaign') { sfx.levelUp(); emojiRain(current.reward.emoji); sideCannons(); speak(`¡Mapa completado! Ganas: ${current.reward.name}`); }
    if (current.kind === 'level') { sfx.levelUp(); burst(0.5, 0.5, 1.5); cheer('levelUp', { level: current.level }, { queue: true }); }
    if (current.kind === 'kingdom') { sfx.levelUp(); emojiRain(KINGDOMS[current.index].emoji); cheer('kingdom', { kingdom: KINGDOMS[current.index].name }, { queue: true }); }
    if (current.kind === 'sticker') { sfx.pop(); setTimeout(() => sfx.star(2), 200); burst(0.5, 0.45, 0.7); const s = stickerById(current.id); if (s) cheer('sticker', { sticker: s.name }, { queue: true }); }
    vibrate([50, 50, 80]);
  }, [current]);

  const title = stars === 3 ? '¡PERFECTO!' : stars === 2 ? '¡Muy bien!' : stars === 1 ? '¡Conseguido!' : '¡Buen intento!';

  return (
    <div class="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-violet-600 via-fuchsia-500 to-amber-400 px-5 py-10 text-white">
      <div class="pointer-events-none absolute inset-0 opacity-20" style="background: repeating-conic-gradient(from 0deg at 50% 40%, #fff 0 10deg, transparent 10deg 20deg); animation: ck-spin-slow 40s linear infinite" />
      <div class="relative flex flex-col items-center">
        <div><Potroculo costume={costume} mood="party" size={130} /></div>
        <h1 class="ck-rise font-display text-5xl font-extrabold drop-shadow-lg md:text-7xl">{title}</h1>

        <div class="mt-4 flex gap-3">
          {[0, 1, 2].map((i) => (
            <span key={i} class="text-6xl md:text-8xl" style={i < shownStars ? 'animation: ck-pop .45s cubic-bezier(.2,.9,.3,1.4) both; filter: drop-shadow(0 4px 0 #b45309)' : 'opacity:.25; filter: grayscale(1)'}>⭐</span>
          ))}
        </div>

        {showDetails && (
          <div class="ck-rise mt-6 w-full max-w-md rounded-3xl bg-white/95 p-5 text-slate-800 shadow-2xl">
            {preview ? (
              <p class="text-center font-bold">Vista previa · {result.score}/{result.maxScore} puntos · {result.mistakes} fallos</p>
            ) : queued ? (
              <p class="text-center font-display text-xl font-extrabold text-slate-700">📶 Sin internet. ¡Guardado en tu móvil! Se enviará solo 👍</p>
            ) : error ? (
              <p class="text-center font-bold text-slate-700">{error}</p>
            ) : reward && (
              <>
                <p class="text-center font-display text-5xl font-extrabold text-violet-600 tabular-nums">+{xpShown} XP</p>
                <div class="mt-3 flex flex-wrap justify-center gap-2 text-sm font-bold">
                  {reward.xp.performance > 0 && <span class="rounded-full bg-violet-100 px-3 py-1 text-violet-700">🎯 Aciertos +{reward.xp.performance}</span>}
                  {reward.xp.stars > 0 && <span class="rounded-full bg-amber-100 px-3 py-1 text-amber-700">⭐ Estrellas +{reward.xp.stars}</span>}
                  {reward.xp.time > 0 && <span class="rounded-full bg-sky-100 px-3 py-1 text-sky-700">⏰ Tiempo +{reward.xp.time}</span>}
                  {reward.xp.homework > 0 && <span class="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">🎒 Deberes +{reward.xp.homework}</span>}
                </div>
                {reward.campaign?.levelDone && !reward.campaign.finished && (
                  <p class="mt-3 rounded-2xl bg-emerald-50 px-3 py-2 text-center font-bold text-emerald-700">🗺️ ¡Nivel superado! Se abre el siguiente en «{reward.campaign.title}»</p>
                )}
                {reward.practice?.rating && (
                  <p class="mt-3 rounded-2xl bg-sky-50 px-3 py-2 text-center font-bold text-sky-800">
                    📈 Tu nivel de táctica: {reward.practice.rating.before} → <span class="font-display text-lg">{reward.practice.rating.after}</span>
                    {reward.practice.rating.after > reward.practice.rating.before ? ' ¡Subes! 🚀' : reward.practice.rating.after < reward.practice.rating.before ? ' ¡La próxima subes! 💪' : ''}
                  </p>
                )}
                {reward.practice?.capped && <p class="mt-2 text-center text-xs text-slate-500">Hoy ya has ganado mucho XP entrenando. ¡Sigue practicando, mañana hay más! 😉</p>}
                {!reward.firstTime && <p class="mt-2 text-center text-xs text-slate-500">Repetir también da XP (un poco menos) 😉</p>}
                <div class="mt-4 grid grid-cols-2 gap-3 text-center">
                  <div class="rounded-2xl bg-orange-50 p-3">
                    <p class="text-3xl"><span class={reward.streak.extended ? 'ck-flame' : ''}>🔥</span></p>
                    <p class="font-display text-2xl font-extrabold text-orange-600">{reward.streak.value} {reward.streak.value === 1 ? 'día' : 'días'}</p>
                    <p class="text-xs font-bold text-orange-500">{reward.streak.extended ? '¡Racha ampliada!' : 'Racha'}</p>
                  </div>
                  <div class="rounded-2xl bg-violet-50 p-3">
                    <p class="text-3xl">🏅</p>
                    <p class="font-display text-2xl font-extrabold text-violet-600">Nivel {reward.after.level}</p>
                    <p class="text-xs font-bold text-violet-500">{reward.after.xp} XP en total</p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {ready && !current && (
          <div class="ck-rise mt-8 flex flex-wrap justify-center gap-4">
            <button onClick={() => { sfx.tap(); onReplay(); }} class="ck-btn bg-white/90 text-violet-700">↺ Repetir</button>
            <a href={exitUrl} onClick={() => sfx.tap()} class="ck-btn ck-btn-green px-10">Seguir ▶</a>
          </div>
        )}
      </div>

      {current && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-sm">
          <div key={JSON.stringify(current)} class="w-full max-w-sm rounded-[2rem] bg-white p-8 text-center text-slate-800 shadow-2xl" style="animation: ck-pop .5s cubic-bezier(.2,.9,.3,1.4) both">
            {current.kind === 'level' && (
              <>
                <p class="text-sm font-black uppercase tracking-widest text-violet-500">¡Subes de nivel!</p>
                <div class="relative mx-auto my-4 flex h-36 w-36 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 font-display text-7xl font-extrabold text-white shadow-[0_8px_0_#5b21b6]">{current.level}</div>
                <p class="font-display text-3xl font-extrabold">Nivel {current.level}</p>
              </>
            )}
            {current.kind === 'kingdom' && (
              <>
                <p class="text-sm font-black uppercase tracking-widest text-emerald-600">¡Nuevo reino!</p>
                <div class="my-4 text-[7rem] leading-none">{KINGDOMS[current.index].emoji}</div>
                <p class="font-display text-3xl font-extrabold">{KINGDOMS[current.index].name}</p>
                <p class="mt-1 text-slate-500">{KINGDOMS[current.index].tagline}</p>
              </>
            )}
            {current.kind === 'campaign' && (
              <>
                <p class="text-sm font-black uppercase tracking-widest text-emerald-600">¡Campaña completada!</p>
                <p class="mt-1 font-display text-xl font-extrabold">{current.title}</p>
                <div class="mx-auto my-4 flex h-36 w-36 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-300 to-orange-400 text-7xl shadow-[0_8px_0_#c2410c]" style="animation: ck-wiggle .6s ease-in-out 1 .3s">{current.reward.emoji}</div>
                <p class="font-display text-2xl font-extrabold">{current.reward.name}</p>
                <p class="mt-1 text-slate-600">{current.reward.description}</p>
              </>
            )}
            {current.kind === 'sticker' && (() => {
              const s = stickerById(current.id);
              return s && (
                <>
                  <p class="text-sm font-black uppercase tracking-widest text-amber-500">¡Cromo nuevo!</p>
                  <div class="mx-auto my-4 flex h-40 w-32 flex-col items-center justify-center rounded-2xl border-4 border-amber-300 bg-gradient-to-b from-amber-50 to-amber-100 shadow-[0_6px_0_#f59e0b]" style="animation: ck-wiggle .6s ease-in-out 1 .3s">
                    <span class="text-7xl">{s.emoji}</span>
                    <span class="mt-1 rounded-full bg-amber-400 px-2 text-[10px] font-black uppercase text-white">{s.rarity}</span>
                  </div>
                  <p class="font-display text-3xl font-extrabold">{s.name}</p>
                  <p class="mt-1 text-slate-500">{s.hint}</p>
                </>
              );
            })()}
            <button onClick={() => { sfx.tap(); setOverlays((q) => q.slice(1)); }} class="ck-btn ck-btn-primary mt-6 w-full">¡Genial!</button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { getGame } from '../../games/registry';
import type { GameApi, GameResult } from '../../games/types';
import type { AgeGroup } from '../../lib/catalog';
import { burst, cheer, line, speak } from '../../lib/fx';
import { starsFor } from '../../lib/rewards';
import { isMuted, setMuted, sfx, vibrate } from '../../lib/sfx';
import { Potroculo, type Mood } from '../ui/Potroculo';
import { Results, type RewardResponse } from './Results';

export interface PlayerActivity { id: number; type: string; title: string; content: any }

interface Props {
  activity: PlayerActivity;
  assignmentId?: number | null;
  campaignNodeId?: number | null;
  ageGroup: AgeGroup;
  preview?: boolean; // coach preview: nothing is saved
  exitUrl: string;
}

type Feedback = { kind: 'good' | 'bad'; text: string; key: number } | null;

export default function GamePlayer({ activity, assignmentId = null, campaignNodeId = null, ageGroup, preview = false, exitUrl }: Props) {
  const game = useMemo(() => getGame(activity.type), [activity.type]);
  const [phase, setPhase] = useState<'intro' | 'play' | 'saving' | 'done'>('intro');
  const [progress, setProgress] = useState(0);
  const [bubble, setBubble] = useState('');
  const [mood, setMood] = useState<Mood>('happy');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [combo, setCombo] = useState(0);
  const [muted, setMutedState] = useState(isMuted());
  const [result, setResult] = useState<GameResult | null>(null);
  const [reward, setReward] = useState<RewardResponse | null>(null);
  const [error, setError] = useState('');
  const [runKey, setRunKey] = useState(0);
  const seconds = useRef(0);
  const fbTimer = useRef<number | null>(null);
  const moodTimer = useRef<number | null>(null);
  const lastStreak = useRef(0);

  // Active-time counter (pauses when the tab is hidden)
  useEffect(() => {
    if (phase !== 'play') return;
    const id = setInterval(() => { if (document.visibilityState === 'visible') seconds.current++; }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  function flashMood(m: Mood, ms = 1400) {
    setMood(m);
    if (moodTimer.current) clearTimeout(moodTimer.current);
    moodTimer.current = window.setTimeout(() => setMood('happy'), ms);
  }

  function showFeedback(kind: 'good' | 'bad', text: string) {
    setFeedback({ kind, text, key: Date.now() });
    if (fbTimer.current) clearTimeout(fbTimer.current);
    fbTimer.current = window.setTimeout(() => setFeedback(null), kind === 'good' ? 1300 : 2200);
  }

  const api: GameApi = useMemo(() => ({
    ageGroup,
    good(text, opts) {
      sfx.correct();
      vibrate([30, 40, 30]);
      flashMood(opts?.big ? 'party' : 'happy');
      const said = text ?? line(opts?.big ? 'perfect' : 'correct');
      showFeedback('good', said);
      // The youngest hear everything; older kids hear big moments and some praise, so it
      // doesn't get chatty in fast modes. Never talk over a streak line just said.
      const talk = ageGroup === 'peque' || (text === undefined && (opts?.big || Math.random() < 0.4));
      if (talk && Date.now() - lastStreak.current > 1500) speak(said);
      if (opts?.big) burst(0.5, 0.55, 0.8);
    },
    bad(text) {
      sfx.wrong();
      flashMood('sad', 1600);
      const said = text ?? line('wrong');
      showFeedback('bad', said);
      if (text === undefined || ageGroup === 'peque') speak(said);
    },
    say(text, opts) {
      setBubble(text);
      setMood('think');
      setTimeout(() => setMood('happy'), 1200);
      if (opts?.speak) speak(text);
    },
    progress(done, total) { setProgress(total ? done / total : 0); },
    combo(n) {
      setCombo(n);
      if (n >= 2) { sfx.combo(n); if (n % 5 === 0) burst(0.5, 0.3, 0.6); }
      if (n === 3 || (n >= 5 && n % 5 === 0)) { cheer('streak', { n }); lastStreak.current = Date.now(); }
    },
    speak,
    finish(r) {
      setResult(r);
      setProgress(1);
      void save(r);
    },
  }), [ageGroup, runKey]);

  async function save(r: GameResult) {
    setPhase('saving');
    if (preview) {
      setReward(null);
      setPhase('done');
      return;
    }
    try {
      const res = await fetch('/api/attempts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ activityId: activity.id, assignmentId, campaignNodeId, seconds: seconds.current, ...r }),
      });
      if (!res.ok) throw new Error((await (res.json() as Promise<any>).catch(() => ({}))).error ?? 'Error');
      setReward(await (res.json() as Promise<any>));
    } catch (e) {
      setError('No se pudo guardar el resultado. ¿Tienes internet?');
    }
    setPhase('done');
  }

  function start() {
    sfx.unlock();
    sfx.whoosh();
    seconds.current = 0;
    setPhase('play');
    if (ageGroup === 'peque') speak(`${game.name}. ${game.tagline}`);
    else if (ageGroup !== 'maestro') cheer('start');
  }

  function replay() {
    setResult(null); setReward(null); setError(''); setCombo(0); setProgress(0); setBubble('');
    setRunKey((k) => k + 1);
    seconds.current = 0;
    setPhase('play');
  }

  function toggleMute() {
    setMuted(!muted);
    setMutedState(!muted);
  }

  // ---------- Intro ----------
  if (phase === 'intro') {
    return (
      <div class={`relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-br ${game.gradient} p-6 text-white`}>
        <a href={exitUrl} class="absolute left-4 top-4 rounded-full bg-white/20 px-4 py-2 font-bold backdrop-blur">✕</a>
        {preview && <span class="absolute right-4 top-4 rounded-full bg-black/30 px-3 py-1 text-sm font-bold">Vista previa de profe</span>}
        <div class="pointer-events-none absolute -left-10 top-20 text-[9rem] opacity-15 ck-float">♞</div>
        <div class="pointer-events-none absolute -right-8 bottom-10 text-[10rem] opacity-15 ck-float" style="animation-delay:1s">♛</div>
        <div class="ck-rise text-[7rem] leading-none drop-shadow-lg">{game.emoji}</div>
        <p class="ck-rise mt-4 rounded-full bg-white/20 px-4 py-1 font-bold uppercase tracking-widest" style="animation-delay:.1s">{game.name}</p>
        <h1 class="ck-rise mt-3 max-w-2xl text-center text-4xl font-extrabold drop-shadow md:text-6xl" style="animation-delay:.2s">{activity.title}</h1>
        <p class="ck-rise mt-3 max-w-md text-center text-lg font-bold opacity-90" style="animation-delay:.3s">{game.tagline}</p>
        <button onClick={start} class="ck-btn ck-rise mt-10 bg-white px-14 py-5 text-2xl text-violet-700" style="animation-delay:.45s; box-shadow: 0 6px 0 rgb(0 0 0 / .2)">
          ¡A jugar! ▶
        </button>
      </div>
    );
  }

  // ---------- Results ----------
  if (phase === 'done' && result) {
    return (
      <Results
        result={result}
        reward={reward}
        preview={preview}
        error={error}
        exitUrl={exitUrl}
        onReplay={replay}
        stars={starsFor(result.score, result.maxScore)}
      />
    );
  }

  // ---------- Playing ----------
  const Player = game.Player;
  return (
    <div class="flex min-h-dvh flex-col bg-gradient-to-b from-violet-50 to-fuchsia-50">
      {/* Top bar */}
      <header class="sticky top-0 z-20 flex items-center gap-3 px-3 py-3 md:px-6">
        <a href={exitUrl} onClick={(e) => { if (!preview && !confirm('¿Salir? Perderás el progreso de esta actividad.')) e.preventDefault(); }}
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-2xl font-black text-slate-400 hover:bg-white">✕</a>
        <div class="relative h-5 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 to-lime-400 transition-all duration-500 ease-out" style={{ width: `${Math.max(4, progress * 100)}%` }}>
            <div class="ck-shine h-2 translate-y-1 rounded-full" />
          </div>
        </div>
        {combo >= 2 && (
          <span key={combo} class="flex items-center gap-1 rounded-full bg-orange-500 px-3 py-1 font-display text-lg font-extrabold text-white shadow-md" style="animation: ck-pop .35s ease-out">
            <span class="ck-flame">🔥</span>x{combo}
          </span>
        )}
        <button onClick={toggleMute} class="flex h-10 w-10 items-center justify-center rounded-full text-xl hover:bg-white" title="Sonido">{muted ? '🔇' : '🔊'}</button>
      </header>

      <main class="flex flex-1 flex-col items-center gap-3 px-3 pb-28 md:flex-row md:items-center md:justify-center md:gap-10 md:px-8">
        {/* Mascot + bubble */}
        <div class="flex w-full max-w-[min(92vw,66vh)] items-end gap-2 md:w-72 md:max-w-none md:flex-col md:items-center">
          <div class="shrink-0">
            <Potroculo mood={mood} size={ageGroup === 'peque' ? 86 : 72} class="md:!w-40 md:!h-auto" />
          </div>
          {bubble && (
            <div key={bubble} class="ck-rise relative mb-3 flex-1 rounded-2xl border-2 border-violet-200 bg-white px-4 py-3 font-bold text-slate-700 shadow-sm md:mb-0 md:w-full md:text-lg">
              {bubble}
              <button onClick={() => speak(bubble)} class="ml-2 align-middle text-base opacity-60 hover:opacity-100" title="Escuchar">🔈</button>
            </div>
          )}
        </div>
        <div class="w-full md:w-auto md:flex-1 md:max-w-[70vh]">
          <Player key={runKey} content={activity.content} api={api} title={activity.title} />
        </div>
      </main>

      {phase === 'saving' && (
        <div class="fixed inset-0 z-40 flex items-center justify-center bg-white/70 backdrop-blur">
          <div class="text-center"><Potroculo mood="run" size={120} class="mx-auto" /><p class="mt-3 font-display text-2xl font-extrabold text-violet-700">Contando tus puntos…</p></div>
        </div>
      )}

      {/* Feedback sheet */}
      {feedback && (
        <div key={feedback.key} class={`fixed inset-x-0 bottom-0 z-30 px-4 pb-6 pt-5 ${feedback.kind === 'good' ? 'bg-emerald-100' : 'bg-amber-100'}`} style="animation: ck-slide-up .25s ease-out">
          <div class="mx-auto flex max-w-3xl items-center gap-4">
            <span class={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-3xl ${feedback.kind === 'good' ? 'bg-emerald-500' : 'bg-amber-400'}`} style="animation: ck-pop .35s ease-out">
              {feedback.kind === 'good' ? <span class="font-black text-white">✓</span> : '💡'}
            </span>
            <p class={`font-display text-2xl font-extrabold ${feedback.kind === 'good' ? 'text-emerald-700' : 'text-amber-800'}`}>{feedback.text}</p>
          </div>
        </div>
      )}
    </div>
  );
}


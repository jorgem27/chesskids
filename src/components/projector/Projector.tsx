// Classroom projector mode: teams compete solving puzzles on the big screen.
import type { Api } from '@lichess-org/chessground/api';
import type { Key } from '@lichess-org/chessground/types';
import { Chess } from 'chess.js';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Board, isPromotion, syncBoard } from '../../games/chess/Board';
import { applyUci, isCorrectMove, type Puzzle } from '../../games/puzzle/logic';
import { burst, sideCannons, speak } from '../../lib/fx';
import { sfx } from '../../lib/sfx';
import { Mascot } from '../ui/Mascot';

interface Kid { id: number; name: string; avatar: string }
interface Source { id: number; title: string; type: string; puzzles: Puzzle[] }
interface Props { className: string; students: Kid[]; sources: Source[]; backUrl: string }

const TEAM_PRESETS = [
  { name: 'Dragones', emoji: '🐲', color: '#ef4444' },
  { name: 'Unicornios', emoji: '🦄', color: '#a855f7' },
  { name: 'Cohetes', emoji: '🚀', color: '#0ea5e9' },
  { name: 'Leones', emoji: '🦁', color: '#f59e0b' },
];

interface Team { name: string; emoji: string; color: string; members: Kid[]; score: number }

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

export default function Projector({ className, students, sources, backUrl }: Props) {
  const [phase, setPhase] = useState<'setup' | 'play' | 'podium'>('setup');
  const [teamCount, setTeamCount] = useState(2);
  const [teams, setTeams] = useState<Team[]>([]);
  const [chosen, setChosen] = useState<number[]>(sources.slice(0, 1).map((s) => s.id));
  const [turnSeconds, setTurnSeconds] = useState(45);
  const [pool, setPool] = useState<Puzzle[]>([]);

  function makeTeams(n: number) {
    const mixed = shuffle(students);
    const t: Team[] = TEAM_PRESETS.slice(0, n).map((p) => ({ ...p, members: [], score: 0 }));
    mixed.forEach((k, i) => t[i % n].members.push(k));
    setTeams(t);
  }
  useEffect(() => makeTeams(teamCount), [teamCount]);

  function start() {
    const puzzles = shuffle(sources.filter((s) => chosen.includes(s.id)).flatMap((s) => s.puzzles));
    if (!puzzles.length) return;
    sfx.unlock();
    sfx.fanfare();
    setPool(puzzles);
    setTeams(teams.map((t) => ({ ...t, score: 0 })));
    setPhase('play');
    document.documentElement.requestFullscreen?.().catch(() => {});
  }

  if (phase === 'setup') {
    return (
      <div class="ck-projector min-h-dvh p-6 md:p-10">
        <a href={backUrl} class="font-bold text-violet-200">← Volver</a>
        <div class="mx-auto max-w-5xl">
          <div class="flex items-center gap-4">
            <Mascot mood="party" size={90} />
            <div>
              <h1 class="font-display text-5xl font-extrabold">📽️ Modo proyector</h1>
              <p class="text-xl text-violet-200">{className} · ¡Equipos contra equipos!</p>
            </div>
          </div>

          <div class="mt-8 grid gap-6 lg:grid-cols-2">
            <div class="rounded-3xl bg-white/10 p-5">
              <div class="flex items-center justify-between">
                <h2 class="font-display text-2xl font-extrabold">1. Equipos</h2>
                <div class="flex gap-2">
                  {[2, 3, 4].map((n) => <button key={n} onClick={() => setTeamCount(n)} class={`h-10 w-10 rounded-xl font-black ${teamCount === n ? 'bg-amber-400 text-amber-950' : 'bg-white/15'}`}>{n}</button>)}
                  <button onClick={() => { sfx.whoosh(); makeTeams(teamCount); }} class="rounded-xl bg-white/15 px-3 font-bold">🔀 Mezclar</button>
                </div>
              </div>
              <div class="mt-4 grid gap-3 sm:grid-cols-2">
                {teams.map((t) => (
                  <div key={t.name} class="rounded-2xl p-3" style={{ background: `${t.color}33`, border: `3px solid ${t.color}` }}>
                    <p class="font-display text-xl font-extrabold">{t.emoji} {t.name}</p>
                    <p class="mt-1 text-2xl leading-relaxed">{t.members.map((m) => <span title={m.name}>{m.avatar}</span>)}</p>
                    <p class="text-xs opacity-80">{t.members.map((m) => m.name).join(', ') || 'Sin alumnos (juego libre)'}</p>
                  </div>
                ))}
              </div>
            </div>

            <div class="rounded-3xl bg-white/10 p-5">
              <h2 class="font-display text-2xl font-extrabold">2. Problemas</h2>
              <div class="mt-3 max-h-64 space-y-2 overflow-auto">
                {sources.map((s) => (
                  <label key={s.id} class={`flex cursor-pointer items-center gap-3 rounded-2xl p-3 ${chosen.includes(s.id) ? 'bg-violet-500/60' : 'bg-white/10'}`}>
                    <input type="checkbox" checked={chosen.includes(s.id)} onChange={() => setChosen(chosen.includes(s.id) ? chosen.filter((x) => x !== s.id) : [...chosen, s.id])} />
                    <span class="flex-1 font-bold">{s.type === 'puzzle-blitz' ? '⚡' : '🧩'} {s.title}</span>
                    <span class="text-sm opacity-80">{s.puzzles.length}</span>
                  </label>
                ))}
                {!sources.length && <p class="opacity-80">Crea primero una actividad de problemas en el panel de profe.</p>}
              </div>
              <h2 class="mt-5 font-display text-2xl font-extrabold">3. Tiempo por turno</h2>
              <div class="mt-2 flex gap-2">
                {[20, 30, 45, 60, 90].map((n) => <button key={n} onClick={() => setTurnSeconds(n)} class={`rounded-xl px-4 py-2 font-black ${turnSeconds === n ? 'bg-amber-400 text-amber-950' : 'bg-white/15'}`}>{n}s</button>)}
              </div>
            </div>
          </div>
          <div class="mt-8 text-center">
            <button disabled={!chosen.length} onClick={start} class="ck-btn ck-btn-orange px-16 py-6 text-3xl">¡Empezar el torneo! 🏁</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'podium') return <Podium teams={teams} onAgain={() => setPhase('setup')} backUrl={backUrl} />;

  return <Arena teams={teams} setTeams={setTeams} pool={pool} turnSeconds={turnSeconds} onEnd={() => setPhase('podium')} />;
}

function Arena({ teams, setTeams, pool, turnSeconds, onEnd }: { teams: Team[]; setTeams: (t: Team[]) => void; pool: Puzzle[]; turnSeconds: number; onEnd: () => void }) {
  const cg = useRef<Api | null>(null);
  const chess = useRef(new Chess());
  const S = useRef({ p: 0, ply: 0, turn: 0, steal: false, locked: false, teams });
  const [pIdx, setPIdx] = useState(0);
  const [turn, setTurn] = useState(0);
  const [steal, setSteal] = useState(false);
  const [left, setLeft] = useState(turnSeconds);
  const [banner, setBanner] = useState<{ text: string; color: string } | null>(null);
  const [picked, setPicked] = useState<Kid | null>(null);
  const [rolling, setRolling] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [bump, setBump] = useState(-1);
  const timer = useRef<number | null>(null);
  S.current.teams = teams;

  const team = teams[turn];

  function flash(text: string, color: string, ms = 1600) {
    setBanner({ text, color });
    setTimeout(() => setBanner(null), ms);
  }

  function clock(run: boolean) {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    if (!run) return;
    let l = turnSeconds;
    setLeft(l);
    timer.current = window.setInterval(() => {
      l--;
      setLeft(l);
      if (l <= 5 && l > 0) sfx.tick();
      if (l <= 0) { clock(false); wrong(true); }
    }, 1000);
  }
  useEffect(() => () => clock(false), []);

  function load(i: number, t: number) {
    const s = S.current;
    s.p = i; s.ply = 0; s.turn = t; s.steal = false; s.locked = false;
    setPIdx(i); setTurn(t); setSteal(false); setPicked(null);
    chess.current = new Chess(pool[i].fen);
    const color = chess.current.turn() === 'w' ? 'white' : 'black';
    cg.current?.set({ orientation: color });
    cg.current?.setAutoShapes([]);
    if (cg.current) syncBoard(cg.current, chess.current, { movable: color });
    const tm = S.current.teams[t];
    flash(`¡Turno de ${tm.emoji} ${tm.name}!`, tm.color, 1400);
    speak(`Turno de los ${tm.name}`);
    sfx.drum();
    clock(true);
  }

  function award(teamIdx: number, pts: number) {
    const next = S.current.teams.map((t, i) => (i === teamIdx ? { ...t, score: t.score + pts } : t));
    setTeams(next);
    setBump(teamIdx);
    setTimeout(() => setBump(-1), 700);
  }

  function nextPuzzle() {
    const s = S.current;
    clock(false);
    if (s.p + 1 >= pool.length) { onEnd(); return; }
    load(s.p + 1, (s.turn + (s.steal ? 0 : 1)) % S.current.teams.length);
  }

  function reveal() {
    const s = S.current;
    s.locked = true;
    clock(false);
    const p = pool[s.p];
    const rest = p.moves.slice(s.ply);
    cg.current?.setAutoShapes([{ orig: rest[0].slice(0, 2) as Key, dest: rest[0].slice(2, 4) as Key, brush: 'green' }]);
    rest.forEach((m, k) => setTimeout(() => {
      applyUci(chess.current, m);
      sfx.move();
      syncBoard(cg.current!, chess.current, { movable: null, lastMove: m });
    }, 900 + k * 800));
  }

  function wrong(timeout = false) {
    const s = S.current;
    sfx.wrong();
    setShake((x) => x + 1);
    const n = S.current.teams.length;
    if (!s.steal && n > 1) {
      // Steal: the next team gets a chance (1 point)
      s.steal = true;
      s.turn = (s.turn + 1) % n;
      setSteal(true); setTurn(s.turn); setPicked(null);
      const tm = S.current.teams[s.turn];
      flash(`${timeout ? '⏰ ¡Tiempo! ' : '❌ '}¡REBOTE para ${tm.emoji} ${tm.name}!`, tm.color, 1800);
      speak(`¡Rebote para los ${tm.name}!`);
      setTimeout(() => {
        syncBoard(cg.current!, chess.current, { movable: chess.current.turn() === 'w' ? 'white' : 'black' });
        clock(true);
      }, 500);
    } else {
      flash(timeout ? '⏰ ¡Se acabó el tiempo!' : '😮 ¡Nadie lo encontró!', '#64748b', 1800);
      reveal();
    }
  }

  function onMove(orig: Key, dest: Key) {
    const s = S.current;
    if (s.locked) return;
    const p = pool[s.p];
    const expected = p.moves[s.ply];
    let uci = orig + dest;
    if (isPromotion(chess.current, orig, dest)) uci += expected.length > 4 ? expected[4] : 'q';
    if (!isCorrectMove(chess.current.fen(), uci, expected)) {
      syncBoard(cg.current!, chess.current, { movable: null });
      clock(false);
      wrong();
      return;
    }
    const toPlay = uci.slice(0, 4) === expected.slice(0, 4) ? expected : uci;
    const m = applyUci(chess.current, toPlay);
    m?.captured ? sfx.capture() : sfx.move();
    if (s.ply + 1 >= p.moves.length || chess.current.isCheckmate()) {
      s.locked = true;
      clock(false);
      syncBoard(cg.current!, chess.current, { movable: null, lastMove: toPlay });
      const pts = s.steal ? 1 : 3;
      const tm = S.current.teams[s.turn];
      award(s.turn, pts);
      sfx.levelUp();
      burst(0.5, 0.5, 1.4);
      flash(`✅ ¡+${pts} para ${tm.emoji} ${tm.name}!`, tm.color, 2000);
      speak(`¡Muy bien, ${tm.name}!`);
      return;
    }
    syncBoard(cg.current!, chess.current, { movable: null, lastMove: toPlay });
    s.locked = true;
    setTimeout(() => {
      const reply = p.moves[s.ply + 1];
      applyUci(chess.current, reply);
      sfx.move();
      s.ply += 2;
      s.locked = false;
      syncBoard(cg.current!, chess.current, { movable: chess.current.turn() === 'w' ? 'white' : 'black', lastMove: reply });
    }, 700);
  }

  function pickKid() {
    const members = team.members;
    if (!members.length) return;
    let k = 0;
    const spins = 14 + Math.floor(Math.random() * members.length);
    const step = () => {
      const m = members[k % members.length];
      setRolling(m.avatar);
      sfx.tick();
      k++;
      if (k < spins) setTimeout(step, 60 + k * 12);
      else { setRolling(null); setPicked(m); sfx.coin(); speak(`¡Sale ${m.name}!`); }
    };
    step();
  }

  const maxScore = Math.max(1, ...teams.map((t) => t.score));
  const C = 2 * Math.PI * 46;
  const s = S.current;

  return (
    <div class="ck-projector relative flex min-h-dvh flex-col gap-4 p-4 lg:flex-row lg:p-6">
      {/* Scoreboard */}
      <aside class="flex gap-3 lg:w-72 lg:flex-col">
        {teams.map((t, i) => (
          <div key={t.name} class={`flex-1 rounded-3xl p-3 transition lg:flex-none ${i === turn ? 'scale-105 ring-4' : 'opacity-70'}`} style={{ background: `${t.color}40`, ['--tw-ring-color' as any]: t.color }}>
            <div class="flex items-center justify-between">
              <span class="font-display text-lg font-extrabold lg:text-2xl">{t.emoji} {t.name}</span>
              <span class="font-display text-3xl font-extrabold tabular-nums lg:text-5xl" style={bump === i ? 'animation: ck-pop .6s ease-out; display:inline-block' : ''}>{t.score}</span>
            </div>
            <div class="mt-2 h-3 overflow-hidden rounded-full bg-black/30"><div class="h-full rounded-full transition-all duration-700" style={{ width: `${(t.score / maxScore) * 100}%`, background: t.color }} /></div>
          </div>
        ))}
        <div class="hidden flex-1 lg:block" />
        <p class="hidden text-center text-sm text-violet-200 lg:block">Problema {pIdx + 1} de {pool.length}</p>
      </aside>

      {/* Board */}
      <main class="flex flex-1 flex-col items-center justify-center">
        <p class="mb-2 text-center font-display text-2xl font-extrabold lg:text-3xl">
          {steal && <span class="mr-2 rounded-full bg-amber-400 px-3 text-amber-950">REBOTE</span>}
          <span style={{ color: team.color }}>{team.emoji} {team.name}</span> · {pool[pIdx].prompt || (new Chess(pool[pIdx].fen).turn() === 'w' ? 'Juegan blancas' : 'Juegan negras')}
        </p>
        <div class="w-full max-w-[min(92vw,78vh)]">
          <Board config={{ fen: pool[0].fen }} shake={shake} onReady={(a) => { cg.current = a; a.set({ movable: { events: { after: onMove } } }); load(0, 0); }} />
        </div>
      </main>

      {/* Controls */}
      <aside class="flex flex-row flex-wrap items-center justify-center gap-3 lg:w-64 lg:flex-col lg:justify-start">
        <div class="relative h-32 w-32">
          <svg viewBox="0 0 100 100" class="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r="46" stroke="#ffffff22" stroke-width="8" fill="none" />
            <circle cx="50" cy="50" r="46" stroke={left <= 5 ? '#ef4444' : team.color} stroke-width="8" fill="none" stroke-linecap="round" stroke-dasharray={C} stroke-dashoffset={C * (1 - left / turnSeconds)} style="transition: stroke-dashoffset 1s linear" />
          </svg>
          <span class={`absolute inset-0 flex items-center justify-center font-display text-5xl font-extrabold tabular-nums ${left <= 5 ? 'animate-pulse text-rose-400' : ''}`}>{left}</span>
        </div>
        <div class="w-full rounded-3xl bg-white/10 p-3 text-center">
          <div class="flex h-20 items-center justify-center text-6xl">{rolling ?? picked?.avatar ?? '🎲'}</div>
          <p class="h-7 font-display text-xl font-extrabold">{picked?.name ?? ''}</p>
          <button onClick={pickKid} disabled={!team.members.length || !!rolling} class="ck-btn-sm mt-1 w-full justify-center !bg-white/20 !text-white">¿Quién sale?</button>
        </div>
        <button onClick={() => { if (!s.locked) { s.locked = true; clock(false); flash('👀 Solución', '#64748b'); reveal(); } }} class="ck-btn-sm !bg-white/15 !text-white">👀 Solución</button>
        <button onClick={nextPuzzle} class="ck-btn ck-btn-orange w-full">Siguiente ▶</button>
        <button onClick={() => { clock(false); onEnd(); }} class="text-sm font-bold text-violet-200">🏁 Terminar</button>
      </aside>

      {banner && (
        <div class="pointer-events-none fixed inset-x-0 top-1/3 z-40 flex justify-center px-4">
          <div class="rounded-3xl px-10 py-6 text-center font-display text-4xl font-extrabold text-white shadow-2xl md:text-6xl" style={{ background: banner.color, animation: 'ck-pop .4s cubic-bezier(.2,.9,.3,1.4) both' }}>{banner.text}</div>
        </div>
      )}
    </div>
  );
}

function Podium({ teams, onAgain, backUrl }: { teams: Team[]; onAgain: () => void; backUrl: string }) {
  const sorted = [...teams].sort((a, b) => b.score - a.score);
  const tie = sorted.length > 1 && sorted[0].score === sorted[1].score;
  useEffect(() => {
    sfx.fanfare();
    setTimeout(() => sfx.levelUp(), 700);
    sideCannons();
    setTimeout(sideCannons, 1200);
    speak(tie ? '¡Empate! ¡Todos sois campeones!' : `¡Ganan los ${sorted[0].name}!`);
  }, []);
  const heights = ['h-64', 'h-48', 'h-36', 'h-28'];
  const order = sorted.length >= 3 ? [1, 0, 2, 3].filter((i) => i < sorted.length) : sorted.map((_, i) => i);
  return (
    <div class="ck-projector flex min-h-dvh flex-col items-center justify-center p-6">
      <Mascot mood="party" size={120} />
      <h1 class="font-display text-6xl font-extrabold">{tie ? '¡EMPATE! 🤝' : `¡Ganan ${sorted[0].emoji} ${sorted[0].name}!`}</h1>
      <div class="mt-10 flex items-end gap-4">
        {order.map((i) => {
          const t = sorted[i];
          return (
            <div key={t.name} class="flex w-36 flex-col items-center md:w-48">
              <span class="text-6xl">{t.emoji}</span>
              <span class="font-display text-2xl font-extrabold">{t.name}</span>
              <span class="text-3xl">{['🥇', '🥈', '🥉', '🎖️'][i]}</span>
              <div class={`mt-2 flex w-full items-start justify-center rounded-t-3xl pt-4 font-display text-5xl font-extrabold ${heights[i]}`} style={{ background: t.color, animation: `ck-rise .6s ${0.2 * (3 - i)}s both` }}>{t.score}</div>
            </div>
          );
        })}
      </div>
      <div class="mt-10 flex gap-4">
        <button onClick={onAgain} class="ck-btn ck-btn-orange">↺ Otra ronda</button>
        <a href={backUrl} class="ck-btn bg-white/20 text-white">Salir</a>
      </div>
    </div>
  );
}

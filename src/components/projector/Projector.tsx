// Classroom projector mode: teams compete solving puzzles on the big screen.
import type { Api } from '@lichess-org/chessground/api';
import type { Key } from '@lichess-org/chessground/types';
import { Chess } from 'chess.js';
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Board, isPromotion, syncBoard } from '../../games/chess/Board';
import { applyUci, isCorrectMove, type Puzzle } from '../../games/puzzle/logic';
import { burst, cheer, sideCannons } from '../../lib/fx';
import CoachPicker from '../student/CoachPicker';
import { useVoiceId } from '../../lib/voice/player';
import { distributeXp, fmtPoints, kidPoints, POINTS, XP_BUDGETS, type KidTally } from '../../lib/projector';
import { sfx } from '../../lib/sfx';
import { Potroculo } from '../ui/Potroculo';

interface Kid { id: number; name: string; avatar: string }
interface Source { id: number; title: string; type: string; puzzles: Puzzle[] }
interface Props { classId: number; className: string; students: Kid[]; sources: Source[]; backUrl: string; canAward: boolean }

const TEAM_PRESETS = [
  { name: 'Dragones', emoji: '🐲', color: '#ef4444' },
  { name: 'Unicornios', emoji: '🦄', color: '#a855f7' },
  { name: 'Cohetes', emoji: '🚀', color: '#0ea5e9' },
  { name: 'Leones', emoji: '🦁', color: '#f59e0b' },
];

interface Team { name: string; emoji: string; color: string; members: Kid[]; score: number }
/** Per-kid record for the current tournament. */
interface Tally { picks: number; solved: number; points: number }
type Tallies = Record<number, Tally>;
const EMPTY: Tally = { picks: 0, solved: 0, points: 0 };
const tallyList = (teams: Team[], tallies: Tallies): KidTally[] =>
  teams.flatMap((t, i) => t.members.map((m) => ({ studentId: m.id, team: i, ...(tallies[m.id] ?? EMPTY) })));

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

function newNonce() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export default function Projector({ classId, className, students, sources, backUrl, canAward }: Props) {
  const costume = useVoiceId();
  const [phase, setPhase] = useState<'setup' | 'play' | 'podium'>('setup');
  const [teamCount, setTeamCount] = useState(2);
  const [teams, setTeams] = useState<Team[]>([]);
  const [bench, setBench] = useState<Kid[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [chosen, setChosen] = useState<number[]>(sources.slice(0, 1).map((s) => s.id));
  const [turnSeconds, setTurnSeconds] = useState(45);
  const [xpBudget, setXpBudget] = useState(canAward ? 10 : 0);
  const [pool, setPool] = useState<Puzzle[]>([]);
  const [tallies, setTallies] = useState<Tallies>({});
  const [played, setPlayed] = useState(0);
  const run = useRef({ nonce: '', startedAt: 0 });

  function makeTeams(n: number) {
    const benched = new Set(bench.map((k) => k.id));
    const mixed = shuffle(students.filter((k) => !benched.has(k.id)));
    const t: Team[] = TEAM_PRESETS.slice(0, n).map((p) => ({ ...p, members: [], score: 0 }));
    mixed.forEach((k, i) => t[i % n].members.push(k));
    setTeams(t);
    setSel(null);
  }
  useEffect(() => makeTeams(teamCount), [teamCount]);

  /** Tap a kid, then tap a team (or the bench) to move them there. */
  function moveTo(dest: number | 'bench') {
    const kid = students.find((k) => k.id === sel);
    if (!kid) return;
    setTeams(teams.map((t, i) => ({ ...t, members: [...t.members.filter((m) => m.id !== kid.id), ...(i === dest ? [kid] : [])] })));
    setBench([...bench.filter((m) => m.id !== kid.id), ...(dest === 'bench' ? [kid] : [])]);
    setSel(null);
    sfx.pop();
  }

  function start() {
    const puzzles = shuffle(sources.filter((s) => chosen.includes(s.id)).flatMap((s) => s.puzzles));
    if (!puzzles.length) return;
    sfx.unlock();
    sfx.fanfare();
    setPool(puzzles);
    setTeams(teams.map((t) => ({ ...t, score: 0 })));
    setTallies({});
    setPlayed(0);
    setSel(null);
    run.current = { nonce: newNonce(), startedAt: Date.now() };
    setPhase('play');
    document.documentElement.requestFullscreen?.().catch(() => {});
  }

  if (phase === 'setup') {
    const selKid = students.find((k) => k.id === sel);
    const onBench = !!selKid && bench.some((m) => m.id === selKid.id);
    const playing = teams.reduce((n, t) => n + t.members.length, 0);
    // Move targets work with a tap, a click or the keyboard.
    const asTarget = (active: boolean, go: () => void): JSX.HTMLAttributes<HTMLDivElement> => active
      ? { role: 'button', tabIndex: 0, onClick: go, onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } } }
      : {};
    const moveHere = <p class="mt-1 rounded-xl bg-white/25 px-2 py-1 text-center font-bold">👇 Mover aquí</p>;
    const chip = (m: Kid) => (
      <button key={m.id} onClick={(e) => { e.stopPropagation(); sfx.tap(); setSel(sel === m.id ? null : m.id); }}
        class={`m-0.5 inline-flex min-h-11 items-center gap-1 rounded-full px-3 py-1 text-sm font-bold transition ${sel === m.id ? 'scale-110 bg-amber-400 text-amber-950 ring-4 ring-amber-200' : 'bg-black/25 hover:bg-black/40'}`}>
        <span class="text-xl">{m.avatar}</span>{m.name}
      </button>
    );
    return (
      <div class="ck-projector min-h-dvh p-6 md:p-10">
        <a href={backUrl} class="inline-flex min-h-11 items-center font-bold text-violet-200">← Volver</a>
        <div class="mx-auto max-w-6xl">
          <div class="flex items-center gap-4">
            <Potroculo costume={costume} mood="wave" size={130} />
            <div>
              <h1 class="font-display text-5xl font-extrabold">📽️ Modo proyector</h1>
              <p class="text-xl text-violet-200">{className} · ¡Equipos contra equipos!</p>
            </div>
          </div>

          <div class="mt-8 grid gap-6 lg:grid-cols-[3fr_2fr]">
            <div class="rounded-3xl bg-white/10 p-5">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h2 class="font-display text-2xl font-extrabold">1. Equipos</h2>
                <div class="flex gap-2">
                  {[2, 3, 4].map((n) => <button key={n} onClick={() => setTeamCount(n)} class={`h-11 w-11 rounded-xl font-black ${teamCount === n ? 'bg-amber-400 text-amber-950' : 'bg-white/15'}`}>{n}</button>)}
                  <button onClick={() => { sfx.whoosh(); makeTeams(teamCount); }} class="min-h-11 rounded-xl bg-white/15 px-3 font-bold">🔀 Mezclar todo</button>
                </div>
              </div>
              <p class="mt-2 min-h-7 text-lg text-violet-100">
                {selKid ? <>👉 Toca un equipo para mover a <b>{selKid.avatar} {selKid.name}</b></> : '✋ Toca un alumno para cambiarlo de equipo'}
              </p>
              <div class="mt-3 grid gap-3 sm:grid-cols-2">
                {teams.map((t, i) => {
                  const target = !!selKid && !t.members.some((m) => m.id === selKid.id);
                  return (
                    <div key={t.name} {...asTarget(target, () => moveTo(i))}
                      class={`rounded-2xl p-3 transition ${target ? 'cursor-pointer ring-4 ring-white/60 hover:scale-[1.02]' : ''}`}
                      style={{ background: `${t.color}33`, border: `3px solid ${t.color}` }}>
                      <p class="font-display text-xl font-extrabold">{t.emoji} {t.name} <span class="text-sm font-bold opacity-80">· {t.members.length}</span></p>
                      <div class="mt-1">{t.members.map(chip)}</div>
                      {!t.members.length && <p class="text-xs opacity-80">Sin alumnos (juego libre)</p>}
                      {target && moveHere}
                    </div>
                  );
                })}
              </div>
              {students.length > 0 && (
                <div {...asTarget(!!selKid && !onBench, () => moveTo('bench'))}
                  class={`mt-3 rounded-2xl border-2 border-dashed border-white/30 p-3 ${selKid && !onBench ? 'cursor-pointer ring-4 ring-white/60' : ''}`}>
                  <p class="font-bold">🪑 Hoy no juegan <span class="text-sm font-normal opacity-80">(no reciben XP)</span></p>
                  <div class="mt-1">{bench.map(chip)}</div>
                  {!bench.length && <p class="text-xs opacity-70">Mueve aquí a quien falte hoy.</p>}
                  {selKid && !onBench && moveHere}
                </div>
              )}
            </div>

            <div class="rounded-3xl bg-white/10 p-5">
              <h2 class="font-display text-2xl font-extrabold">2. Problemas</h2>
              <div class="mt-3 max-h-56 space-y-2 overflow-auto">
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
              <div class="mt-2 flex flex-wrap items-center gap-2">
                {[15, 30, 45, 60].map((n) => <button key={n} onClick={() => setTurnSeconds(n)} class={`min-h-11 rounded-xl px-4 py-2 font-black ${turnSeconds === n ? 'bg-amber-400 text-amber-950' : 'bg-white/15'}`}>{n}s</button>)}
                <div class={`flex min-h-11 items-center rounded-xl px-2 font-black transition-colors focus-within:ring-2 focus-within:ring-white ${![15, 30, 45, 60].includes(turnSeconds) ? 'bg-amber-400 text-amber-950' : 'bg-white/15'}`}>
                  <input type="number" min="5" max="999" value={turnSeconds || ''}
                    onBlur={(e) => setTurnSeconds(Math.max(5, parseInt(e.currentTarget.value) || 15))}
                    onInput={(e) => setTurnSeconds(parseInt(e.currentTarget.value) || 0)}
                    class="w-12 bg-transparent text-center font-black outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  <span>s</span>
                </div>
              </div>
              <h2 class="mt-5 font-display text-2xl font-extrabold">4. Premio ✨</h2>
              {canAward ? (
                <>
                  <div class="mt-2 flex flex-wrap gap-2">
                    {XP_BUDGETS.map((n) => <button key={n} onClick={() => setXpBudget(n)} class={`min-h-11 rounded-xl px-4 py-2 font-black ${xpBudget === n ? 'bg-amber-400 text-amber-950' : 'bg-white/15'}`}>{n ? `${n} XP` : 'Sin XP'}</button>)}
                  </div>
                  <p class="mt-2 text-base text-violet-100">
                    {xpBudget
                      ? `Hasta ${xpBudget} XP por alumno: 🎮 jugar (30 %) · 🏆 puntos del equipo (40 %) · 🎲 salir con el dado y acertar (30 %).`
                      : 'Ronda de práctica: se guarda el resultado, pero no se da XP.'}
                  </p>
                </>
              ) : <p class="mt-2 text-base text-violet-100">Solo el profe responsable (o con permiso para gestionar alumnos) puede dar XP. Esta ronda es de práctica.</p>}
            </div>
          </div>
          <div class="mt-6 rounded-3xl bg-white/10 p-4 md:p-6"><CoachPicker compact /></div>
          <div class="mt-8 text-center">
            {students.length > 0 && !playing && <p class="mb-3 text-lg font-bold text-amber-200">🪑 Nadie juega hoy: no se guardará ni se dará XP.</p>}
            <button disabled={!chosen.length} onClick={start} class="ck-btn ck-btn-orange px-16 py-6 text-3xl">¡Empezar el torneo! 🏁</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'podium') {
    return <Podium teams={teams} tallies={tallies} budget={xpBudget} canAward={canAward} classId={classId} run={run.current} played={played}
      onAgain={() => setPhase('setup')} backUrl={backUrl} />;
  }

  return <Arena teams={teams} setTeams={setTeams} tallies={tallies} setTallies={setTallies} pool={pool} turnSeconds={turnSeconds}
    onEnd={(n) => { setPlayed(n); setPhase('podium'); }} />;
}

interface ArenaProps {
  teams: Team[]; setTeams: (t: Team[]) => void; tallies: Tallies; setTallies: (f: (t: Tallies) => Tallies) => void;
  pool: Puzzle[]; turnSeconds: number; onEnd: (puzzlesPlayed: number) => void;
}

function Arena({ teams, setTeams, tallies, setTallies, pool, turnSeconds, onEnd }: ArenaProps) {
  const cg = useRef<Api | null>(null);
  const chess = useRef(new Chess());
  // `picked` lives in the ref too: onMove is registered once and would otherwise see stale state.
  const S = useRef({ p: 0, ply: 0, turn: 0, steal: false, locked: false, teams, picked: null as Kid | null, counted: new Set<number>() });
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
    s.p = i; s.ply = 0; s.turn = t; s.steal = false; s.locked = false; s.picked = null; s.counted = new Set();
    setPIdx(i); setTurn(t); setSteal(false); setPicked(null);
    chess.current = new Chess(pool[i].fen);
    const color = chess.current.turn() === 'w' ? 'white' : 'black';
    cg.current?.set({ orientation: color });
    cg.current?.setAutoShapes([]);
    if (cg.current) syncBoard(cg.current, chess.current, { movable: color });
    const tm = S.current.teams[t];
    flash(`¡Turno de ${tm.emoji} ${tm.name}!`, tm.color, 1400);
    cheer('teamTurn', { team: tm.name });
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
    if (s.p + 1 >= pool.length) { onEnd(pool.length); return; }
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
      s.picked = null; s.counted = new Set();
      setSteal(true); setTurn(s.turn); setPicked(null);
      const tm = S.current.teams[s.turn];
      flash(`${timeout ? '⏰ ¡Tiempo! ' : '❌ '}¡REBOTE para ${tm.emoji} ${tm.name}!`, tm.color, 1800);
      cheer('teamRebound', { team: tm.name });
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
      const pts = s.steal ? POINTS.steal : POINTS.solve;
      const tm = S.current.teams[s.turn];
      award(s.turn, pts);
      // Credit the kid the dice picked for this turn (if any).
      const hero = s.picked && tm.members.some((k) => k.id === s.picked!.id) ? s.picked : null;
      if (hero) {
        setTallies((all) => {
          const cur = all[hero.id] ?? EMPTY;
          return { ...all, [hero.id]: { ...cur, solved: cur.solved + 1, points: cur.points + pts } };
        });
      }
      sfx.levelUp();
      burst(0.5, 0.5, 1.4);
      flash(hero ? `✅ ¡+${pts} para ${tm.emoji} ${tm.name}! ¡Bravo, ${hero.name}!` : `✅ ¡+${pts} para ${tm.emoji} ${tm.name}!`, tm.color, 2000);
      if (hero && Math.random() < 0.4) cheer('kidPoint', { name: hero.name });
      else cheer('teamPoint', { team: tm.name });
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
      if (k < spins) { setTimeout(step, 60 + k * 12); return; }
      setRolling(null); setPicked(m); sfx.coin(); cheer('kidPicked', { name: m.name });
      const s = S.current;
      s.picked = m;
      // One pick per kid per turn, however many times the dice is rolled.
      if (!s.counted.has(m.id)) {
        s.counted.add(m.id);
        setTallies((all) => ({ ...all, [m.id]: { ...(all[m.id] ?? EMPTY), picks: (all[m.id] ?? EMPTY).picks + 1 } }));
      }
    };
    step();
  }

  const maxScore = Math.max(1, ...teams.map((t) => t.score));
  const livePts = kidPoints(teams.map((t) => t.score), tallyList(teams, tallies));
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
            <div class="mt-2 hidden flex-wrap gap-1 lg:flex">
              {t.members.map((m) => {
                const p = livePts.get(m.id) ?? 0;
                return (
                  <span key={m.id} title={m.name} class={`inline-flex items-center gap-0.5 rounded-full px-1.5 text-xl ${picked?.id === m.id && i === turn ? 'bg-amber-400 text-amber-950' : 'bg-black/25'}`}>
                    {m.avatar}{p ? <b class="text-base">+{fmtPoints(p)}</b> : null}
                  </span>
                );
              })}
            </div>
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
        <button onClick={() => { clock(false); onEnd(S.current.p + 1); }} class="min-h-11 px-3 text-sm font-bold text-violet-200">🏁 Terminar</button>
      </aside>

      {banner && (
        <div class="pointer-events-none fixed inset-x-0 top-1/3 z-40 flex justify-center px-4">
          <div class="rounded-3xl px-10 py-6 text-center font-display text-4xl font-extrabold text-white shadow-2xl md:text-6xl" style={{ background: banner.color, animation: 'ck-pop .4s cubic-bezier(.2,.9,.3,1.4) both' }}>{banner.text}</div>
        </div>
      )}
    </div>
  );
}

interface PodiumProps {
  teams: Team[]; tallies: Tallies; budget: number; canAward: boolean; classId: number;
  run: { nonce: string; startedAt: number }; played: number; onAgain: () => void; backUrl: string;
}

type SaveState = { state: 'idle' | 'saving' | 'done' | 'error'; msg?: string; xp?: Map<number, number>; stickers?: number };

function Podium({ teams, tallies, budget, canAward, classId, run, played, onAgain, backUrl }: PodiumProps) {
  const costume = useVoiceId();
  const sorted = [...teams].sort((a, b) => b.score - a.score);
  const tie = sorted.length > 1 && sorted[0].score === sorted[1].score;
  const kids = tallyList(teams, tallies);
  const pts = kidPoints(teams.map((t) => t.score), kids);
  const preview = new Map(distributeXp(budget, teams.map((t) => t.score), kids).map((x) => [x.studentId, x.total]));
  const [save, setSave] = useState<SaveState>({ state: 'idle' });
  const canSave = canAward && kids.length > 0;
  const unsaved = canSave && save.state !== 'done';

  useEffect(() => {
    sfx.fanfare();
    setTimeout(() => sfx.levelUp(), 700);
    sideCannons();
    setTimeout(sideCannons, 1200);
    if (tie) cheer('tie');
    else cheer('teamWin', { team: sorted[0].name });
  }, []);

  async function saveResults() {
    setSave({ state: 'saving' });
    try {
      const res = await fetch('/api/coach/projector', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          classId, nonce: run.nonce, xpBudget: budget, puzzlesPlayed: played,
          seconds: Math.round((Date.now() - run.startedAt) / 1000),
          teams: teams.map(({ name, emoji, color, score }) => ({ name, emoji, color, score })), kids,
        }),
      });
      const data: { error?: string; results: { studentId: number; total: number }[]; newStickers?: Record<number, string[]> } = await res.json();
      if (!res.ok) { setSave({ state: 'error', msg: data.error ?? 'No se pudo guardar' }); return; }
      const xp = new Map(data.results.map((r) => [r.studentId, r.total]));
      const stickers = Object.values(data.newStickers ?? {}).reduce((n, l) => n + l.length, 0);
      setSave({ state: 'done', xp, stickers });
      sfx.coin();
      setTimeout(() => sfx.levelUp(), 300);
      sideCannons();
      cheer(budget ? 'xpShared' : 'saved');
    } catch {
      setSave({ state: 'error', msg: 'Sin conexión. Inténtalo otra vez.' });
    }
  }

  function again() {
    if (unsaved && !confirm(budget ? '¿Seguro? Todavía no has repartido el XP de este torneo.' : '¿Seguir sin guardar el resultado?')) return;
    onAgain();
  }

  const heights = ['h-48', 'h-36', 'h-28', 'h-20'];
  const order = sorted.length >= 3 ? [1, 0, 2, 3].filter((i) => i < sorted.length) : sorted.map((_, i) => i);
  const xpOf = (id: number) => save.xp?.get(id) ?? preview.get(id) ?? 0;
  return (
    <div class="ck-projector flex min-h-dvh flex-col items-center p-6">
      <Potroculo costume={costume} mood="party" size={150} />
      <h1 class="text-center font-display text-5xl font-extrabold md:text-6xl">{tie ? '¡EMPATE! 🤝' : `¡Ganan ${sorted[0].emoji} ${sorted[0].name}!`}</h1>
      <div class="mt-8 flex items-end gap-4">
        {order.map((i) => {
          const t = sorted[i];
          const place = sorted.findIndex((x) => x.score === t.score); // ties share a step
          return (
            <div key={t.name} class="flex w-32 flex-col items-center md:w-44">
              <span class="text-5xl">{t.emoji}</span>
              <span class="font-display text-2xl font-extrabold">{t.name}</span>
              <span class="text-3xl">{['🥇', '🥈', '🥉', '🎖️'][place]}</span>
              <div class={`mt-2 flex w-full items-start justify-center rounded-t-3xl pt-3 font-display text-5xl font-extrabold ${heights[place]}`} style={{ background: t.color, animation: `ck-rise .6s ${0.2 * (3 - i)}s both` }}>{t.score}</div>
            </div>
          );
        })}
      </div>

      {kids.length > 0 && (
        <div class="mt-8 w-full max-w-6xl">
          <h2 class="text-center font-display text-3xl font-extrabold">📋 ¿Qué hizo cada uno?</h2>
          <p class="mt-1 text-center text-lg text-violet-100">⭐ puntos para su equipo (los que no se ganaron con el dado se reparten entre todos) · 🎲 veces que salió con el dado</p>
          <div class="mt-4 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            {sorted.map((t) => (
              <div key={t.name} class="rounded-3xl p-4" style={{ background: `${t.color}33`, border: `3px solid ${t.color}` }}>
                <p class="font-display text-xl font-extrabold">{t.emoji} {t.name} · {t.score} pts</p>
                <ul class="mt-2 space-y-1">
                  {[...t.members].sort((a, b) => xpOf(b.id) - xpOf(a.id)).map((m) => {
                    const k = tallies[m.id] ?? EMPTY;
                    return (
                      <li key={m.id} class="flex items-center gap-2 rounded-2xl bg-black/20 px-3 py-2 text-lg">
                        <span class="text-2xl">{m.avatar}</span>
                        <span class="flex-1 truncate font-bold">{m.name}</span>
                        <span title="Puntos para su equipo">⭐ {fmtPoints(pts.get(m.id) ?? 0)}</span>
                        <span title="Veces que salió con el dado">🎲 {k.picks}</span>
                        {budget > 0 && canAward && (
                          <span class={`rounded-full px-2 font-display font-extrabold ${save.state === 'done' ? 'bg-amber-400 text-amber-950' : 'bg-white/20'}`} style={save.state === 'done' ? 'animation: ck-pop .5s ease-out' : ''}>
                            {save.state === 'done' ? `+${xpOf(m.id)} XP ✅` : `≈ +${xpOf(m.id)} XP`}
                          </span>
                        )}
                      </li>
                    );
                  })}
                  {!t.members.length && <li class="text-sm opacity-80">Sin alumnos</li>}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <div class="mt-8 flex flex-col items-center gap-3">
        {unsaved && (
          <button onClick={saveResults} disabled={save.state === 'saving'} class="ck-btn ck-btn-orange px-10 py-5 text-2xl">
            {save.state === 'saving' ? 'Guardando…' : budget ? '🎁 Repartir el XP' : '💾 Guardar resultado'}
          </button>
        )}
        {save.state === 'done' && (
          <p class="rounded-2xl bg-emerald-500/30 px-5 py-3 text-xl font-bold">
            {budget ? '✅ ¡XP repartido!' : '✅ Resultado guardado'}
            {save.stickers ? ` · 🎉 ${save.stickers} ${save.stickers > 1 ? 'cromos nuevos' : 'cromo nuevo'}` : ''}
          </p>
        )}
        {save.state === 'error' && <p class="rounded-2xl bg-white/15 px-4 py-2 font-bold">😕 {save.msg}</p>}
        <div class="flex gap-4">
          <button onClick={again} class="ck-btn bg-white/20 text-white">↺ Otra ronda</button>
          <a href={backUrl} onClick={(e) => { if (unsaved && !confirm('¿Salir sin guardar el torneo?')) e.preventDefault(); }} class="ck-btn bg-white/20 text-white">Salir</a>
        </div>
      </div>
    </div>
  );
}

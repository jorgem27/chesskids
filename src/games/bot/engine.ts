// Thin UCI wrapper around Stockfish (lite, single-thread WASM, served from /engine).
// Client-only. If the worker can't start or is too slow, callers get the built-in fallback bot.
import { fallbackMove, LEVELS, type BotLevel } from './logic';

const ENGINE_URL = '/engine/stockfish-19-lite-single.js';
const SEARCH_TIMEOUT = 4000;

export class BotEngine {
  private worker: Worker | null = null;
  private ready: Promise<boolean>;
  private listeners = new Set<(line: string) => void>();

  constructor() {
    this.ready = this.boot();
  }

  private boot(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const w = new Worker(ENGINE_URL);
        this.worker = w;
        w.onmessage = (e) => {
          const line = String(e.data);
          this.listeners.forEach((fn) => fn(line));
        };
        w.onerror = () => resolve(false);
        this.waitFor('uciok', 8000).then((ok) => {
          if (!ok) return resolve(false);
          this.send('isready');
          this.waitFor('readyok', 8000).then(resolve);
        });
        this.send('uci');
      } catch {
        resolve(false);
      }
    });
  }

  private send(cmd: string) { this.worker?.postMessage(cmd); }

  private waitFor(prefix: string, ms: number): Promise<boolean> {
    return new Promise((resolve) => {
      const done = (v: boolean) => { clearTimeout(t); this.listeners.delete(fn); resolve(v); };
      const fn = (line: string) => { if (line.startsWith(prefix)) done(true); };
      const t = setTimeout(() => done(false), ms);
      this.listeners.add(fn);
    });
  }

  /** Best move (UCI) for the side to move, or null if there are no legal moves. */
  async bestMove(fen: string, level: BotLevel): Promise<string | null> {
    if (await this.ready) {
      const cfg = LEVELS[level];
      const result = new Promise<string | null>((resolve) => {
        const t = setTimeout(() => { this.listeners.delete(fn); this.send('stop'); resolve(undefined as any); }, SEARCH_TIMEOUT);
        const fn = (line: string) => {
          if (!line.startsWith('bestmove')) return;
          clearTimeout(t);
          this.listeners.delete(fn);
          const mv = line.split(' ')[1];
          resolve(!mv || mv === '(none)' ? null : mv);
        };
        this.listeners.add(fn);
      });
      this.send(`setoption name Skill Level value ${cfg.skill}`);
      this.send(`position fen ${fen}`);
      this.send(`go depth ${cfg.depth} movetime ${cfg.movetime}`);
      const mv = await result;
      if (mv !== undefined) return mv;
    }
    return fallbackMove(fen);
  }

  destroy() {
    this.listeners.clear();
    this.worker?.terminate();
    this.worker = null;
  }
}

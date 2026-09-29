// Preact wrapper around Lichess Chessground.
import { Chessground } from '@lichess-org/chessground';
import type { Api } from '@lichess-org/chessground/api';
import type { Config } from '@lichess-org/chessground/config';
import type { Key } from '@lichess-org/chessground/types';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { Chess } from 'chess.js';
import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';

export interface BoardProps {
  config: Config;
  onReady?: (api: Api) => void;
  class?: string;
  shake?: number; // change this number to trigger a shake animation
  glow?: number; // change to trigger a green glow
  children?: ComponentChildren; // overlays (fruits, emojis…)
}

export function Board({ config, onReady, class: cls = '', shake = 0, glow = 0, children }: BoardProps) {
  const el = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);

  useEffect(() => {
    if (!el.current) return;
    api.current = Chessground(el.current, {
      animation: { enabled: true, duration: 260 },
      highlight: { lastMove: true, check: true },
      premovable: { enabled: false },
      drawable: { enabled: true, visible: true },
      coordinates: true,
      ...config,
    });
    onReady?.(api.current);
    const ro = new ResizeObserver(() => api.current?.redrawAll());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      api.current?.destroy();
    };
  }, []);

  useEffect(() => {
    if (!shake || !wrap.current) return;
    wrap.current.classList.remove('ck-shake');
    void wrap.current.offsetWidth;
    wrap.current.classList.add('ck-shake');
  }, [shake]);

  useEffect(() => {
    if (!glow || !wrap.current) return;
    wrap.current.classList.remove('ck-glow');
    void wrap.current.offsetWidth;
    wrap.current.classList.add('ck-glow');
  }, [glow]);

  return (
    <div ref={wrap} class={`ck-board relative aspect-square w-full ${cls}`}>
      <div ref={el} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      {children}
    </div>
  );
}

/** Legal destinations for Chessground from a chess.js position. */
export function toDests(chess: Chess): Map<Key, Key[]> {
  const dests = new Map<Key, Key[]>();
  for (const m of chess.moves({ verbose: true })) {
    const list = dests.get(m.from as Key) ?? [];
    if (!list.includes(m.to as Key)) list.push(m.to as Key);
    dests.set(m.from as Key, list);
  }
  return dests;
}

export function turnColor(chess: Chess): 'white' | 'black' {
  return chess.turn() === 'w' ? 'white' : 'black';
}

/** Sync the board to a chess.js position; `movable` = who can move now (or none). */
export function syncBoard(api: Api, chess: Chess, opts: { movable: 'white' | 'black' | null; lastMove?: string }) {
  api.set({
    fen: chess.fen(),
    turnColor: turnColor(chess),
    check: chess.inCheck(),
    lastMove: opts.lastMove ? [opts.lastMove.slice(0, 2) as Key, opts.lastMove.slice(2, 4) as Key] : undefined,
    movable: {
      free: false,
      color: opts.movable ?? undefined,
      dests: opts.movable ? toDests(chess) : new Map(),
      showDests: true,
    },
  });
}

/** Detect whether a move from→to is a pawn promotion. */
export function isPromotion(chess: Chess, from: string, to: string): boolean {
  const p = chess.get(from as any);
  return !!p && p.type === 'p' && (to[1] === '8' || to[1] === '1');
}

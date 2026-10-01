// Collects per-item results (ItemResult) while a game runs. No Preact imports: games keep one in a ref.
import type { ItemResult } from './types';

export function itemTracker() {
  const items: ItemResult[] = [];
  let t0 = Date.now();
  return {
    /** Item `i` is on screen: time starts now (a replay of the same item keeps adding time). */
    start() { t0 = Date.now(); },
    /** Records item `i`. A retry adds mistakes and time but can't make a failed item ok (first try counts). */
    done(i: number, ok: boolean, mistakes: number) {
      const seconds = Math.min(3600, Math.round((Date.now() - t0) / 1000));
      const prev = items[i];
      items[i] = prev
        ? { ok: prev.ok && ok, mistakes: prev.mistakes + mistakes, seconds: prev.seconds + seconds }
        : { ok, mistakes, seconds };
      t0 = Date.now();
    },
    list(count: number): ItemResult[] {
      return Array.from({ length: count }, (_, i) => items[i] ?? { ok: false, mistakes: 0, seconds: 0 });
    },
  };
}

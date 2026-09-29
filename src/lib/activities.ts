import { getMeta } from '../games/meta';

export interface ActivityBody { clubId: number; type: string; title: string; description?: string; xpReward?: number; content: unknown }

export function checkActivity(b: ActivityBody): string[] {
  let meta;
  try { meta = getMeta(b.type); } catch { return ['Tipo de juego desconocido']; }
  const errs: string[] = [];
  if (!String(b.title ?? '').trim()) errs.push('Pon un título');
  errs.push(...meta.validate(b.content as any));
  return errs;
}

export function clampXp(xp: unknown, type: string): number {
  return Math.max(5, Math.min(200, Number(xp) || getMeta(type).defaultXp));
}

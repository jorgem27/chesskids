const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function parse(d: string) { return new Date(d + 'T12:00:00Z'); }

export function daysBetween(from: string, to: string): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86400000);
}

/** "¡Hoy!", "Mañana", "Para el viernes", "Para el 12 oct", "Atrasada" */
export function dueLabel(due: string | null, today: string): { text: string; tone: 'late' | 'soon' | 'ok' | 'none' } {
  if (!due) return { text: 'Sin fecha', tone: 'none' };
  const n = daysBetween(today, due);
  if (n < 0) return { text: '¡Atrasada!', tone: 'late' };
  if (n === 0) return { text: '¡Para hoy!', tone: 'soon' };
  if (n === 1) return { text: 'Para mañana', tone: 'soon' };
  if (n < 7) return { text: `Para el ${DAYS[parse(due).getUTCDay()]}`, tone: 'ok' };
  return { text: `Para el ${shortDate(due)}`, tone: 'ok' };
}

export function shortDate(d: string): string {
  const x = parse(d);
  return `${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]}`;
}

export function addDays(d: string, n: number): string {
  const x = parse(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

export function relativeDay(d: string | null, today: string): string {
  if (!d) return 'nunca';
  const n = daysBetween(d, today);
  if (n === 0) return 'hoy';
  if (n === 1) return 'ayer';
  return `hace ${n} días`;
}

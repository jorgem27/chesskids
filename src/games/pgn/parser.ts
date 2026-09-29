// Minimal PGN parser with variations, comments and NAGs (pure, no chess logic).
// Produces a tree that lesson.ts replays with chess.js.

export interface PgnMove {
  san: string;
  comment: string; // raw comment text after this move (tags included)
  nags: number[];
  variations: PgnMove[][]; // alternatives to THIS move (start from the same position)
}

export interface PgnGame {
  headers: Record<string, string>;
  startComment: string;
  moves: PgnMove[];
}

type Tok =
  | { t: 'header'; key: string; value: string }
  | { t: 'comment'; v: string }
  | { t: 'open' }
  | { t: 'close' }
  | { t: 'nag'; v: number }
  | { t: 'san'; v: string }
  | { t: 'result' };

const GLYPHS: Record<string, number> = { '!': 1, '?': 2, '!!': 3, '??': 4, '!?': 5, '?!': 6 };

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const s = src.replace(/\r\n?/g, '\n');
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '[') {
      const end = s.indexOf(']', i);
      const m = /^\[\s*(\w+)\s+"((?:[^"\\]|\\.)*)"\s*\]$/.exec(s.slice(i, end + 1));
      if (m) toks.push({ t: 'header', key: m[1], value: m[2].replace(/\\"/g, '"') });
      i = end < 0 ? s.length : end + 1;
      continue;
    }
    if (c === '{') {
      const end = s.indexOf('}', i);
      toks.push({ t: 'comment', v: s.slice(i + 1, end < 0 ? s.length : end).trim() });
      i = end < 0 ? s.length : end + 1;
      continue;
    }
    if (c === ';') {
      const end = s.indexOf('\n', i);
      toks.push({ t: 'comment', v: s.slice(i + 1, end < 0 ? s.length : end).trim() });
      i = end < 0 ? s.length : end + 1;
      continue;
    }
    if (c === '(') { toks.push({ t: 'open' }); i++; continue; }
    if (c === ')') { toks.push({ t: 'close' }); i++; continue; }
    if (c === '$') {
      const m = /^\$(\d+)/.exec(s.slice(i));
      if (m) { toks.push({ t: 'nag', v: Number(m[1]) }); i += m[0].length; continue; }
      i++; continue;
    }
    // word
    const m = /^[^\s{}()\[\];$]+/.exec(s.slice(i));
    if (!m) { i++; continue; }
    let w = m[0];
    i += w.length;
    if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(w)) { toks.push({ t: 'result' }); continue; }
    w = w.replace(/^\d+\.+/, ''); // "12.e4" or "12..."
    if (!w) continue;
    const g = /([!?]+)$/.exec(w);
    if (g) {
      w = w.slice(0, -g[1].length);
      if (w) toks.push({ t: 'san', v: w });
      if (GLYPHS[g[1]]) toks.push({ t: 'nag', v: GLYPHS[g[1]] });
      continue;
    }
    if (/^\d+$/.test(w)) continue;
    toks.push({ t: 'san', v: w });
  }
  return toks;
}

export function parsePgn(src: string): PgnGame {
  const toks = tokenize(src);
  const headers: Record<string, string> = {};
  let startComment = '';
  let p = 0;

  function parseLine(isRoot: boolean): PgnMove[] {
    const line: PgnMove[] = [];
    let pending = ''; // comment written before the first move of a variation
    while (p < toks.length) {
      const tk = toks[p];
      p++;
      if (tk.t === 'header') { if (isRoot) headers[tk.key] = tk.value; continue; }
      if (tk.t === 'close') { if (!isRoot) return line; continue; }
      if (tk.t === 'result') continue;
      if (tk.t === 'comment') {
        if (line.length) {
          const last = line[line.length - 1];
          last.comment = (last.comment + ' ' + tk.v).trim();
        } else if (isRoot) startComment = (startComment + ' ' + tk.v).trim();
        else pending = (pending + ' ' + tk.v).trim();
        continue;
      }
      if (tk.t === 'nag') { if (line.length) line[line.length - 1].nags.push(tk.v); continue; }
      if (tk.t === 'open') {
        const variation = parseLine(false);
        if (line.length && variation.length) line[line.length - 1].variations.push(variation);
        continue;
      }
      if (tk.t === 'san') {
        line.push({ san: tk.v, comment: pending, nags: [], variations: [] });
        pending = '';
      }
    }
    return line;
  }

  const moves = parseLine(true);
  return { headers, startComment, moves };
}

// ---------- Comment tags ----------

export interface Shape { orig: string; dest?: string; brush: string }

export interface CommentInfo {
  text: string;
  ask?: string;
  pts?: number;
  wait: boolean;
  shapes: Shape[];
}

const BRUSH: Record<string, string> = { G: 'green', R: 'red', Y: 'yellow', B: 'blue' };

/**
 * Tags supported inside PGN comments:
 *  [%ask ¿Pregunta?]   pause after this move and ask the student to play the next move
 *  [%pts 50]           points for this move when it is an answer (main answer defaults to 100)
 *  [%wait]             pause here until the student taps "Continuar"
 *  [%cal Ge2e4,Rd1d8]  arrows (Lichess format)   [%csl Gd4,Re5]  circles (Lichess format)
 */
export function parseComment(raw: string): CommentInfo {
  const info: CommentInfo = { text: '', wait: false, shapes: [] };
  let text = raw;
  text = text.replace(/\[%ask\s+([^\]]*)\]/gi, (_, q) => { info.ask = q.trim() || '¿Cuál es la mejor jugada?'; return ''; });
  text = text.replace(/\[%pts\s+(-?\d+)\s*\]/gi, (_, n) => { info.pts = Number(n); return ''; });
  text = text.replace(/\[%wait\s*\]/gi, () => { info.wait = true; return ''; });
  text = text.replace(/\[%cal\s+([^\]]*)\]/gi, (_, list: string) => {
    for (const a of list.split(',').map((x) => x.trim())) {
      const m = /^([GRYB])([a-h][1-8])([a-h][1-8])$/.exec(a);
      if (m) info.shapes.push({ brush: BRUSH[m[1]], orig: m[2], dest: m[3] });
    }
    return '';
  });
  text = text.replace(/\[%csl\s+([^\]]*)\]/gi, (_, list: string) => {
    for (const a of list.split(',').map((x) => x.trim())) {
      const m = /^([GRYB])([a-h][1-8])$/.exec(a);
      if (m) info.shapes.push({ brush: BRUSH[m[1]], orig: m[2] });
    }
    return '';
  });
  text = text.replace(/\[%[^\]]*\]/g, ''); // ignore other engine tags (clk, eval...)
  info.text = text.replace(/\s+/g, ' ').trim();
  return info;
}

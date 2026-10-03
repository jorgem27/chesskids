// Tiny static board from a FEN (no chessground, no chess.js): keeps the chat island light.
const GLYPH: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };

export function MiniFen({ fen, size = 132, flip }: { fen: string; size?: number; flip?: boolean }) {
  const [placement = '', turn = 'w'] = fen.split(' ');
  const rows = placement.split('/').map((r) => r.replace(/\d/g, (d) => '.'.repeat(Number(d))).padEnd(8, '.').slice(0, 8).split(''));
  while (rows.length < 8) rows.push('........'.split(''));
  const black = flip ?? turn === 'b';
  const view = black ? rows.slice().reverse().map((r) => r.slice().reverse()) : rows;
  return (
    <div class="inline-grid shrink-0 grid-cols-8 overflow-hidden rounded-lg ring-1 ring-slate-300" style={{ width: size, height: size }}
      role="img" aria-label={`Tablero, juegan ${turn === 'b' ? 'negras' : 'blancas'}`}>
      {view.flatMap((row, y) => row.map((c, x) => {
        const white = c !== '.' && c === c.toUpperCase();
        return (
          <span key={`${x}${y}`} class="flex items-center justify-center leading-none"
            style={{ background: (x + y) % 2 ? '#86c06c' : '#eef6d9', fontSize: size / 9, color: white ? '#fff' : '#111', textShadow: white ? '0 0 1px #000,0 0 1px #000,0 0 1px #000' : 'none' }}>
            {GLYPH[c.toLowerCase()] ?? ''}
          </span>
        );
      }))}
    </div>
  );
}

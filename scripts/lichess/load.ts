/**
 * Loads seed/lichess/*.sql into D1 (local by default).
 *
 *   npm run puzzles:load                          # local
 *   npm run puzzles:load -- --remote              # PRODUCTION: only run this yourself
 *   npm run puzzles:load -- --remote --from 012   # resume from a file after a failure
 *
 * Files use INSERT OR REPLACE, so re-running any of them is safe.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const remote = process.argv.includes('--remote');
const dir = fileURLToPath(new URL('../../seed/lichess/', import.meta.url));
const fromArg = process.argv.indexOf('--from');
const from = fromArg > 0 ? process.argv[fromArg + 1] : '';
const files = readdirSync(dir).filter((f) => f.endsWith('.sql') && f >= from).sort();
if (!files.length) {
  console.error('No hay ficheros en seed/lichess/. Ejecuta antes: npm run puzzles:build -- <csv>');
  process.exit(1);
}
for (const f of files) {
  console.log(`→ ${f} (${remote ? 'REMOTO' : 'local'})`);
  try {
    execFileSync('npx', ['wrangler', 'd1', 'execute', 'chesskids', remote ? '--remote' : '--local', '--yes', `--file="${dir}${f}"`],
      { stdio: ['ignore', 'ignore', 'inherit'], shell: true });
  } catch {
    console.error(`
❌ Falló ${f}. Para continuar: npm run puzzles:load -- ${remote ? '--remote ' : ''}--from ${f.replace('.sql', '')}`);
    process.exit(1);
  }
}
console.log(`✅ ${files.length} ficheros cargados`);

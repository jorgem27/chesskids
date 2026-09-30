// Claude Code "Stop" hook: before Claude finishes, run type-check + tests if source files changed.
// Exit code 2 sends the errors back to Claude so it fixes them; exit 0 lets it finish.
import { execSync } from 'node:child_process';

let input = '';
for await (const chunk of process.stdin) input += chunk;
let payload = {};
try { payload = JSON.parse(input); } catch {}
// Already continuing because of this hook: don't loop forever.
if (payload.stop_hook_active) process.exit(0);

const changed = execSync('git status --porcelain', { encoding: 'utf8' })
  .split('\n')
  .some((l) => /\.(ts|tsx|astro|mjs|css)$/.test(l) && /(^|\s)"?(src|tests)\//.test(l));
if (!changed) process.exit(0);

for (const cmd of ['npm run check', 'npm test']) {
  try {
    execSync(cmd, { stdio: 'pipe', encoding: 'utf8', timeout: 240000 });
  } catch (e) {
    const out = `${e.stdout ?? ''}${e.stderr ?? ''}`.split('\n').slice(-40).join('\n');
    console.error(`"${cmd}" failed. Fix these before finishing:\n${out}`);
    process.exit(2);
  }
}

// One-step publish: commit, push to origin main, then apply new migrations to PRODUCTION D1.
// Usage: npm run push -- "commit message"   (deploying stays a separate step: npm run deploy)
import { execSync } from 'node:child_process';

const message = process.argv.slice(2).join(' ').trim() || `Update ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

console.log('[1/3] Commit');
run('git add -A');
let pending = true;
try { execSync('git diff --cached --quiet'); pending = false; } catch { /* exit 1 = staged changes */ }
if (pending) execSync('git commit -F -', { input: message, stdio: ['pipe', 'inherit', 'inherit'] });
else console.log('No new local changes to commit.');

console.log('[2/3] Push to origin main');
run('git push origin main');

console.log('[3/3] Apply migrations to remote D1');
try { run('npm run db:migrate:remote'); }
catch { console.error('Remote migration failed or was cancelled. Check `npx wrangler login`.'); process.exit(1); }

console.log('Done. To deploy to Cloudflare: npm run deploy');

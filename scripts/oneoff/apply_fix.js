import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
const dbPath = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/9ba2b04bf514d9facfd57ed57d849e77241a7adc99d1c1545d06688b43d84248.sqlite';
const db = new DatabaseSync(dbPath);
const sql = fs.readFileSync('scripts/oneoff/fix_remote.sql', 'utf8');
const statements = sql.split(';');
for (const stmt of statements) {
    if (stmt.trim()) db.exec(stmt);
}
console.log('Fixed local db.');

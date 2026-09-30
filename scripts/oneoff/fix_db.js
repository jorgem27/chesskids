import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';

const dbPath = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/9ba2b04bf514d9facfd57ed57d849e77241a7adc99d1c1545d06688b43d84248.sqlite';
const db = new DatabaseSync(dbPath);

const sql = fs.readFileSync('seed/demo.sql', 'utf8');
const statements = sql.split(';').filter(s => s.trim() !== '');

let count = 0;
for (const stmt of statements) {
    if (stmt.includes('INSERT INTO activities') || stmt.includes('INSERT INTO assignments') || stmt.includes('INSERT INTO attempts')) {
        try {
            db.exec(stmt);
            count++;
        } catch (e) {
            if (!e.message.includes('UNIQUE constraint failed')) {
               console.error("Error executing:", stmt.substring(0, 50), e.message);
            }
        }
    }
}
console.log(`Inserted ${count} records into the active database.`);

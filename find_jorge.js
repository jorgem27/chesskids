import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

function findSqliteFiles(dir) {
    let results = [];
    try {
        const list = fs.readdirSync(dir);
        for (const file of list) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat && stat.isDirectory() && !filePath.includes('node_modules')) {
                results = results.concat(findSqliteFiles(filePath));
            } else if (filePath.endsWith('.sqlite')) {
                results.push(filePath);
            }
        }
    } catch(e) {}
    return results;
}

const files = findSqliteFiles(process.cwd());
for (const file of files) {
    try {
        const db = new DatabaseSync(file);
        // check if coaches table exists
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='coaches'").all();
        if (tables.length > 0) {
            const jorge = db.prepare("SELECT * FROM coaches WHERE name LIKE '%Jorge%'").all();
            if (jorge.length > 0) {
                console.log(`Found Jorge in ${file}`);
            }
        }
    } catch(e) {
    }
}
console.log("Done searching.");

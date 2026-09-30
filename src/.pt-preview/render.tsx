/** @jsxImportSource preact */
import { render } from 'preact-render-to-string';
import { h } from 'preact';
import { readFileSync, writeFileSync } from 'node:fs';
import { Potroculo } from './P';
const moods = ['happy','wave','party','run','angry','sad','wow','think'] as const;
const css = readFileSync('src/components/ui/potroculo.css','utf8');
const cells = moods.map(m => `<figure>${render(h(Potroculo,{mood:m,size:+(process.argv[3]||200)}))}<figcaption>${m}</figcaption></figure>`).join('')
 + `<figure>${render(h(Potroculo,{mood:'happy',size:+(process.argv[3]||200),talking:true}))}<figcaption>talking</figcaption></figure>`
 + `<figure>${render(h(Potroculo,{mood:'happy',size:72}))}<figcaption>72px</figcaption></figure>`;
writeFileSync(process.argv[2], `<!doctype html><meta charset=utf-8><style>body{font-family:sans-serif;background:#f5f3ff;display:flex;flex-wrap:wrap;gap:16px;padding:16px}figure{background:#fff;border-radius:16px;padding:8px;margin:0;text-align:center}${css}</style>${cells}`);

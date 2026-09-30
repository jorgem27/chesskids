// Pre-records every fixed line of every AI coach as a small MP3 in public/voices/<coach>/.
// Clips are static files, so playing them costs nothing no matter how many times.
//
//   npm run voices              # all coaches (only missing clips are generated)
//   npm run voices -- robo      # one coach
//   npm run voices -- --list    # just print how many lines each coach has
//
// Needs: Python with `pip install edge-tts` (free Microsoft neural voices, no key) and ffmpeg.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { COACHES, coachTemplates, type Coach } from '../../src/lib/voice/coaches';
import { BANKS, cleanForSpeech, clipId, expand, type Cue } from '../../src/lib/voice/phrases';

const OUT = join(process.cwd(), 'public', 'voices');
const PYTHON = process.env.PYTHON ?? 'python';
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const CONCURRENCY = 6;
// Part of each coach's version: changing it re-records everything.
const TRIM = 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse';
const ENCODE = { level: 'loudnorm=I=-16:TP=-1.5:LRA=11', pad: 'apad=pad_dur=0.08', bitrate: '40k' };

/** All texts a coach can say that can be pre-recorded. */
export function recordableLines(coach: Coach): string[] {
  const out = new Set<string>();
  for (const cue of Object.keys(BANKS) as Cue[]) {
    for (const t of coachTemplates(coach, cue, BANKS[cue])) for (const text of expand(t)) out.add(cleanForSpeech(text));
  }
  for (const t of coach.intro) out.add(cleanForSpeech(t));
  return [...out].filter(Boolean);
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${err.slice(-400)}`))));
  });
}

async function record(coach: Coach, text: string, dest: string) {
  const raw = join(tmpdir(), `ck-voice-${process.pid}-${Math.random().toString(36).slice(2)}.mp3`);
  try {
    await run(PYTHON, ['-m', 'edge_tts', '--voice', coach.tts.voice, `--rate=${coach.tts.rate}`, `--pitch=${coach.tts.pitch}`, '--text', text, '--write-media', raw]);
    // Trim silence, apply the coach effect, even loudness across coaches, small mono MP3.
    const af = [TRIM, coach.tts.filter, ENCODE.level, ENCODE.pad].filter(Boolean).join(',');
    await run(FFMPEG, ['-y', '-loglevel', 'error', '-i', raw, '-af', af, '-ac', '1', '-ar', '24000', '-b:a', ENCODE.bitrate, dest]);
  } finally {
    rmSync(raw, { force: true });
  }
}

async function withRetry(fn: () => Promise<void>, tries = 3) {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

async function generate(coach: Coach) {
  const dir = join(OUT, coach.id);
  const sig = createHash('sha1').update(JSON.stringify([coach.tts, TRIM, ENCODE])).digest('hex').slice(0, 10);
  const manifestPath = join(dir, 'manifest.json');
  const old = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
  if (old && old.v !== sig) rmSync(dir, { recursive: true, force: true }); // voice settings changed: redo all
  mkdirSync(dir, { recursive: true });

  const lines = recordableLines(coach);
  const wanted = new Map(lines.map((t) => [clipId(t), t]));
  if (wanted.size !== lines.length) throw new Error(`clipId collision for ${coach.id}`);
  const todo = [...wanted].filter(([id]) => !existsSync(join(dir, `${id}.mp3`)));
  console.log(`${coach.emoji} ${coach.name}: ${lines.length} lines, ${todo.length} to record`);

  let done = 0;
  const failed: string[] = [];
  const queue = [...todo];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const [id, text] = item;
      try { await withRetry(() => record(coach, text, join(dir, `${id}.mp3`))); } catch (e) {
        failed.push(text);
        console.error(`  ✗ "${text}": ${(e as Error).message}`);
      }
      if (++done % 25 === 0) console.log(`  ${done}/${todo.length}`);
    }
  }));

  // Drop clips for lines that no longer exist.
  for (const f of readdirSync(dir)) {
    if (f.endsWith('.mp3') && !wanted.has(f.slice(0, -4))) rmSync(join(dir, f));
  }
  const clips = [...wanted.keys()].filter((id) => existsSync(join(dir, `${id}.mp3`))).sort();
  writeFileSync(manifestPath, JSON.stringify({ v: sig, voice: coach.tts.voice, clips }) + '\n');
  if (failed.length) console.warn(`  ${failed.length} failed; run again to retry them.`);
}

const args = process.argv.slice(2);
if (args.includes('--list')) {
  for (const c of COACHES) console.log(`${c.id.padEnd(10)} ${recordableLines(c).length} lines`);
} else {
  const pick = args.filter((a) => !a.startsWith('-'));
  const coaches = pick.length ? COACHES.filter((c) => pick.includes(c.id)) : COACHES;
  if (!coaches.length) { console.error(`Unknown coach. Options: ${COACHES.map((c) => c.id).join(', ')}`); process.exit(1); }
  for (const c of coaches) await generate(c);
}

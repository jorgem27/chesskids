# Potróculo's voices

Potróculo is always the mascot; what changes is how he talks: Clásico, Pirata, Robot, Animadora,
Entrenador, Caballero… Each voice is defined in `src/lib/voice/coaches.ts` (Edge TTS voice, speed,
pitch, audio effect and its own themed lines, mixed with the shared ones in `phrases.ts`).

Who picks it:
- **Students**, on their dashboard ("La voz de Potróculo"). Saved in `students.voice`, so it follows
  them to any device. Includes "Sorpresa" (random each session) and "Sin voz".
- **Coaches**, in the projector setup. Saved on that computer.

## How it plays (free forever)

1. Every fixed line is pre-recorded as a small MP3 in `public/voices/<coach>/` (~12 KB each).
   They are static files on Cloudflare, so playing them costs nothing, however often.
2. Lines that can't be pre-recorded (kids' names, coach-written puzzle text) use the device's
   built-in `speechSynthesis`, with a pitch/speed that roughly matches the coach.
3. The picker never repeats one of the last few lines for the same situation.

## Regenerating clips

```bash
pip install edge-tts        # once; ffmpeg must be on PATH
npm run voices              # all coaches, only missing clips
npm run voices -- robo      # one coach
npm run voices -- --list    # line counts
```

Edited a line? Just run it again: new lines get recorded and unused clips are removed.
Changing a coach's voice, speed, pitch or effect re-records that coach.

## Adding a voice

Add an entry to `COACHES` (never rename an existing id: it's stored in `students.voice`) in `src/lib/voice/coaches.ts`, run `npm run voices -- <id>`, and commit
`public/voices/<id>/`. List the voices with `python -m edge_tts --list-voices | grep ^es-`
(45+ Spanish voices: Spain, Mexico, Argentina, Colombia…). `filter` accepts any ffmpeg audio
filter (echo, robot, etc.).

## Free voice engines (options)

| Engine | Cost | Quality | Licence / notes |
|---|---|---|---|
| **Edge TTS** (used now) | Free, no key | Very good neural voices | Uses Microsoft Edge's online read-aloud service unofficially. Fine for a club app, but the terms are unclear for commercial use and it could stop working some day (the clips you already made keep working). |
| **Piper** (`pip install piper-tts`) | Free, offline | Good | MIT engine. Spanish voices: `es_ES-davefx`, `es_ES-sharvard`, `es_MX-claude`, `es_AR-daniela`. Check each voice's licence on its model card. |
| **Kokoro-82M** | Free, offline | Good | Apache 2.0 (clearest licence). Spanish voices: `ef_dora`, `em_alex`, `em_santa`. |
| **Gemini TTS** (Google AI Studio) | Included in AI Pro / free tier | Excellent, can act ("say it like an excited pirate") | 30 voices. Best for character voices; would need an API key and a small script change. |
| **ElevenLabs** (1 paid month) | About $5 for one month (Starter plan) | Excellent | Generate everything in one month and keep the files forever. |

If we switch engine, only `record()` in `generate.ts` changes: the player, phrases and picker stay the same.

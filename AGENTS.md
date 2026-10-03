# ChessKids Academy

Gamified chess-learning platform for kids (5–15), modeled after Duolingo: continuous rewards for time spent, games played and puzzles solved. The UI is entirely in **Spanish**. It launches for one chess club but the data model is multi-club from day one, and it must scale to thousands of students.

## Stack

- **Astro 7** (SSR on Cloudflare) + **Preact islands** for interactive parts; **Tailwind 4** for a colorful, kid-friendly UI.
- **Chessground** (`@lichess-org/chessground`) for the board, **chess.js** for move validation, PGN parsing and chess logic.
- **Cloudflare Workers + D1** (SQLite). Config in `wrangler.jsonc`, migrations in `migrations/`.
- Stockfish WASM runs in a Web Worker from `public/engine` (GPLv3, bot mode only).

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Local server at http://localhost:4321 |
| `npm run setup` | Apply migrations locally and load `seed/demo.sql` |
| `npm run check` | `astro check` (types). Run before finishing any change |
| `npm test` | Unit tests in `tests/` (`tsx --test`) |
| `npm run db:migrate` / `db:migrate:remote` | Apply migrations to local / **production** D1 |
| `npm run deploy` | Build and deploy to Cloudflare. Production; only when asked |
| `npm run push -- "message"` | One-step publish: commit, push, remote migrations (see below) |

## Layout

- `src/games/` – one folder per game type (`puzzle`, `pgn`, `fruit`, `bot`, `pdf`), plus `meta.ts` (metadata/validation), `registry.ts` (UI registration), `rules.ts`, `types.ts` (the `GameApi` contract).
- `src/lib/` – server/shared logic: `auth.ts`, `rewards.ts` (XP, levels, streaks, stickers, practice XP, tactics rating), `activities.ts`, `db.ts`, `catalog.ts`, `campaigns.ts` (adventure maps + rewards), `practice.ts` (Repaso / Problema del día / Entrena), `insights.ts` (per-item coach reports), `progress.ts` (shared sticker/reward tail), `outbox.ts` (offline result queue).
  Also: `clubs.ts` (invites, club admin checks), `privacy.ts` (GDPR export / erasure), `family.ts` (family report + WhatsApp summary), `report.ts` (class CSV / printable report), `seasons.ts` (term seasons, resettable ranking, season badges), `starter.ts` (starter content pack, validated in `tests/starter.test.ts`), `a11y.ts` (per-device accessibility settings), `push.ts` (opt-in streak reminders, VAPID), `mail.ts` (optional Resend email), `legal.ts` (data shown on `/privacidad` and `/aviso-legal`).
- `src/worker.ts` – Worker entry (`main` in `wrangler.jsonc`): Astro's handler plus the daily cron that sends streak reminders.
- `src/pages/` – `profe/` (coach panel), `app/` (student dashboard), `entrar` + `u/` + `c/` (student login/links), `api/` (endpoints). `src/middleware.ts` holds the route guards.
- `src/components/` – `coach/`, `student/`, `game/`, `projector/`, `ui/`.
- `tests/` – chess and game-logic tests. Add a test for every new solver, validator or reward rule.

## Product model

**Hierarchy:** clubs → classes (typically 6–10 students) → students. Coaches can belong to several clubs and manage several classes.

**Coaches** create games and lessons easily, and can grant granular per-class permissions to other coaches (for example, view a colleague's students' progress, or create games for a specific class). Activities are `public` (club library, club admins edit) or `private` (owned by one coach; editing a public one forks it).

**Students** log in to a gamified dashboard to play assigned games, solve puzzles and track rewards.

**Gamification:** XP for completing games, total time spent learning and total puzzles solved. The UI must reward visually *and* audibly, Duolingo-style (confetti, sounds, mascot, streaks, stickers, kingdoms map). Rewards are computed **on the server** (`/api/attempts`), never trusted from the client.

## Game modes

Coaches must be able to create content extremely easily, and developers must be able to add new game types with little code.

1. **Long puzzles (Hint mode)** – a mistake does not reveal the answer; it shows a visual hint (highlight the piece to move, then an arrow).
2. **Short puzzles (Blitz mode)** – rapid. A mistake immediately reveals the solution and moves to the next puzzle.
3. **Interactive PGN lessons** – the game auto-plays and pauses at critical moments. Text prompts live in PGN comments (`[%ask]`). The main line drives the game but alternative correct moves must be accepted, and coaches assign variable points per move (`[%pts N]`: full for the best move, half for a decent alternative).
4. **Fruit Collector** – move one piece (legal chess movement) to collect all the fruit on the board. The goal is the mathematically shortest path (exact solver in `src/games/fruit`).
5. **Play vs bot** and **PDF viewer** also exist beyond the original four.

Games report per-item results (`GameResult.items`, index = position in the content) through `itemTracker` (`src/games/items.ts`). They feed `item_results`, the coach heatmap (`/profe/clase/[id]/actividad/[aid]`), automatic reviews (`/api/coach/review`) and the student's "Practica tus fallos". Practice outside homework goes through server-served `practice_sessions` (`/app/practica/*` → `/api/practice`).

To add a new game type, use the `add-game-mode` skill (metadata in `meta.ts` → Player/Editor components → register in `registry.ts`).

## Working rules

- **Scalability first.** Every table with tenant data carries `club_id` (directly or through its parent), and every query filters by it. Never write a query that lists rows across clubs. Index the columns you filter or join on.
- **Authorization lives on the server.** Check the coach's role/permission (`class_permissions`, `club_coaches`) in each `/api/coach/*` handler. The middleware only checks that a coach is logged in.
- **Kids' data is sensitive.** Store no more personal data than needed, never log passwords/tokens/login codes, keep PBKDF2 hashing and the login lockout, and don't add third-party trackers or external requests from student pages.
- **Database changes go in a new numbered file in `migrations/`.** Never edit an applied migration. Test locally with `npm run db:migrate` first.
- **Production is off-limits unless asked.** Do not run `db:migrate:remote`, `wrangler deploy`, or any `wrangler d1 execute --remote` on your own; the only sanctioned route is `npm run push`, and only when I ask to push/publish. The scripts in `scripts/oneoff/` (`dump_db.js`, `fix_db.js`, `apply_fix.js`, `find_jorge.js`, `fix_remote.sql`, `remote_seeds.sql`) are one-off maintenance tools that may touch real data; read them before running and don't extend them.
- **Performance budget.** Student pages run on cheap phones: keep islands small, load Stockfish/PDF/board code only on the pages that use it, and avoid N+1 D1 queries (batch with `db.batch`).
- **All user-visible text is Spanish**, in a friendly tone for kids. Code, comments and docs are English.
- Verify UI changes in the running app (`npm run dev`) and finish with `npm run check` and `npm test`.

## Access, privacy and optional services

- **Coach sign-up is closed.** A coach registers with an invitation code created by a club admin (`/profe/club/<id>`), or creates a new club with the platform code `SIGNUP_CODE` (`wrangler secret put SIGNUP_CODE`). Only the very first account of an empty database needs neither.
- **Password recovery:** club admins create one-time reset links for their coaches in the club panel. To also let coaches ask by email, set `RESEND_API_KEY` (secret) and `MAIL_FROM` (var).
- **Parental consent** is required to create students (`students.consent_at`). Coaches can export (`GET /api/coach/students/<id>`) and erase all of a student's data. Keep `src/lib/privacy.ts` in sync when a new table stores student data.
- **Streak reminders** are opt-in and off by default. They need `VAPID_PUBLIC_KEY` / `VAPID_SUBJECT` (vars) and `VAPID_PRIVATE_KEY` (secret): generate them with `npm run push:keys`. Without them the toggle is hidden.
- Fill in the controller's details in `src/lib/legal.ts` before publishing.

## Publishing changes (`npm run push`)

When I ask to push or publish, run `npm run push -- "commit message"` from the repo root. It does `git add -A`, commits with that message, `git push origin main`, then `npm run db:migrate:remote` (applies new migrations to the **production** D1). It does not deploy: deploying is a separate `npm run deploy`, or `npm run push:deploy` for both.

- The commit message is the only input. Write a short, descriptive message; don't run separate `git add/commit/push` first.
- Before running it, make sure `npm run check` and `npm test` pass and tell me if there are new files in `migrations/`, since they will hit production.
- Only deploy when I ask for it.

## Assets

If an image or video is needed, don't generate one: write me the prompt and ask me to generate it (I use my Google AI Pro subscription).

## More guidance

Path-scoped rules are in `.claude/rules/`, workflows in `.claude/skills/`, reviewers in `.claude/agents/`. MCP servers are in `docs/MCP.md`. `LEARNING.md` explains how all of this fits together.

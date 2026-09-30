# ♞ ChessKids Academy

Gamified chess platform for kids (5–15 years), fully in Spanish. Built with **Astro + Tailwind + Preact islands**, **Chessground** (Lichess board) and **chess.js**, running on **Cloudflare Workers + D1**.

It's designed for two screens:

* **The class laptop/projector**: projector mode with team tournaments, big board, a timer and a random student picker.
* **Kids' phones at home**: weekly missions (homework), rewards, a kingdoms map and a sticker album.

---

## 🚀 Run it on your computer (Windows, Mac or Linux)

You need **Node.js 22+** (https://nodejs.org). Open a terminal in this folder and run:

### Windows 1-Click Launch:
Double-click `start.bat` (or run `.\start.bat`). It will verify dependencies, apply local database migrations, and launch both the frontend and backend on **http://localhost:4321** while opening your browser automatically.

### Terminal (Windows, Mac, Linux):
```bash
npm install
npm run setup      # creates the local database and loads the demo data
npm run dev
```

Then open **http://localhost:4321**.

### 🚀 Pushing Changes and Database:
- **Windows script**: Double-click `push.bat` (or run `.\push.bat your commit message here without quotes`). It will commit and push all code changes to `main`, apply database migrations to remote Cloudflare D1 (`npm run db:migrate:remote`), and optionally deploy the site.
- **npm shortcut**: Run `npm run push` (or `npm run push:deploy`).

### Demo accounts

| Who | How to log in |
|---|---|
| 🧑‍🏫 Coach | `demo@chesskids.es` / `ajedrez123` |
| 🎒 Student (code + drawings) | Class code **DEMO1** → pick an animal → drawings 🍎 ⭐ 🚀 |
| 🎒 Student (username) | `lucia.torre42` / `caballo-azul-11` |
| 🎒 Student (personal link) | http://localhost:4321/u/tok-lucia-demo-7f3k |

> To test on your phone on the same Wi-Fi: `npm run dev -- --host`, then open `http://<your-PC-IP>:4321`.

---

## 🔑 Ways a kid can log in (all of them keep the device remembered for 1 year)

1. **Personal link over WhatsApp**: in *Students & access* → 💬. The family taps it and the kid is in.
2. **Personal QR**: on the printable cards (*🖨️ Access cards*) or in each kid's 🔑 menu. The phone camera (or the built-in scanner in `/entrar`) opens it.
3. **Class code + animal + 3 secret drawings**: for younger kids who can't read or type yet.
4. **Username + password**: for a new device or older kids (for example `lucia.torre42` / `caballo-azul-11`).
5. **"Is this you?"**: a shared device (a family tablet) remembers the profiles that have logged in on it.

The coach can reset passwords/drawings or **create a new link**. That revokes the old one and logs the kid out on every device. PINs and passwords are stored hashed (PBKDF2), and too many failed attempts lock the account for 10 minutes.

---

## 🎮 Game modes (`src/games/`)

| Type | What it does |
|---|---|
| 🧩 `puzzle-hint` Puzzles with hints | Wrong move → the piece is highlighted; 2nd mistake → an arrow. 3/2/1 points depending on mistakes. |
| ⚡ `puzzle-blitz` Lightning challenge | Wrong move → shows the solution and moves on. Combos 🔥 and an optional clock per puzzle. |
| 📖 `pgn-lesson` Interactive lesson | The game plays itself and pauses on `[%ask]` questions. Accepts alternatives with points (`[%pts 50]`), gives feedback on typical mistakes, and draws arrows/circles in Lichess format (`[%cal]`, `[%csl]`). |
| 🍓 `fruit-collector` Fruit collector | Move a piece to collect all the fruit. An exact solver (BFS + bitmask DP) works out the shortest path and awards 3⭐ if you match it. Supports 🪨 rocks. |
| 🤖 `play-bot` Play vs bot | The student plays from a position the coach sets up (e.g. K+R vs K) against Stockfish (lite WASM, runs in a Web Worker from `public/engine`, GPLv3). Optional notebook explanation with a demo board. Stalemate/checkmate/move limit handled; stars by number of moves. |

**Creating content is easy:** puzzles are recorded by playing the solution on the board (or imported in bulk from FEN/Lichess CSV). Lessons are a PGN that can be exported from a Lichess study. Fruit levels are painted by tapping squares.

### ➕ Adding a new game type

1. Add its metadata in `src/games/meta.ts` (name, emoji, `validate`, `defaultContent`…).
2. Create `Player.tsx` (receives `content` + `api`: `good()`, `bad()`, `say()`, `progress()`, `combo()`, `finish()`) and `Editor.tsx`.
3. Register them in `src/games/registry.ts`.

Homework, XP, stickers, the coach panel and the preview all work automatically.

---

## 🏆 Gamification (`src/lib/rewards.ts`)

* **XP** for performance + stars + minutes learning + homework bonus (replaying gives 40%).
* **Levels**, a **daily streak** 🔥 (Madrid time), a **daily goal**, a **weekly class league**.
* **8 kingdoms** on the world map (Pawn Village → Kingdom of the Stars).
* **24 collectible stickers** by rarity (common → legendary).
* Synthesized **sounds** (Web Audio, no files), **confetti**, vibration on phones, the **Trotón** mascot, and a **Spanish voice** (automatic for "Peques").

The rewards are calculated on the server (`/api/attempts`), not on the device.

## 👥 Clubs, classes and permissions

`clubs → classes → students`. One coach can belong to several clubs. A class owner can share the class with another coach and choose exactly what they can do: 📈 view progress · 🧩 set homework/create games · 👧 manage students. The activity library is per club.

---

## ☁️ Deploying to Cloudflare

```bash
npx wrangler login
npx wrangler d1 create chesskids          # copy the database_id into wrangler.jsonc
npm run db:migrate:remote
npm run deploy
```

(Don't load `seed/demo.sql` in production: it contains demo passwords.)

## 🧪 Tests

```bash
npm test       # solver, PGN parser, lessons, puzzles, XP, streaks and seed validation
npm run check  # TypeScript types
```

## 🗺️ Suggested next steps

* Live mode where kids answer from their phones during class (Cloudflare Durable Objects).
* Shop for board skins/avatars paid with stars.
* Automatic Lichess puzzle import by theme.
* Push notifications ("You have homework!") via PWA.

## 📸 Screenshots

Screenshots from the automated test (phone and laptop) are in `docs/screenshots/`.

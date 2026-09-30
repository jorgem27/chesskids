---
paths:
  - "src/pages/api/**"
  - "src/lib/**"
  - "src/middleware.ts"
  - "migrations/**"
---

# API, auth and database

- Every handler under `src/pages/api/coach/**` verifies the coach's permission for the specific club/class/activity it touches. Being logged in is not enough.
- Every query on tenant data filters by `club_id` (or joins through a parent that does). Use bound parameters (`.bind()`), never string-built SQL.
- Validate request bodies (type, length, allowed values) and return JSON errors in Spanish with the right status code.
- Never trust the client for scores, XP, streaks or time spent. Recompute on the server from the attempt data.
- Never log or return password hashes, session tokens, login codes or personal links beyond the moment they're created.
- Prefer `db.batch([...])` over sequential queries, and add an index for any new `WHERE`/`JOIN` column. D1 is SQLite: keep result sets small and paginate lists.
- Schema changes: new file `migrations/NNNN_name.sql`, additive where possible (`ADD COLUMN` with a default). Use the `d1-migration` skill.
- Dates that affect streaks and daily goals use Madrid time (`src/lib/dates.ts`).

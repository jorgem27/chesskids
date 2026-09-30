---
name: d1-migration
description: Create and safely apply a Cloudflare D1 schema migration for this project. Use when a table, column or index must be added or changed.
---

# D1 migration

1. Read the latest file in `migrations/` and the relevant part of `0001_init.sql` to see the current schema and naming.
2. Create `migrations/NNNN_short_name.sql` (next number). Prefer additive changes: `ADD COLUMN` with a default, new tables, new indexes. SQLite can't drop or alter columns easily; if a rebuild is unavoidable, say so and explain the data-copy plan before writing it.
3. Tenant tables must carry `club_id` (or a parent that does) and an index on the columns queried by it.
4. Update `src/lib/db.ts` row types and any queries affected.
5. Apply locally only: `npm run db:migrate`, then `npm run setup` if the seed needs updating, then `npm test`.
6. Do **not** run `npm run db:migrate:remote`. Tell the user the exact command and that it changes production data, and let them run it (ideally after a backup with `wrangler d1 export chesskids --remote`).

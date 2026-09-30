---
name: deploy-cloudflare
description: Pre-deploy checklist and deploy of ChessKids Academy to Cloudflare Workers. Only when the user explicitly asks to deploy.
disable-model-invocation: true
---

# Deploy to Cloudflare

1. `git status` must be clean or the user must confirm what's going out.
2. Run `npm run check` and `npm test`; stop on any failure.
3. List migrations in `migrations/` not yet applied remotely (check with the Cloudflare MCP or `wrangler d1 migrations list chesskids --remote`). Tell the user which will run and that they change production.
4. Ask for explicit confirmation, then `npm run db:migrate:remote` if needed, then `npm run deploy`.
5. Smoke-test the live URL: coach login, a student link, one game of each type, and `/api/attempts` reward.
6. If something breaks, roll back with `wrangler rollback` and report.

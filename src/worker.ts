// Worker entry point (wrangler.jsonc "main"): Astro handles every request; the daily cron sends
// the opt-in streak reminders (src/lib/push.ts).
import { handle } from '@astrojs/cloudflare/handler';
import { sendStreakReminders } from './lib/push';

export default {
  fetch: handle,
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(sendStreakReminders(env.DB, env));
  },
} satisfies ExportedHandler<Env>;

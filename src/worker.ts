// Worker entry point (wrangler.jsonc "main"): Astro handles every request; the daily cron sends
// the opt-in streak reminders (src/lib/push.ts) and deletes old chat messages.
import { handle } from '@astrojs/cloudflare/handler';
import { sendStreakReminders } from './lib/push';
import { purgeOldMessages } from './lib/chatServer';

export default {
  fetch: handle,
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(sendStreakReminders(env.DB, env));
    ctx.waitUntil(purgeOldMessages(env.DB));
  },
} satisfies ExportedHandler<Env>;

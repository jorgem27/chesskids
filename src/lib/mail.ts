// Optional transactional email (password reset links) through Resend's HTTP API.
// Configure with `wrangler secret put RESEND_API_KEY` and the MAIL_FROM var; without them nothing is sent
// and club admins share reset links by hand from the club panel.
import { env } from 'cloudflare:workers';

export function mailEnabled(): boolean {
  const e = env as Env;
  return !!(e.RESEND_API_KEY && e.MAIL_FROM);
}

export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  const e = env as Env;
  if (!e.RESEND_API_KEY || !e.MAIL_FROM) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${e.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: e.MAIL_FROM, to: [to], subject, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/// <reference types="astro/client" />

interface Env {
  DB: D1Database;
  /** Optional platform code that lets someone register a coach account AND create a new club without an invite. */
  SIGNUP_CODE?: string;
  /** Optional: Resend API key + sender address to email password-reset links. Without them, admins share reset links. */
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  /** Optional: VAPID keys for opt-in streak reminders (generate with `npm run push:keys`). */
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

declare namespace App {
  interface Locals {
    db: D1Database;
    coach: import('./lib/db').CoachRow | null;
    student: import('./lib/db').StudentRow | null;
  }
}

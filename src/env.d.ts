/// <reference types="astro/client" />

interface Env {
  DB: D1Database;
}

declare namespace App {
  interface Locals {
    db: D1Database;
    coach: import('./lib/db').CoachRow | null;
    student: import('./lib/db').StudentRow | null;
  }
}

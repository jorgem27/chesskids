import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { readSession, SESSION_COOKIE } from './lib/auth';
import type { CoachRow, StudentRow } from './lib/db';

export const onRequest = defineMiddleware(async (ctx, next) => {
  const db = (env as Env).DB;
  ctx.locals.db = db;
  ctx.locals.coach = null;
  ctx.locals.student = null;

  const path = ctx.url.pathname;
  const isAsset = path.startsWith('/_astro') || path.startsWith('/favicon');
  if (db && !isAsset) {
    const s = await readSession(db, ctx.cookies.get(SESSION_COOKIE)?.value);
    if (s?.user_type === 'coach') {
      ctx.locals.coach = await db.prepare('SELECT id, email, name FROM coaches WHERE id = ?').bind(s.user_id).first<CoachRow>();
    } else if (s?.user_type === 'student') {
      ctx.locals.student = await db.prepare('SELECT * FROM students WHERE id = ? AND archived = 0').bind(s.user_id).first<StudentRow>();
    }
  }

  // Route guards
  if (path.startsWith('/app') && !ctx.locals.student) return ctx.redirect('/entrar');
  if (path.startsWith('/profe') && !path.startsWith('/profe/login') && !path.startsWith('/profe/registro') && !ctx.locals.coach) {
    return ctx.redirect('/profe/login');
  }
  if (path.startsWith('/api/coach') && !ctx.locals.coach) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: { 'content-type': 'application/json' } });
  }
  return next();
});

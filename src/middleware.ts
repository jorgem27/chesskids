import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { readSessionUser, SESSION_COOKIE } from './lib/auth';

export const onRequest = defineMiddleware(async (ctx, next) => {
  const db = (env as Env).DB;
  ctx.locals.db = db;
  ctx.locals.coach = null;
  ctx.locals.student = null;

  const path = ctx.url.pathname;
  // Assets and the legal / family pages never need the user: skip the session lookup there.
  const skipSession = ['/_astro', '/favicon', '/privacidad', '/aviso-legal', '/familia'].some((p) => path.startsWith(p));
  if (db && !skipSession) {
    const { coach, student } = await readSessionUser(db, ctx.cookies.get(SESSION_COOKIE)?.value);
    ctx.locals.coach = coach;
    ctx.locals.student = student;
  }

  // Route guards
  if (path.startsWith('/app') && !ctx.locals.student) return ctx.redirect('/entrar');
  const publicCoachPage = ['/profe/login', '/profe/registro', '/profe/recuperar', '/profe/restablecer'].some((p) => path.startsWith(p));
  if (path.startsWith('/profe') && !publicCoachPage && !ctx.locals.coach) {
    return ctx.redirect('/profe/login');
  }
  if (path.startsWith('/api/coach') && !ctx.locals.coach) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: { 'content-type': 'application/json' } });
  }
  return next();
});

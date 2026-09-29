import type { APIRoute } from 'astro';
import { destroySession } from '../../../lib/auth';

export const POST: APIRoute = async ({ locals, cookies, redirect, request }) => {
  await destroySession(locals.db, cookies);
  const to = new URL(request.url).searchParams.get('to');
  return redirect(to === 'profe' ? '/profe/login' : '/entrar');
};

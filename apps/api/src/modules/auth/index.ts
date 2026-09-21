import { APIError, createAuthMiddleware } from 'better-auth/api';
import { z } from 'zod';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Express } from 'express';
import express from 'express';
import type { Pool } from 'pg';
import nodemailer from 'nodemailer';
import * as schema from '../../database/schema.js';

export function mountAuth(app: Express, pool: Pool) {
  const db = drizzle(pool);
  const baseURL = process.env.AUTH_BASE_URL ?? 'http://localhost:5173';
  const production = process.env.NODE_ENV === 'production';
  const secret = process.env.AUTH_SECRET ?? (production ? '' : 'local-development-only-secret-at-least-32-characters');
  if (secret.length < 32 || (production && (!process.env.AUTH_BASE_URL || !baseURL.startsWith('https://') || !process.env.SMTP_HOST || !process.env.SMTP_FROM))) {
    throw new Error('Production auth requires an HTTPS AUTH_BASE_URL, AUTH_SECRET (32+ characters), SMTP_HOST and SMTP_FROM');
  }
  const mail = nodemailer.createTransport({ host: process.env.SMTP_HOST ?? '127.0.0.1', port: Number(process.env.SMTP_PORT ?? 1025),
    secure: process.env.SMTP_SECURE === 'true', requireTLS: production && process.env.SMTP_SECURE !== 'true',
    ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } } : {}),
    connectionTimeout: 10000, socketTimeout: 15000,
  });
  const auth = betterAuth({
    baseURL, secret,
    database: drizzleAdapter(drizzle(pool), { provider: 'pg', schema }),
    advanced: { useSecureCookies: production || baseURL.startsWith('https://'), ipAddress: { ipAddressHeaders: ['x-gso-client-ip'] } },
    rateLimit: { enabled: true, storage: 'database', window: 60, max: 100, customRules: { '/sign-in/magic-link': { window: 60, max: 5 } } },
    trustedOrigins: [baseURL],
    session: { expiresIn: 60 * 60 * 24 * 7, disableSessionRefresh: true, cookieCache: { enabled: false } },
    user: { additionalFields: { affiliation: { type: 'string', defaultValue: 'MEMBER', input: false } } },
    hooks: { before: createAuthMiddleware(async ctx => {
      if (ctx.path === '/sign-in/magic-link') {
        const parsed = z.object({ email: z.email().transform(value => value.toLowerCase()).refine(value => value.endsWith('@gso.schule.koeln')),
          name: z.string().trim().min(1).max(100) }).safeParse(ctx.body);
        if (!parsed.success) throw new APIError('BAD_REQUEST', { message: 'School email and name required' });
        const [existing] = await db.select({ affiliation: schema.user.affiliation }).from(schema.user).where(eq(schema.user.email, parsed.data.email));
        if (existing && existing.affiliation !== 'MEMBER') throw new APIError('FORBIDDEN', { message: 'Current GSO affiliation required' });
        return { context: { body: { ...ctx.body, ...parsed.data } } };
      }
    }) },
    databaseHooks: { session: { create: { before: async session => {
      const [existing] = await db.select({ affiliation: schema.user.affiliation }).from(schema.user).where(eq(schema.user.id, session.userId));
      if (!existing || existing.affiliation !== 'MEMBER') return false;
      return { data: session };
    } } } },
    plugins: [magicLink({ expiresIn: 900, storeToken: 'hashed', sendMagicLink: async ({ email, url }) => {
      await mail.sendMail({ from: process.env.SMTP_FROM ?? 'GSO engineering lab <lab@localhost>', to: email,
        subject: 'Dein Login / Your login — GSO engineering lab', text: `Anmelden / Sign in (15 min):\n${url}\n\nNicht angefordert? Ignoriere diese E-Mail. / Not requested? Ignore this email.` });
    } })],
  });
  app.all('/api/auth/*splat', (request, response, next) => {
    const allowed = new Map([['/api/auth/sign-in/magic-link', 'POST'], ['/api/auth/magic-link/verify', 'GET'], ['/api/auth/sign-out', 'POST']]);
    if (allowed.get(request.path) !== request.method) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    if (request.method === 'POST' && request.get('origin') !== new URL(baseURL).origin) {
      response.status(403).json({ error: 'INVALID_ORIGIN' }); return;
    }
    // Ignore client-supplied forwarding headers: the socket is the trust boundary.
    request.headers['x-gso-client-ip'] = request.socket.remoteAddress ?? 'unknown';
    next();
  }, toNodeHandler(auth));
  app.use(express.json({ limit: '16kb' }));
  const profileInput = z.object({ name: z.string().trim().min(1).max(100),
    education: z.string().trim().max(100).nullable().optional(), year: z.number().int().min(1).max(6).nullable().optional(),
    interests: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  }).strict();
  app.route('/api/me').all(async (request, response, next) => {
    response.set('Cache-Control', 'no-store');
    if (request.method !== 'GET' && request.get('origin') !== new URL(baseURL).origin) {
      response.status(403).json({ error: 'INVALID_ORIGIN' }); return;
    }
    const current = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!current || !current.user.emailVerified || current.user.affiliation !== 'MEMBER') {
      response.status(401).json({ error: 'UNAUTHENTICATED' }); return;
    }
    response.locals.userId = current.user.id;
    next();
  }).get(async (_request, response) => {
    const [profile] = await db.select({ id: schema.user.id, name: schema.user.name, email: schema.user.email,
      affiliation: schema.user.affiliation, education: schema.user.education, year: schema.user.year, interests: schema.user.interests })
      .from(schema.user).where(eq(schema.user.id, response.locals.userId));
    response.json({ user: profile });
  }).patch(async (request, response) => {
    const parsed = profileInput.safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ error: 'INVALID_PROFILE' }); return; }
    await db.update(schema.user).set({ ...parsed.data, updatedAt: new Date() }).where(eq(schema.user.id, response.locals.userId));
    response.json({ saved: true });
  });
}

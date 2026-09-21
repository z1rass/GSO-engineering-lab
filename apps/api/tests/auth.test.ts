import { requestTestLink, redeemTestLink } from './helpers/magic-link.js';
import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createApp } from '../src/app.js';
const databaseUrl = process.env.TEST_DATABASE_URL ?? 'postgres://lab:lab_local@127.0.0.1:55433/lab_test';
if (!new URL(databaseUrl).pathname.endsWith('_test')) throw new Error('Dedicated test database required');
const pool = new Pool({ connectionString: databaseUrl });
let server: Server;
let base: string;
const origin = 'http://localhost:5173';
beforeAll(async () => {
  await migrate(drizzle(pool), { migrationsFolder: '../../database/migrations' });
  server = createApp(pool).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
beforeEach(async () => { await pool.query('DELETE FROM rate_limits'); });
afterAll(async () => { if (server) await new Promise<void>(r => server.close(() => r())); await pool.end(); });
function post(path: string, body: unknown, cookie = '') {
  return fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', origin, cookie }, body: JSON.stringify(body) });
}
async function login() {
  const { email, url } = await requestTestLink(base, origin);
  const { verified, cookie } = await redeemTestLink(base, url);
  return { cookie, email, url, verified };
}
test('School email ownership is verified through a delivered magic link before a Member can read their profile', async () => {
  expect((await fetch(`${base}/api/me`)).status).toBe(401);
  const { cookie, email } = await login();
  const response = await fetch(`${base}/api/me`, { headers: { cookie } });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ user: { email, name: 'Ada', affiliation: 'MEMBER' } });
});

test('Only the exact school domain and a nonempty name can request a link; password and generic user mutation routes are unavailable', async () => {
  for (const email of ['a@example.com', 'a@gso.schule.koeln.evil.org', 'a@sub.gso.schule.koeln']) {
    expect((await post('/api/auth/sign-in/magic-link', { email, name: 'Ada' })).status).toBe(400);
  }
  expect((await post('/api/auth/sign-in/magic-link', { email: 'a@gso.schule.koeln', name: ' ' })).status).toBe(400);
  expect((await post('/api/auth/update-user', { name: 'Changed' })).status).toBe(404);
});

test('A Member edits only their own minimal profile; email and identity cannot be reassigned', async () => {
  const { cookie, email } = await login();
  const update = (body: unknown, headers = { origin, cookie }) => fetch(`${base}/api/me`, {
    method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  expect((await update({ name: 'Ada Lovelace', education: 'FIAE', year: 2, interests: ['Linux', 'AI'] })).status).toBe(200);
  const profile = await fetch(`${base}/api/me`, { headers: { cookie } }).then(r => r.json());
  expect(profile.user).toMatchObject({ name: 'Ada Lovelace', email, education: 'FIAE', year: 2, interests: ['Linux', 'AI'] });
  expect((await update({ name: 'Intruder', id: 'another-user' })).status).toBe(400);
  expect((await update({ name: 'Ada', email: 'other@gso.schule.koeln' })).status).toBe(400);
  expect((await update({ name: 'CSRF' }, { origin: 'https://evil.example', cookie })).status).toBe(403);
  expect((await update({ name: 'Anonymous' }, { origin, cookie: '' })).status).toBe(401);
  expect((await fetch(`${base}/api/users/another-user`, { method: 'PATCH', headers: { origin, cookie } })).status).toBe(404);
});

test('Magic links are single use, invalid and expired links cannot create sessions; logout revokes the session', async () => {
  const { cookie, url, verified } = await login();
  expect(verified.headers.get('set-cookie')).toContain('HttpOnly');
  expect(verified.headers.get('set-cookie')).toContain('SameSite=Lax');
  const replay = await fetch(`${base}${url.pathname}${url.search}`, { redirect: 'manual' });
  expect(replay.headers.get('location')).toContain('error=');
  expect(replay.headers.get('set-cookie')).toBeNull();
  const invalid = await fetch(`${base}/api/auth/magic-link/verify?token=invalid&errorCallbackURL=/login`, { redirect: 'manual' });
  expect(invalid.headers.get('location')).toContain('error=');
  const pending = await requestTestLink(base, origin);
  await pool.query("UPDATE verifications SET expires_at=NOW()-INTERVAL '1 hour' WHERE value LIKE $1", [`%${pending.email}%`]);
  const expired = await fetch(`${base}${pending.url.pathname}${pending.url.search}`, { redirect: 'manual' });
  expect(expired.headers.get('location')).toContain('error=');
  expect((await post('/api/auth/sign-out', {}, cookie)).status).toBe(200);
  expect((await fetch(`${base}/api/me`, { headers: { cookie } })).status).toBe(401);
});

test('Expired sessions and ended school affiliations deny Member access without deleting the User', async () => {
  const first = await login();
  await pool.query("UPDATE sessions SET expires_at=NOW()-INTERVAL '1 hour' WHERE user_id=(SELECT id FROM users WHERE email=$1)", [first.email]);
  expect((await fetch(`${base}/api/me`, { headers: { cookie: first.cookie } })).status).toBe(401);
  const second = await login();
  await pool.query("UPDATE users SET affiliation='ALUMNI' WHERE email=$1", [second.email]);
  expect((await fetch(`${base}/api/me`, { headers: { cookie: second.cookie } })).status).toBe(401);
});

test('Cross-site or missing-Origin sign-in requests are rejected', async () => {
  for (const headers of [new Headers({ origin: 'https://evil.example', 'Content-Type': 'application/json' }), new Headers({ 'Content-Type': 'application/json' })]) {
    const response = await fetch(`${base}/api/auth/sign-in/magic-link`, { method: 'POST', headers, body: JSON.stringify({ email: 'csrf@gso.schule.koeln', name: 'CSRF' }) });
    expect(response.status).toBe(403);
  }
});


test('Repeated magic-link requests are rate limited', async () => {
  const body = { email: `limit-${randomUUID()}@gso.schule.koeln`, name: 'Ada' };
  for (let i = 0; i < 5; i++) expect((await post('/api/auth/sign-in/magic-link', body)).status).toBe(200);
  expect((await post('/api/auth/sign-in/magic-link', body)).status).toBe(429);
});

test('An Alumni account cannot start a new Member login', async () => {
  const { email } = await login();
  await pool.query("UPDATE users SET affiliation='ALUMNI' WHERE email=$1", [email]);
  expect((await post('/api/auth/sign-in/magic-link', { email, name: 'Ada' })).status).toBe(403);
});

test('HTTPS deployments issue Secure HttpOnly cookies and a fixed seven-day session', async () => {
  const original = process.env.AUTH_BASE_URL;
  process.env.AUTH_BASE_URL = 'https://lab.example';
  const secureServer = createApp(pool).listen(0, '127.0.0.1');
  if (original === undefined) delete process.env.AUTH_BASE_URL; else process.env.AUTH_BASE_URL = original;
  await once(secureServer, 'listening');
  const secureBase = `http://127.0.0.1:${(secureServer.address() as AddressInfo).port}`;
  try {
    const { url } = await requestTestLink(secureBase, 'https://lab.example');
    const { verified: response } = await redeemTestLink(secureBase, url);
    const cookies = response.headers.getSetCookie().join(';');
    expect(cookies).toContain('Secure');
    expect(cookies).toContain('HttpOnly');
    expect(cookies).toContain('Max-Age=604800');
    const cookie = response.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
    const read = await fetch(`${secureBase}/api/me`, { headers: { cookie } });
    expect(read.status).toBe(200);
    expect(read.headers.get('set-cookie')).toBeNull();
  } finally { await new Promise<void>(resolve => secureServer.close(() => resolve())); }
});

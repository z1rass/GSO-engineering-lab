import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { createApp } from '../src/app.js';

const password = 'a-local-admin-password-for-tests';
const origin = 'http://localhost:5173';
const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL ?? 'postgres://lab:lab_local@127.0.0.1:55433/lab_test' });
let server: Server;
let base: string;
const createdEvents: number[] = [];
const createdIdeas: number[] = [];
beforeAll(async () => {
  if (!new URL(pool.options.connectionString!).pathname.endsWith('_test')) throw new Error('Dedicated test database required');
  process.env.ADMIN_PASSWORD = password;
  process.env.ADMIN_SESSION_SECRET = 'test-admin-session-secret-with-more-than-thirty-two-characters';
  await migrate(drizzle(pool), { migrationsFolder: '../../database/migrations' });
  server = createApp(pool).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  if (createdEvents.length) await pool.query('DELETE FROM activities WHERE id=ANY($1::int[])', [createdEvents]);
  if (createdIdeas.length) await pool.query('DELETE FROM ideas WHERE id=ANY($1::int[])', [createdIdeas]);
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  await pool.end();
  delete process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_SESSION_SECRET;
});
const write = (path: string, body: unknown, cookie = '', method = 'POST', requestOrigin = origin) => fetch(`${base}${path}`, {
  method, headers: { origin: requestOrigin, cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

test('admin password creates an HTTP-only session; unsafe writes and forged cookies are rejected', async () => {
  expect(await fetch(`${base}/api/admin/session`).then(response => response.json())).toEqual({ configured: true, authenticated: false });
  expect((await write('/api/admin/ideas', { title: 'Private', description: 'No' })).status).toBe(401);
  expect((await write('/api/admin/login', { password }, '', 'POST', 'https://other.example')).status).toBe(403);
  expect((await write('/api/admin/login', { password: 'wrong' })).status).toBe(401);
  const login = await write('/api/admin/login', { password });
  expect(login.status).toBe(200);
  const cookie = login.headers.get('set-cookie')!.split(';')[0]!;
  expect(login.headers.get('set-cookie')).toContain('HttpOnly');
  expect(login.headers.get('set-cookie')).toContain('SameSite=Strict');
  expect((await fetch(`${base}/api/admin/session`, { headers: { cookie } }).then(response => response.json())).authenticated).toBe(true);
  expect((await write('/api/admin/ideas', { title: 'Private', description: 'No' }, `${cookie}x`)).status).toBe(401);
  expect((await write('/api/admin/ideas', { title: 'Private', description: 'No' }, cookie, 'POST', 'https://other.example')).status).toBe(403);
  const logout = await write('/api/admin/logout', {}, cookie);
  expect(logout.status).toBe(200);
  expect(logout.headers.get('set-cookie')).toContain('Max-Age=0');
});

test('admin can publish and update ideas and events, publicly readable without registration', async () => {
  const login = await write('/api/admin/login', { password });
  const cookie = login.headers.get('set-cookie')!.split(';')[0]!;
  const idea = await write('/api/admin/ideas', { title: 'Open lab', description: 'A night for building.' }, cookie);
  expect(idea.status).toBe(201);
  const ideaId = (await idea.json()).id as number;
  createdIdeas.push(ideaId);
  expect((await fetch(`${base}/api/ideas/${ideaId}`).then(response => response.json())).idea.title).toBe('Open lab');
  expect((await write(`/api/admin/ideas/${ideaId}`, { title: 'Open Lab Night', description: 'Build together.' }, cookie, 'PATCH')).status).toBe(200);
  expect((await fetch(`${base}/api/ideas/${ideaId}`).then(response => response.json())).idea.title).toBe('Open Lab Night');

  const plan = { title: 'Build night', description: 'Bring a laptop.', category: 'BUILD_NIGHT', plannedDate: '2026-10-22', endDate: null,
    startTime: '18:00', endTime: '20:00', placeType: 'OTHER', generalLocation: 'Köln' };
  expect((await write('/api/admin/events', { ...plan, endTime: '17:00' }, cookie)).status).toBe(400);
  const created = await write('/api/admin/events', plan, cookie);
  expect(created.status).toBe(201);
  const eventId = (await created.json()).id as number;
  createdEvents.push(eventId);
  const publicEvent = (await fetch(`${base}/api/events/${eventId}`).then(response => response.json())).event;
  expect(publicEvent).toMatchObject({ title: 'Build night', plannedDate: '2026-10-22', generalLocation: 'Köln', status: 'PLANNING' });
  expect(publicEvent).not.toHaveProperty('owner');
  expect((await write(`/api/admin/events/${eventId}`, { ...plan, title: 'Build with friends' }, cookie, 'PATCH')).status).toBe(200);
  expect((await fetch(`${base}/api/events/${eventId}`).then(response => response.json())).event.title).toBe('Build with friends');
});

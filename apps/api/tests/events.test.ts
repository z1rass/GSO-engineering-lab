import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createApp } from '../src/app.js';
import { requestTestLink, redeemTestLink } from './helpers/magic-link.js';
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
async function member() {
  const { email, url } = await requestTestLink(base, origin, 'Private author');
  const { cookie } = await redeemTestLink(base, url);
  return { email, cookie };
}
function write(path: string, cookie: string, body: unknown, method = 'POST', requestOrigin = origin) {
  return fetch(`${base}${path}`, { method, headers: { cookie, origin: requestOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
const eventInput = { title: 'Docker workshop', description: 'Build containers together.', category: 'WORKSHOP', materials: 'Public notes', repositoryUrl: 'https://github.com/example/workshop', privateInstructions: 'Use the side entrance', discordUrl: 'https://discord.gg/private' };
test('Member creates an Event without confirmed conditions and becomes owner; Visitors receive only public fields', async () => {
  const author = await member();
  const response = await write('/api/events', author.cookie, eventInput);
  expect(response.status).toBe(201);
  const { event } = await response.json();
  const publicView = await fetch(`${base}/api/events/${event.id}`).then(r => r.json());
  expect(publicView.event).toEqual({ id: event.id, title: 'Docker workshop', description: 'Build containers together.', category: 'WORKSHOP', status: 'PLANNING', ideaId: null,
    plannedDate: null, endDate: null, startTime: null, endTime: null, generalLocation: '', placeType:'OTHER', materials: 'Public notes', repositoryUrl: 'https://github.com/example/workshop',
    createdAt: expect.any(String), updatedAt: expect.any(String) });
  const personal = await fetch(`${base}/api/events/${event.id}`, { headers: { cookie: author.cookie } }).then(r => r.json());
  expect(personal.event).toMatchObject({ owner: { name: 'Private author' }, canEdit: true, exactRoom: '', privateInstructions: 'Use the side entrance', discordUrl: 'https://discord.gg/private' });
  const list = await fetch(`${base}/api/events`).then(r => r.json());
  expect(list.events.find((item: { id: number }) => item.id === event.id)).toEqual(publicView.event);
});
test('Only owner and Ops edit preparation details, including a multi-day plan; changing type or owner is forbidden', async () => {
  const author = await member(); const other = await member(); const ops = await member();
  await pool.query("UPDATE users SET role='OPS' WHERE email=$1", [ops.email]);
  const { event } = await write('/api/events', author.cookie, eventInput).then(r => r.json());
  const path = `/api/events/${event.id}`;
  const revised = { ...eventInput, plannedDate: '2026-11-28', endDate: '2026-11-29', startTime: '18:00', endTime: '10:00', generalLocation: 'Köln' };
  expect((await write(path, other.cookie, revised, 'PATCH')).status).toBe(403);
  expect((await write(path, author.cookie, revised, 'PATCH')).status).toBe(200);
  expect((await fetch(`${base}${path}`).then(r => r.json())).event).toMatchObject({ plannedDate: '2026-11-28', endDate: '2026-11-29', startTime: '18:00', endTime: '10:00', generalLocation: 'Köln', status: 'PLANNING' });
  expect((await write(path, ops.cookie, { ...revised, title: 'Updated by Ops' }, 'PATCH')).status).toBe(200);
  expect((await fetch(`${base}${path}`).then(r => r.json())).event.title).toBe('Updated by Ops');
  expect((await write(path, author.cookie, { ...revised, ownerId: 'someone-else', status: 'ACTIVE' }, 'PATCH')).status).toBe(400);
  expect((await write(path, author.cookie, { ...revised, exactRoom:'B202' }, 'PATCH')).status).toBe(400);
  expect((await write(path, author.cookie, revised, 'PATCH', 'https://untrusted.example')).status).toBe(403);
});
test('Preparation accepts unknown conditions but rejects invalid dates, backwards schedules and unsafe links', async () => {
  const author = await member();
  for (const input of [
    { plannedDate: '2026-02-30' }, { plannedDate: '2026-11-29', endDate: '2026-11-28' },
    { plannedDate: '2026-11-28', startTime: '18:00', endTime: '10:00' }, { startTime: '25:00' },
    { endDate: '2026-11-28' }, { repositoryUrl: 'javascript:alert(1)' }, { discordUrl: 'https://user:secret@example.org' }, { category: 'INVALID' },
  ]) expect((await write('/api/events', author.cookie, { ...eventInput, ...input })).status).toBe(400);
  const { event } = await write('/api/events', author.cookie, eventInput).then(r => r.json());
  expect((await write(`/api/events/${event.id}`, author.cookie, { ...eventInput, plannedDate: '2026-11-29', endDate: '2026-11-28' }, 'PATCH')).status).toBe(400);
  expect((await fetch(`${base}/api/events/${event.id}`).then(r => r.json())).event.plannedDate).toBeNull();
});
test('An Idea can inspire multiple Events without taking ownership away from their creators; only current Members may create', async () => {
  const author = await member();
  const ideaResponse = await write('/api/ideas', author.cookie, { title: 'Learn Docker', description: 'I would like a workshop.' });
  const { idea } = await ideaResponse.json();
  const first = await write('/api/events', author.cookie, { ...eventInput, ideaId: idea.id });
  const second = await write('/api/events', author.cookie, { ...eventInput, ideaId: idea.id });
  expect(first.status).toBe(201); expect(second.status).toBe(201);
  const firstEvent = (await first.json()).event; const secondEvent = (await second.json()).event;
  expect(firstEvent.id).not.toBe(secondEvent.id); expect(secondEvent.ideaId).toBe(idea.id);
  expect((await write('/api/events', author.cookie, { ...eventInput, ideaId: 2147483647 })).status).toBe(400);
  expect((await write('/api/events', '', eventInput)).status).toBe(401);
  await pool.query("UPDATE users SET affiliation='ALUMNI' WHERE email=$1", [author.email]);
  expect((await write('/api/events', author.cookie, eventInput)).status).toBe(401);
  const alumniView = await fetch(`${base}/api/events/${firstEvent.id}`, { headers: { cookie: author.cookie } }).then(r => r.json());
  expect(alumniView.event).not.toHaveProperty('owner'); expect(alumniView.event).not.toHaveProperty('exactRoom');
});

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
test('A Member publishes an Idea immediately and Visitors read only public content without author identity or ownership', async () => {
  const { cookie } = await member();
  const response = await write('/api/ideas', cookie, { title: '  Linux evening  ', description: '  Learn Linux together.  ' });
  expect(response.status).toBe(201);
  const { idea } = await response.json();
  expect(idea).toEqual({ id: expect.any(Number), title: 'Linux evening', description: 'Learn Linux together.', createdAt: expect.any(String), updatedAt: expect.any(String) });
  const detail = await fetch(`${base}/api/ideas/${idea.id}`);
  expect(detail.status).toBe(200);
  expect(await detail.json()).toEqual({ idea });
  const list = await fetch(`${base}/api/ideas`).then(r => r.json());
  expect(list.ideas).toContainEqual(idea);
});

test('Only Ops can edit an Idea; being its author does not grant editing rights', async () => {
  const author = await member();
  const other = await member();
  const created = await write('/api/ideas', author.cookie, { title: 'A topic', description: 'An idea, not a commitment.' }).then(r => r.json());
  const path = `/api/ideas/${created.idea.id}`;
  const revised = { title: 'A clearer topic', description: 'Improved by Ops.' };
  expect((await write(path, '', revised, 'PATCH')).status).toBe(401);
  expect((await write(path, author.cookie, revised, 'PATCH')).status).toBe(403);
  expect((await write(path, other.cookie, revised, 'PATCH')).status).toBe(403);
  await pool.query("UPDATE users SET role='OPS' WHERE email=$1", [other.email]);
  const response = await write(path, other.cookie, revised, 'PATCH');
  expect(response.status).toBe(200);
  const result = await fetch(`${base}${path}`).then(r => r.json());
  expect(result.idea).toMatchObject({ id: created.idea.id, ...revised, createdAt: created.idea.createdAt });
  expect(Object.keys(result.idea).sort()).toEqual(['createdAt', 'description', 'id', 'title', 'updatedAt']);
});

test('Creation validates content and rejects identity/ownership injection, Visitors, Alumni and cross-site writes', async () => {
  const author = await member();
  const valid = { title: 'Docker', description: 'Learn together.' };
  expect((await write('/api/ideas', '', valid)).status).toBe(401);
  for (const body of [{ ...valid, title: ' ' }, { ...valid, description: '' }, { ...valid, title: 'a'.repeat(121) }, { ...valid, description: 'a'.repeat(5001) }, { ...valid, createdBy: 'someone-else' }, { ...valid, ownerId: 'someone-else' }]) {
    expect((await write('/api/ideas', author.cookie, body)).status).toBe(400);
  }
  expect((await write('/api/ideas', author.cookie, valid, 'POST', 'https://evil.example')).status).toBe(403);
  await pool.query("UPDATE users SET affiliation='ALUMNI' WHERE email=$1", [author.email]);
  expect((await write('/api/ideas', author.cookie, valid)).status).toBe(401);
});

test('An empty list and missing ideas have explicit responses; invalid Ops edits preserve published content', async () => {
  await pool.query('DELETE FROM ideas');
  expect(await fetch(`${base}/api/ideas`).then(r => r.json())).toEqual({ ideas: [] });
  for (const id of ['bad-id', '-1', '2147483647', '999999999999999']) expect((await fetch(`${base}/api/ideas/${id}`)).status).toBe(404);
  const ops = await member();
  await pool.query("UPDATE users SET role='OPS' WHERE email=$1", [ops.email]);
  const original = { title: 'Original', description: 'Keep this text.' };
  const { idea } = await write('/api/ideas', ops.cookie, original).then(r => r.json());
  const path = `/api/ideas/${idea.id}`;
  expect((await write(path, ops.cookie, { ...original, title: '' }, 'PATCH')).status).toBe(400);
  expect((await write(path, ops.cookie, original, 'PATCH', '')).status).toBe(403);
  expect((await write('/api/ideas/2147483647', ops.cookie, original, 'PATCH')).status).toBe(404);
  expect(await fetch(`${base}${path}`).then(r => r.json())).toEqual({ idea });
});

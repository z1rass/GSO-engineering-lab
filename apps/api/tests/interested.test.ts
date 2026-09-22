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
async function targets(cookie: string) {
  const idea = await write('/api/ideas', cookie, { title: 'Learn together', description: 'Just an idea' }).then(r => r.json());
  const project = await write('/api/projects', cookie, { title: 'Lab', goal: 'Build', description: 'Together' }).then(r => r.json());
  const event = await write('/api/events', cookie, { title: 'Workshop', description: 'Together', category: 'WORKSHOP' }).then(r => r.json());
  return [`/api/ideas/${idea.idea.id}`, `/api/projects/${project.project.id}`, `/api/events/${event.event.id}`];
}
test('Interested is persisted independently for Ideas, Projects and Events and repeated requests never duplicate it', async () => {
  const owner = await member(); const interested = await member();
  for (const target of await targets(owner.cookie)) {
    const path = `${target}/interested`;
    const before = await fetch(`${base}${target}`, { headers: { cookie: owner.cookie } }).then(r => r.json());
    expect(await fetch(`${base}${path}`).then(r => r.json())).toEqual({ count: 0, interested: null });
    const results = await Promise.all(Array.from({ length: 4 }, () => write(path, interested.cookie, {})));
    expect(results.map(r => r.status)).toEqual([200,200,200,200]);
    expect(await fetch(`${base}${path}`, { headers: { cookie: interested.cookie } }).then(r => r.json())).toEqual({ count: 1, interested: true });
    expect(await fetch(`${base}${path}`).then(r => r.json())).toEqual({ count: 1, interested: null });
    expect(await fetch(`${base}${path}`, { headers: { cookie: owner.cookie } }).then(r => r.json())).toEqual({ count: 1, interested: false });
    expect(await fetch(`${base}${target}`, { headers: { cookie: owner.cookie } }).then(r => r.json())).toEqual(before);
    expect((await write(path, interested.cookie, {}, 'DELETE')).status).toBe(200);
    expect((await write(path, interested.cookie, {}, 'DELETE')).status).toBe(200);
    expect(await fetch(`${base}${path}`, { headers: { cookie: interested.cookie } }).then(r => r.json())).toEqual({ count: 0, interested: false });
  }
});
test('Members affect only their own mark; Visitors, Alumni, forged identities and cross-origin writes are rejected', async () => {
  const first = await member(); const second = await member();
  const [target] = await targets(first.cookie); const path = `${target}/interested`;
  expect((await write(path, '', {})).status).toBe(401);
  expect((await write(path, first.cookie, {}, 'POST', 'https://untrusted.example')).status).toBe(403);
  expect((await write(path, first.cookie, { userId: 'someone-else' })).status).toBe(400);
  await write(path, first.cookie, {}); await write(path, second.cookie, {});
  expect(await fetch(`${base}${path}`).then(r => r.json())).toEqual({ count: 2, interested: null });
  expect((await write(path, second.cookie, { userId: 'someone-else' }, 'DELETE')).status).toBe(400);
  await write(path, second.cookie, {}, 'DELETE');
  expect(await fetch(`${base}${path}`, { headers: { cookie: first.cookie } }).then(r => r.json())).toEqual({ count: 1, interested: true });
  await pool.query("UPDATE users SET affiliation='ALUMNI' WHERE email=$1", [second.email]);
  expect((await write(path, second.cookie, {})).status).toBe(401);
  expect((await write(path, second.cookie, {}, 'DELETE')).status).toBe(401);
  expect(await fetch(`${base}${path}`, { headers: { cookie: second.cookie } }).then(r => r.json())).toEqual({ count: 1, interested: null });
});
test('Missing targets and wrong Activity types cannot receive interest', async () => {
  const author = await member(); const paths = await targets(author.cookie);
  const wrongType = paths[1]!.replace('/projects/', '/events/');
  for (const path of [wrongType, '/api/ideas/2147483647', '/api/projects/not-a-number']) {
    expect((await fetch(`${base}${path}/interested`)).status).toBe(404);
    expect((await write(`${path}/interested`, author.cookie, {})).status).toBe(404);
    expect((await write(`${path}/interested`, author.cookie, {}, 'DELETE')).status).toBe(404);
  }
});

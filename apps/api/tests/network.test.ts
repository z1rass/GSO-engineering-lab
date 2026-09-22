import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createApp } from '../src/app.js';
import { requestTestLink, redeemTestLink } from './helpers/magic-link.js';
const url = process.env.TEST_DATABASE_URL ?? 'postgres://lab:lab_local@127.0.0.1:55433/lab_test';
if (!new URL(url).pathname.endsWith('_test')) throw new Error('Dedicated test database required');
const pool = new Pool({ connectionString: url });
let server: Server; let base: string; const origin = 'http://localhost:5173';
beforeAll(async () => {
  await migrate(drizzle(pool), { migrationsFolder: '../../database/migrations' });
  server = createApp(pool).listen(0, '127.0.0.1'); await once(server, 'listening');
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
beforeEach(async () => { await pool.query('DELETE FROM rate_limits'); });
afterAll(async () => { if (server) await new Promise<void>(r => server.close(() => r())); await pool.end(); });
async function member(ops = false) {
  const { email, url } = await requestTestLink(base, origin, 'Network editor'); const { cookie } = await redeemTestLink(base, url);
  if (ops) await pool.query("UPDATE users SET role='OPS' WHERE email=$1", [email]); return { email, cookie };
}
function call(path: string, cookie: string, method = 'GET', body?: unknown, requestOrigin = origin) {
  return fetch(`${base}${path}`, { method, headers: { cookie, origin: requestOrigin, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
const input = { name: 'Test engineer', company: 'Example company', professionalRole: 'Backend engineer', topics: ['Java', 'Cloud'], notes: 'Interested in student talks', contactMethod: 'speaker@example.test', source: 'Met at a local meetup' };
test('Ops preserve contact details and provenance through create, read, edit and delete', async () => {
  const ops = await member(true); const editor = await member(true);
  const created = await call('/api/ops/network', ops.cookie, 'POST', input); expect(created.status).toBe(201);
  const id = (await created.json()).contact.id;
  const first = await call(`/api/ops/network/${id}`, editor.cookie); expect(first.status).toBe(200); expect(first.headers.get('cache-control')).toBe('no-store');
  const contact = (await first.json()).contact;
  expect(contact).toMatchObject({ id, ...input, addedBy: { name: 'Network editor' } }); expect(contact.createdAt).toEqual(expect.any(String));
  expect(JSON.stringify(contact)).not.toContain(ops.email);
  expect((await call('/api/ops/network', editor.cookie).then(r => r.json())).contacts).toContainEqual(contact);
  const updated = { ...input, notes: 'Available next Season', topics: ['Distributed systems'] };
  expect((await call(`/api/ops/network/${id}`, editor.cookie, 'PATCH', updated)).status).toBe(200);
  expect((await call(`/api/ops/network/${id}`, ops.cookie).then(r => r.json())).contact).toMatchObject({ ...updated, addedBy: contact.addedBy, createdAt: contact.createdAt });
  expect((await call(`/api/ops/network/${id}`, ops.cookie, 'DELETE')).status).toBe(200);
  expect((await call(`/api/ops/network/${id}`, ops.cookie)).status).toBe(404);
  expect((await call('/api/ops/network', editor.cookie).then(r => r.json())).contacts).not.toContainEqual(expect.objectContaining({ id }));
});

test('Visitors and Members cannot read or change contacts, including direct IDs and expired Ops authority', async () => {
  const ops = await member(true); const user = await member();
  const id = (await call('/api/ops/network', ops.cookie, 'POST', input).then(r => r.json())).contact.id;
  for (const [cookie, status] of [['', 401], [user.cookie, 403]] as const) {
    for (const [path, method, body] of [
      ['/api/ops/network', 'GET', undefined], [`/api/ops/network/${id}`, 'GET', undefined],
      ['/api/ops/network', 'POST', input], [`/api/ops/network/${id}`, 'PATCH', input], [`/api/ops/network/${id}`, 'DELETE', undefined],
    ] as const) {
      const response = await call(path, cookie, method, body); expect(response.status).toBe(status);
      expect(response.headers.get('cache-control')).toBe('no-store'); expect(await response.text()).not.toContain(input.contactMethod);
    }
    for (const path of ['/api/network', `/api/network/${id}`, '/api/activities/recent', '/api/seasons', '/api/ideas', '/api/projects', '/api/events']) {
      expect(await call(path, cookie).then(r => r.text())).not.toContain(input.contactMethod);
    }
  }
  expect((await call(`/api/ops/network/${id}`, ops.cookie, 'DELETE', undefined, 'https://untrusted.example')).status).toBe(403);
  expect((await call(`/api/ops/network/${id}`, ops.cookie)).status).toBe(200);
  await pool.query("UPDATE users SET role='MEMBER' WHERE email=$1", [ops.email]);
  expect((await call(`/api/ops/network/${id}`, ops.cookie)).status).toBe(403);
});

test('Contact validation rejects empty or oversized data and client-supplied provenance', async () => {
  const ops = await member(true);
  for (const invalid of [{ ...input, name: ' ' }, { ...input, topics: [''] }, { ...input, topics: Array(21).fill('Topic') }, { ...input, contactMethod: 'a'.repeat(1001) }, { ...input, addedBy: 'forged' }]) {
    expect((await call('/api/ops/network', ops.cookie, 'POST', invalid)).status).toBe(400);
  }
  const id = (await call('/api/ops/network', ops.cookie, 'POST', input).then(r => r.json())).contact.id;
  expect((await call(`/api/ops/network/${id}`, ops.cookie, 'PATCH', { ...input, createdAt: '2000-01-01' })).status).toBe(400);
  expect((await call(`/api/ops/network/${id}`, ops.cookie).then(r => r.json())).contact).toMatchObject(input);
  expect((await call('/api/ops/network/not-an-id', ops.cookie)).status).toBe(404);
  expect((await call('/api/ops/network/2147483647', ops.cookie, 'PATCH', input)).status).toBe(404);
});

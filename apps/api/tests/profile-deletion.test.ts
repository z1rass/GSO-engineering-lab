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

beforeAll(async () => { await migrate(drizzle(pool), { migrationsFolder: '../../database/migrations' }); server = createApp(pool).listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`; });
beforeEach(async () => { await pool.query('DELETE FROM rate_limits'); await pool.query('DELETE FROM seasons'); await pool.query('DELETE FROM activities'); await pool.query('DELETE FROM ideas'); });
afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); await pool.end(); });

async function member(name: string, ops = false) {
  const { email, url: link } = await requestTestLink(base, origin, name); const { cookie } = await redeemTestLink(base, link);
  if (ops) await pool.query("UPDATE users SET role='OPS' WHERE email=$1", [email]);
  const profile = await call('/api/me', cookie).then(response => response.json());
  return { email, cookie, id: profile.user.id };
}
function call(path: string, cookie = '', method = 'GET', body?: unknown) {
  return fetch(`${base}${path}`, { method, headers: { cookie, origin, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function write(path: string, cookie: string, body: unknown, method = 'POST') {
  const response = await call(path, cookie, method, body); expect(response.ok).toBe(true); return response.json();
}

test('Ops deletion requires resolving active ownership and anonymizes the account while retaining results', async () => {
  const ops = await member('Deletion Ops', true); const target = await member('Delete this member');
  await pool.query("UPDATE users SET role='OPS' WHERE id=$1", [target.id]);
  const idea = (await write('/api/ideas', target.cookie, { title: 'Retained idea', description: 'Community result' })).idea;
  const project = (await write('/api/projects', target.cookie, { title: 'Retained project', description: 'Community code', goal: 'Build', ideaId: idea.id })).project;
  const task = (await write(`/api/activities/${project.id}/tasks`, target.cookie, { title: 'Retained task' })).task;
  await write(`/api/tasks/${task.id}/take`, target.cookie, {});
  const contactName = `Independent contact ${target.id}`;
  await write('/api/ops/network', target.cookie, { name: contactName, company: 'Example', notes: 'Added by the target owner' });
  const endpoint = `/api/ops/users/${target.id}/profile-deletion`;
  expect((await call(endpoint, ops.cookie, 'POST', { cancelActivityIds: [] })).status).toBe(409);
  const conflict = await call(endpoint, ops.cookie, 'POST', { cancelActivityIds: [] }).then(response => response.json());
  expect(conflict).toMatchObject({ error: 'ACTIVE_OWNERSHIP_REQUIRES_RESOLUTION', activities: [{ id: project.id }] });

  const deleted = await call(endpoint, ops.cookie, 'POST', { cancelActivityIds: [project.id] });
  expect(deleted.status).toBe(200); expect(await deleted.json()).toEqual({ deleted: true, userId: target.id, cancelledActivityIds: [project.id] });
  expect((await call('/api/me', target.cookie)).status).toBe(401);
  const profile = await pool.query('SELECT name,email,role,affiliation,email_verified,education,year,interests FROM users WHERE id=$1', [target.id]);
  expect(profile.rows[0]).toMatchObject({ name: 'Deleted participant', role: 'MEMBER', affiliation: 'DELETED', email_verified: false, education: null, year: null, interests: null });
  expect(profile.rows[0].email).not.toBe(target.email);
  const result = await pool.query('SELECT a.status,a.owner_id,t.status AS task_status,u.name AS task_owner FROM activities a JOIN tasks t ON t.activity_id=a.id LEFT JOIN users u ON u.id=t.owner_id WHERE a.id=$1', [project.id]);
  expect(result.rows[0]).toMatchObject({ status: 'CANCELLED', owner_id: target.id, task_status: 'CANCELLED', task_owner: 'Deleted participant' });
  expect((await pool.query('SELECT created_by FROM ideas WHERE id=$1', [idea.id])).rows[0].created_by).toBeNull();
  expect((await pool.query('SELECT added_by FROM contacts WHERE name=$1', [contactName])).rows[0].added_by).toBe(target.id);
  expect((await pool.query('SELECT count(*)::int AS count FROM sessions WHERE user_id=$1', [target.id])).rows[0].count).toBe(0);
});

test('Only Ops can delete and an already deleted account cannot be processed twice', async () => {
  const ops = await member('Deletion Ops', true); const target = await member('Delete me');
  const endpoint = `/api/ops/users/${target.id}/profile-deletion`;
  expect((await call(endpoint, target.cookie, 'POST', { cancelActivityIds: [] })).status).toBe(403);
  await write(endpoint, ops.cookie, { cancelActivityIds: [] });
  expect((await call(endpoint, ops.cookie, 'POST', { cancelActivityIds: [] })).status).toBe(404);
});

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
afterAll(async () => { if (server) await new Promise<void>(r => server.close(() => r())); await pool.end(); });
async function member(ops = false) { const { email, url } = await requestTestLink(base, origin, 'Moderation member'); const { cookie } = await redeemTestLink(base, url); if (ops) await pool.query("UPDATE users SET role='OPS' WHERE email=$1", [email]); const user = (await call('/api/me', cookie).then(r => r.json())).user; return { cookie, id: user.id }; }
function call(path: string, cookie = '', method = 'GET', body?: unknown) { return fetch(`${base}${path}`, { method, headers: { cookie, origin, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
async function write(path: string, cookie: string, body: unknown = {}, method = 'POST') { const r = await call(path, cookie, method, body); expect(r.ok).toBe(true); return r.json(); }
const projectInput = { title: 'Hidden project', description: 'Private moderation text', goal: 'Build' };
const moderation = '/api/ops/moderation';

test('Only Ops hide and restore an Idea with a reason and a preserved audit history', async () => {
  const ops = await member(true); const author = await member();
  const idea = (await write('/api/ideas', author.cookie, { title: 'Moderated idea', description: 'Keep history' })).idea;
  const path = `${moderation}/ideas/${idea.id}`;
  expect((await call(path, author.cookie, 'POST', { hidden: true, reason: 'Reason' })).status).toBe(403);
  expect((await call(path, ops.cookie, 'POST', { hidden: true, reason: ' ' })).status).toBe(400);
  await write(path, ops.cookie, { hidden: true, reason: 'Needs review' });
  for (const cookie of ['', author.cookie]) expect((await call(`/api/ideas/${idea.id}`, cookie)).status).toBe(404);
  expect((await call(`/api/ideas/${idea.id}`, ops.cookie).then(r => r.json())).idea).toEqual(idea);
  await write(path, ops.cookie, { hidden: false, reason: 'Review completed' });
  expect((await call(`/api/ideas/${idea.id}`).then(r => r.json())).idea).toEqual(idea);
  const log = await call(moderation, ops.cookie).then(r => r.json());
  expect(log.history).toEqual(expect.arrayContaining([
    expect.objectContaining({ targetType: 'IDEA', targetId: String(idea.id), action: 'HIDE', reason: 'Needs review' }),
    expect.objectContaining({ targetType: 'IDEA', targetId: String(idea.id), action: 'RESTORE', reason: 'Review completed' }),
  ]));
  expect((await call(`/api/ideas/${idea.id}`, author.cookie, 'PATCH', { title: 'Edit', description: 'By author' })).status).toBe(403);
});

test('Hidden Activity and Idea disappear from every discovery surface and child API without destroying work', async () => {
  const ops = await member(true); const owner = await member();
  const idea = (await write('/api/ideas', owner.cookie, { title: 'Hidden seed', description: 'Moderated seed text' })).idea;
  const project = (await write('/api/projects', owner.cookie, { ...projectInput, ideaId: idea.id })).project;
  const event = (await write('/api/events', owner.cookie, { title: 'Hidden event', description: 'Moderated event text', category: 'TALK' })).event;
  const task = (await write(`/api/activities/${project.id}/tasks`, owner.cookie, { title: 'Retained task' })).task;
  await write(`/api/tasks/${task.id}/take`, owner.cookie);
  await write(`/api/projects/${project.id}/membership`, owner.cookie);
  await write(`/api/projects/${project.id}/interested`, owner.cookie);
  await write(`/api/ideas/${idea.id}/interested`, owner.cookie);
  const season = (await write('/api/ops/seasons', ops.cookie, { number: 1900000000, title: 'Moderation season', description: '', startsOn: '2026-11-01', endsOn: '2026-12-01', status: 'UPCOMING' })).season;
  await write(`/api/activities/${project.id}/seasons`, owner.cookie, { seasonId: season.id });
  await write(`${moderation}/ideas/${idea.id}`, ops.cookie, { hidden: true, reason: 'Check seed' });
  expect((await call(`/api/projects/${project.id}`).then(r => r.json())).project.ideaId).toBeNull();
  await write(`${moderation}/activities/${project.id}`, ops.cookie, { hidden: true, reason: 'Check project' });
  await write(`${moderation}/activities/${event.id}`, ops.cookie, { hidden: true, reason: 'Check event' });
  for (const cookie of ['', owner.cookie]) {
    for (const path of [`/api/projects/${project.id}`, `/api/projects/${project.id}/membership`, `/api/projects/${project.id}/interested`, `/api/events/${event.id}`, `/api/events/${event.id}/going`, `/api/activities/${project.id}/tasks`, `/api/activities/${project.id}/seasons`, `/api/activities/${project.id}/room-request`, `/api/activities/${project.id}/ownership`, `/api/ideas/${idea.id}/interested`]) expect((await call(path, cookie)).status).toBe(404);
    for (const path of ['/api/projects', '/api/events', '/api/ideas', '/api/activities/recent', `/api/seasons/${season.id}`]) {
      const text = await call(path, cookie).then(r => r.text());
      for (const hiddenTitle of ['Hidden project', 'Hidden event', 'Hidden seed']) expect(text).not.toContain(hiddenTitle);
    }
  }
  expect((await call(`/api/tasks/${task.id}/release`, owner.cookie, 'POST', {})).status).toBe(404);
  expect((await call(`/api/projects/${project.id}`, owner.cookie, 'PATCH', projectInput)).status).toBe(404);
  const personal = await call('/api/me/activity', owner.cookie).then(r => r.json());
  expect(personal).toEqual({ projects: [], events: [], tasks: [], interested: { ideas: [], activities: [] } });
  expect((await call('/api/projects', owner.cookie, 'POST', { ...projectInput, ideaId: idea.id })).status).toBe(400);
  await write(`${moderation}/activities/${project.id}`, ops.cookie, { hidden: false, reason: 'Resolved' });
  expect((await call(`/api/activities/${project.id}/tasks`, owner.cookie).then(r => r.json())).tasks).toEqual([expect.objectContaining({ id: task.id, status: 'IN_PROGRESS', owner: { id: owner.id, name: 'Moderation member' } })]);
  expect((await call(`/api/projects/${project.id}/membership`, owner.cookie).then(r => r.json())).joined).toBe(true);
});

test('Blocking applies to a live session across all writes while retaining read access, responsibility and audit history', async () => {
  const ops = await member(true); const user = await member();
  const project = (await write('/api/projects', user.cookie, projectInput)).project;
  const task = (await write(`/api/activities/${project.id}/tasks`, user.cookie, { title: 'Keep ownership' })).task;
  await write(`/api/tasks/${task.id}/take`, user.cookie);
  const path = `${moderation}/users/${user.id}`;
  expect((await call(path, user.cookie, 'POST', { blocked: true, reason: 'Forged action' })).status).toBe(403);
  expect((await call(path, ops.cookie, 'POST', { blocked: true, reason: '' })).status).toBe(400);
  await write(path, ops.cookie, { blocked: true, reason: 'Contact Ops in Discord' });
  for (const [endpoint, method, body] of [
    ['/api/me', 'PATCH', { name: 'Changed' }], ['/api/ideas', 'POST', { title: 'New', description: 'New' }],
    ['/api/projects', 'POST', projectInput], [`/api/projects/${project.id}`, 'PATCH', projectInput],
    [`/api/projects/${project.id}/interested`, 'POST', {}], [`/api/projects/${project.id}/membership`, 'POST', {}],
    [`/api/tasks/${task.id}/release`, 'POST', {}], [`/api/activities/${project.id}/close`, 'POST', { status: 'COMPLETED', confirmUnfinishedTasks: true }],
  ] as const) {
    const response = await call(endpoint, user.cookie, method, body); expect(response.status).toBe(403); expect(await response.json()).toMatchObject({ error: 'USER_BLOCKED' });
  }
  const profile = await call('/api/me', user.cookie).then(r => r.json()); expect(profile.user).toMatchObject({ blocked: true, blockReason: 'Contact Ops in Discord' });
  const personal = await call('/api/me/activity', user.cookie).then(r => r.json()); expect(personal.tasks[0]).toMatchObject({ id: task.id, status: 'IN_PROGRESS' });
  await write(path, ops.cookie, { blocked: false, reason: 'Resolved in Discord' });
  await write(`/api/tasks/${task.id}/release`, user.cookie);
  expect((await call(`${moderation}/users/${ops.id}`, ops.cookie, 'POST', { blocked: true, reason: 'Self block' })).status).toBe(409);
  const secondOps = await member(true); await write(`${moderation}/users/${secondOps.id}`, ops.cookie, { blocked: true, reason: 'Pause Ops actions' });
  expect((await call('/api/ops/network', secondOps.cookie, 'POST', { name: 'Not allowed' })).status).toBe(403);
  const history = (await call(moderation, ops.cookie).then(r => r.json())).history;
  expect(history).toContainEqual(expect.objectContaining({ targetId: user.id, action: 'BLOCK', reason: 'Contact Ops in Discord' }));
  expect(history).toContainEqual(expect.objectContaining({ targetId: user.id, action: 'UNBLOCK', reason: 'Resolved in Discord' }));
});

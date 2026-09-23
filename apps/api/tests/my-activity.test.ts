import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createApp } from '../src/app.js';
import { requestTestLink, redeemTestLink, ownershipInvitationToken } from './helpers/magic-link.js';

const url = process.env.TEST_DATABASE_URL ?? 'postgres://lab:lab_local@127.0.0.1:55433/lab_test';
if (!new URL(url).pathname.endsWith('_test')) throw new Error('Dedicated test database required');
const pool = new Pool({ connectionString: url });
let server: Server; let base: string;
const origin = 'http://localhost:5173';
beforeAll(async () => {
  await migrate(drizzle(pool), { migrationsFolder: '../../database/migrations' });
  server = createApp(pool).listen(0, '127.0.0.1'); await once(server, 'listening');
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
beforeEach(async () => { await pool.query('DELETE FROM rate_limits'); });
afterAll(async () => { if (server) await new Promise<void>(r => server.close(() => r())); await pool.end(); });
async function member() {
  const { url } = await requestTestLink(base, origin, 'Overview member');
  return (await redeemTestLink(base, url)).cookie;
}
async function write(path: string, cookie: string, body: unknown = {}, method = 'POST') {
  const response = await fetch(`${base}${path}`, { method, headers: { cookie, origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  expect(response.ok).toBe(true); return response.json();
}
function overview(cookie: string) { return fetch(`${base}/api/me/activity`, { headers: { cookie } }); }
const projectInput = { title: 'Lab tools', description: 'Build together', goal: 'Make tools' };
const eventInput = { title: 'Build night', description: 'Make things', category: 'BUILD_NIGHT', plannedDate: '2026-11-28', startTime: '16:00', endTime: '18:00', generalLocation: 'Online' };

test('Personal overview separates ownership, team membership, Going, Tasks and Interested without exposing another User', async () => {
  const owner = await member(); const user = await member(); const outsider = await member();
  const own = (await write('/api/projects', user, { ...projectInput, title: 'My own project' })).project;
  const project = (await write('/api/projects', owner, projectInput)).project;
  const interestingProject = (await write('/api/projects', owner, { ...projectInput, title: 'Only curious' })).project;
  const event = (await write('/api/events', owner, eventInput)).event;
  const idea = (await write('/api/ideas', owner, { title: 'Robotics idea', description: 'Maybe robots' })).idea;
  await write(`/api/projects/${project.id}/membership`, user);
  await write(`/api/events/${event.id}/open`, owner);
  await write(`/api/events/${event.id}/going`, user);
  await write(`/api/ideas/${idea.id}/interested`, user);
  await write(`/api/projects/${own.id}/interested`, user);
  await write(`/api/projects/${interestingProject.id}/interested`, user);
  const task = (await write(`/api/activities/${event.id}/tasks`, owner, { title: 'Prepare materials', dueDate: '2026-11-27' })).task;
  await write(`/api/tasks/${task.id}/take`, user);
  const response = await overview(user); expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
  const data = await response.json();
  expect(data.projects).toEqual(expect.arrayContaining([
    { id: own.id, type: 'PROJECT', title: 'My own project', status: 'PLANNING', isOwner: true, joined: false, going: false },
    { id: project.id, type: 'PROJECT', title: 'Lab tools', status: 'PLANNING', isOwner: false, joined: true, going: false },
  ])); expect(data.projects).toHaveLength(2);
  expect(data.events).toEqual([{ id: event.id, type: 'EVENT', title: 'Build night', status: 'ACTIVE', isOwner: false, joined: false, going: true }]);
  expect(data.tasks).toEqual([{ id: task.id, title: 'Prepare materials', status: 'IN_PROGRESS', dueDate: '2026-11-27', activity: { id: event.id, type: 'EVENT', title: 'Build night', status: 'ACTIVE' } }]);
  expect(data.interested).toEqual({ ideas: [{ id: idea.id, title: 'Robotics idea' }], activities: [
    { id: interestingProject.id, type: 'PROJECT', title: 'Only curious', status: 'PLANNING' },
    { id: own.id, type: 'PROJECT', title: 'My own project', status: 'PLANNING' },
  ] });
  expect(await overview(outsider).then(r => r.json())).toEqual({ projects: [], events: [], tasks: [], interested: { ideas: [], activities: [] } });
  expect((await overview('')).status).toBe(401);
  const ownerId = (await fetch(`${base}/api/me`, { headers: { cookie: owner } }).then(r => r.json())).user.id;
  expect((await fetch(`${base}/api/me/activity?userId=${ownerId}`, { headers: { cookie: user } })).status).toBe(400);
  expect((await fetch(`${base}/api/users/${ownerId}/activity`, { headers: { cookie: user } })).status).toBe(404);
});

test('Overview follows saved task release, team departure and accepted ownership; completed work remains readable', async () => {
  const owner = await member(); const user = await member();
  const project = (await write('/api/projects', owner, projectInput)).project;
  const task = (await write(`/api/activities/${project.id}/tasks`, owner, { title: 'Independent task' })).task;
  await write(`/api/tasks/${task.id}/take`, user);
  let data = await overview(user).then(r => r.json());
  expect(data.projects).toEqual([]); expect(data.tasks).toHaveLength(1);
  await write(`/api/tasks/${task.id}/release`, user);
  expect((await overview(user).then(r => r.json())).tasks).toEqual([]);
  await write(`/api/projects/${project.id}/membership`, user);
  expect((await overview(user).then(r => r.json())).projects).toHaveLength(1);
  await write(`/api/projects/${project.id}/membership`, user, {}, 'DELETE');
  expect((await overview(user).then(r => r.json())).projects).toEqual([]);
  const userEmail = (await fetch(`${base}/api/me`, { headers: { cookie: user } }).then(r => r.json())).user.email;
  await write(`/api/activities/${project.id}/ownership`, owner, { email: userEmail });
  const token = await ownershipInvitationToken(userEmail);
  expect((await overview(user).then(r => r.json())).projects).toEqual([]);
  await write(`/api/ownership-invitations/${token}/accept`, user);
  data = await overview(user).then(r => r.json());
  expect(data.projects).toEqual([expect.objectContaining({ id: project.id, isOwner: true, joined: false })]);
  expect((await overview(owner).then(r => r.json())).projects).toEqual([]);
  await write(`/api/tasks/${task.id}/take`, user);
  await write(`/api/tasks/${task.id}/complete`, user);
  await write(`/api/activities/${project.id}/close`, user, { status: 'COMPLETED' });
  data = await overview(user).then(r => r.json());
  expect(data.projects[0]).toMatchObject({ id: project.id, status: 'COMPLETED', isOwner: true });
  expect(data.tasks[0]).toMatchObject({ id: task.id, status: 'DONE', activity: { status: 'COMPLETED' } });
});

test('Rescheduled Event moves from Going to Interested in the overview; withdrawing interest removes it', async () => {
  const owner = await member(); const user = await member();
  const event = (await write('/api/events', owner, eventInput)).event;
  await write(`/api/events/${event.id}/open`, owner);
  await write(`/api/events/${event.id}/going`, user);
  expect((await overview(user).then(r => r.json())).events).toEqual([expect.objectContaining({ id: event.id, going: true })]);
  await write(`/api/events/${event.id}`, owner, { ...eventInput, plannedDate: '2026-11-29' }, 'PATCH');
  const data = await overview(user).then(r => r.json());
  expect(data.events).toEqual([]);
  expect(data.interested.activities).toEqual([expect.objectContaining({ id: event.id })]);
  await write(`/api/events/${event.id}/interested`, user, {}, 'DELETE');
  expect((await overview(user).then(r => r.json())).interested.activities).toEqual([]);
});

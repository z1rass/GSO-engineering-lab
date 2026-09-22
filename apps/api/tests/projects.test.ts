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
const projectInput = { title: 'Lab infrastructure', goal: 'Build a shared lab', description: 'Learn by building.', techStack: ['Linux', 'Docker'], repositoryUrl: 'https://github.com/example/lab', documentationUrl: 'https://example.org/docs', materials: 'Public notes', privateInstructions: 'Private access instructions', discordUrl: 'https://discord.gg/example' };
test('Creator becomes the Project owner immediately; public reads exclude identities and private instructions', async () => {
  const author = await member();
  const response = await write('/api/projects', author.cookie, projectInput);
  expect(response.status).toBe(201);
  const { project } = await response.json();
  expect(project).toMatchObject({ title: 'Lab infrastructure', status: 'PLANNING', ideaId: null });
  const personal = await fetch(`${base}/api/projects/${project.id}`, { headers: { cookie: author.cookie } }).then(r => r.json());
  expect(personal.project).toMatchObject({ owner: { name: 'Private author' }, canEdit: true, privateInstructions: 'Private access instructions', discordUrl: 'https://discord.gg/example' });
  const publicView = await fetch(`${base}/api/projects/${project.id}`).then(r => r.json());
  expect(publicView.project).toEqual({ id: project.id, title: projectInput.title, goal: projectInput.goal, description: projectInput.description, techStack: projectInput.techStack,
    repositoryUrl: projectInput.repositoryUrl, documentationUrl: projectInput.documentationUrl, materials: 'Public notes', status: 'PLANNING', ideaId: null, createdAt: expect.any(String), updatedAt: expect.any(String) });
  const list = await fetch(`${base}/api/projects`).then(r => r.json());
  expect(list.projects).toContainEqual(publicView.project);
});

test('One Idea can inspire several Projects without changing its author or assigning its author ownership', async () => {
  const first = await member();
  const second = await member();
  const { idea } = await write('/api/ideas', first.cookie, { title: 'Homelab', description: 'Just an idea.' }).then(r => r.json());
  for (let i = 0; i < 2; i++) {
    const response = await write('/api/projects', second.cookie, { ...projectInput, ideaId: idea.id });
    expect(response.status).toBe(201);
    const { project } = await response.json();
    expect(project.ideaId).toBe(idea.id);
    const mine = await fetch(`${base}/api/projects/${project.id}`, { headers: { cookie: second.cookie } }).then(r => r.json());
    const originalAuthor = await fetch(`${base}/api/projects/${project.id}`, { headers: { cookie: first.cookie } }).then(r => r.json());
    expect(mine.project.canEdit).toBe(true);
    expect(originalAuthor.project.canEdit).toBe(false);
  }
  expect(await fetch(`${base}/api/ideas/${idea.id}`).then(r => r.json())).toEqual({ idea });
  expect((await write('/api/projects', first.cookie, { ...projectInput, ideaId: 2147483647 })).status).toBe(400);
});

test('Only owner or Ops edits and starts a Project; ownership and status cannot be injected through editing', async () => {
  const owner = await member();
  const other = await member();
  const { project } = await write('/api/projects', owner.cookie, projectInput).then(r => r.json());
  const path = `/api/projects/${project.id}`;
  expect((await write(path, '', projectInput, 'PATCH')).status).toBe(401);
  expect((await write(path, other.cookie, projectInput, 'PATCH')).status).toBe(403);
  expect((await write(`${path}/start`, other.cookie, {})).status).toBe(403);
  expect((await write(path, owner.cookie, { ...projectInput, ownerId: 'different' }, 'PATCH')).status).toBe(400);
  expect((await write(path, owner.cookie, { ...projectInput, status: 'COMPLETED' }, 'PATCH')).status).toBe(400);
  expect((await write(path, owner.cookie, { ...projectInput, title: 'Revised project' }, 'PATCH')).status).toBe(200);
  expect((await write(`${path}/start`, owner.cookie, {})).status).toBe(200);
  expect((await write(`${path}/start`, owner.cookie, {})).status).toBe(200);
  await pool.query("UPDATE users SET role='OPS' WHERE email=$1", [other.email]);
  expect((await write(path, other.cookie, { ...projectInput, materials: 'Updated notes' }, 'PATCH')).status).toBe(200);
  const updated = await fetch(`${base}${path}`, { headers: { cookie: owner.cookie } }).then(r => r.json());
  expect(updated.project).toMatchObject({ status: 'ACTIVE', materials: 'Updated notes', canEdit: true });
  expect((await write(path, owner.cookie, projectInput, 'PATCH', 'https://evil.example')).status).toBe(403);
});

test('Validation rejects unsafe links, spoofed owners and invalid content; ended membership loses private access', async () => {
  const owner = await member();
  expect((await write('/api/projects', '', projectInput)).status).toBe(401);
  for (const changed of [{ ownerId: 'someone' }, { status: 'ACTIVE' }, { goal: ' ' }, { title: 'x'.repeat(121) }, { repositoryUrl: 'javascript:alert(1)' }, { documentationUrl: 'https://user:password@example.org' }, { discordUrl: 'data:text/html,hello' }]) {
    expect((await write('/api/projects', owner.cookie, { ...projectInput, ...changed })).status).toBe(400);
  }
  const { project } = await write('/api/projects', owner.cookie, projectInput).then(r => r.json());
  await pool.query("UPDATE users SET affiliation='ALUMNI' WHERE email=$1", [owner.email]);
  const view = await fetch(`${base}/api/projects/${project.id}`, { headers: { cookie: owner.cookie } }).then(r => r.json());
  expect(view.project).not.toHaveProperty('owner');
  expect(view.project).not.toHaveProperty('privateInstructions');
  expect((await write(`/api/projects/${project.id}/start`, owner.cookie, {})).status).toBe(401);
  expect((await fetch(`${base}/api/projects/2147483647`)).status).toBe(404);
  expect((await fetch(`${base}/api/projects/not-an-id`)).status).toBe(404);
});

test('A Project accepts the documented text limits with multilingual materials and instructions', async () => {
  const owner = await member();
  const response = await write('/api/projects', owner.cookie, { ...projectInput, description: '界'.repeat(5000), materials: '界'.repeat(5000), privateInstructions: '界'.repeat(5000) });
  expect(response.status).toBe(201);
});

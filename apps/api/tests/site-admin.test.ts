import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, expect, test } from 'vitest';
import sharp from 'sharp';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/database/index.js';

const password = 'a-local-admin-password-for-tests';
const origin = 'http://localhost:5173';
const db = openDatabase(':memory:');
let server: Server;
let base: string;
beforeAll(async () => {
  process.env.ADMIN_PASSWORD = password;
  process.env.ADMIN_SESSION_SECRET = 'test-admin-session-secret-with-more-than-thirty-two-characters';
  server = createApp(db).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  db.close();
  delete process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_SESSION_SECRET;
});
const write = (path: string, method: string, body?: unknown, cookie = '', requestOrigin = origin) => fetch(`${base}${path}`, {
  method, headers: { origin: requestOrigin, cookie, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
});

async function adminCookie() {
  const response = await write('/api/admin/login', 'POST', { password });
  expect(response.status).toBe(200);
  expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  return response.headers.get('set-cookie')!.split(';')[0]!;
}

test('admin access remains password protected and checks request origin', async () => {
  expect(await fetch(`${base}/api/admin/session`).then(response => response.json())).toEqual({ configured: true, authenticated: false });
  expect((await write('/api/admin/login', 'POST', { password }, '', 'https://other.example')).status).toBe(403);
  expect((await write('/api/admin/login', 'POST', { password: 'wrong' })).status).toBe(401);
  expect((await write('/api/admin/events', 'POST', {})).status).toBe(401);
  const cookie = await adminCookie();
  expect((await fetch(`${base}/api/admin/session`, { headers: { cookie } }).then(response => response.json())).authenticated).toBe(true);
  expect((await write('/api/admin/events', 'POST', {}, cookie, 'https://other.example')).status).toBe(403);
  expect((await write('/api/admin/logout', 'POST', {}, cookie)).headers.get('set-cookie')).toContain('Max-Age=0');
});

test('admin publishes, updates and removes a room event with a selected or uploaded cover', async () => {
  const cookie = await adminCookie();
  const cover = '/covers/event-ribbon.jpg';
  const plan = { title: 'Build night', description: 'Bring a laptop.', category: 'BUILD_NIGHT', plannedDate: '2026-10-22', endDate: null,
    startTime: '18:00', endTime: '20:00', placeType: 'SCHOOL', generalLocation: 'C001', coverUrl: cover };
  expect((await write('/api/admin/events', 'POST', { ...plan, endTime: '17:00' }, cookie)).status).toBe(400);
  const created = await write('/api/admin/events', 'POST', plan, cookie);
  expect(created.status).toBe(201);
  const id = (await created.json()).id as number;
  expect((await fetch(`${base}/api/events/${id}`).then(response => response.json())).event)
    .toMatchObject({ title: 'Build night', generalLocation: 'C001', coverUrl: cover });
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN4sAAAAASUVORK5CYII=';
  const upload = await write('/api/admin/covers', 'POST', { mimeType: 'image/png', data: png }, cookie);
  expect(upload.status).toBe(201);
  const { coverUrl } = await upload.json() as { coverUrl: string };
  expect((await fetch(`${base}${coverUrl}`)).headers.get('content-type')).toContain('image/png');
  expect((await write(`/api/admin/events/${id}`, 'PATCH', { ...plan, title: 'Build with friends', generalLocation: 'B102', coverUrl }, cookie)).status).toBe(200);
  expect((await fetch(`${base}/api/events/${id}`).then(response => response.json())).event)
    .toMatchObject({ title: 'Build with friends', generalLocation: 'B102', coverUrl });
  expect((await write(`/api/admin/events/${id}`, 'DELETE', undefined, cookie)).status).toBe(200);
  expect((await fetch(`${base}/api/events/${id}`)).status).toBe(404);
});

test('any visitor can suggest an idea and vote once per browser; admin can remove it', async () => {
  expect((await write('/api/ideas', 'POST', { title: 'No', description: 'Wrong origin' }, '', 'https://other.example')).status).toBe(403);
  expect((await write('/api/ideas', 'POST', { title: 'No', description: 'Wrong cover', coverUrl: 'https://other.example/image.jpg' })).status).toBe(400);
  const coverUrl = '/covers/cover-ideas-paper.webp';
  const created = await write('/api/ideas', 'POST', { title: 'Open lab', description: 'Build something together.', coverUrl });
  expect(created.status).toBe(201);
  const createdIdea = (await created.json()).idea as { id: number; coverUrl: string };
  const id = createdIdea.id;
  expect(createdIdea.coverUrl).toBe(coverUrl);
  const firstView = await fetch(`${base}/api/ideas/${id}`);
  const voter = firstView.headers.get('set-cookie')!.split(';')[0]!;
  expect((await firstView.json()).idea).toMatchObject({ voteCount: 0, voted: false, coverUrl });
  expect((await write(`/api/ideas/${id}/vote`, 'POST', undefined, voter)).status).toBe(200);
  expect((await write(`/api/ideas/${id}/vote`, 'POST', undefined, voter).then(response => response.json()))).toMatchObject({ voteCount: 1, voted: true });
  expect((await fetch(`${base}/api/ideas/${id}`, { headers: { cookie: voter } }).then(response => response.json())).idea).toMatchObject({ voteCount: 1, voted: true });
  const secondVisitor = (await fetch(`${base}/api/ideas/${id}`)).headers.get('set-cookie')!.split(';')[0]!;
  expect((await write(`/api/ideas/${id}/vote`, 'POST', undefined, secondVisitor).then(response => response.json()))).toMatchObject({ voteCount: 2, voted: true });
  expect((await write(`/api/ideas/${id}/vote`, 'DELETE', undefined, voter).then(response => response.json()))).toMatchObject({ voteCount: 1, voted: false });
  const admin = await adminCookie();
  expect((await write(`/api/admin/ideas/${id}`, 'PATCH', { title: 'Renamed lab', description: 'Still building together.' }, admin)).status).toBe(200);
  expect((await fetch(`${base}/api/ideas/${id}`).then(response => response.json())).idea.coverUrl).toBe(coverUrl);
  expect((await write(`/api/admin/ideas/${id}`, 'DELETE', undefined, admin)).status).toBe(200);
  expect((await fetch(`${base}/api/ideas/${id}`)).status).toBe(404);
});

test('visitors can join and leave a scheduled event; rescheduling clears commitments', async () => {
  const admin = await adminCookie();
  const plan = { title: 'Robot night', description: 'Build together.', category: 'BUILD_NIGHT', plannedDate: '2027-10-22', endDate: null,
    startTime: '18:00', endTime: '20:00', placeType: 'SCHOOL', generalLocation: 'C001', coverUrl: '/covers/cover-robotics.webp' };
  const created = await write('/api/admin/events', 'POST', plan, admin);
  expect(created.status).toBe(201);
  const id = (await created.json()).id as number;
  const firstView = await fetch(`${base}/api/events/${id}`);
  const visitorOne = firstView.headers.get('set-cookie')!.split(';')[0]!;
  expect((await firstView.json()).event).toMatchObject({ goingCount: 0, going: false, coverUrl: plan.coverUrl });
  expect((await write(`/api/events/${id}/going`, 'POST', undefined, visitorOne, 'https://other.example')).status).toBe(403);
  expect((await write(`/api/events/${id}/going`, 'POST', undefined, visitorOne).then(response => response.json()))).toEqual({ going: true, goingCount: 1 });
  expect((await write(`/api/events/${id}/going`, 'POST', undefined, visitorOne).then(response => response.json()))).toEqual({ going: true, goingCount: 1 });
  const visitorTwo = (await fetch(`${base}/api/events/${id}`)).headers.get('set-cookie')!.split(';')[0]!;
  expect((await write(`/api/events/${id}/going`, 'POST', undefined, visitorTwo).then(response => response.json()))).toEqual({ going: true, goingCount: 2 });
  expect((await fetch(`${base}/api/events/${id}`, { headers: { cookie: visitorOne } }).then(response => response.json())).event)
    .toMatchObject({ goingCount: 2, going: true });
  expect((await write(`/api/events/${id}/going`, 'DELETE', undefined, visitorOne).then(response => response.json()))).toEqual({ going: false, goingCount: 1 });
  expect((await write(`/api/admin/events/${id}`, 'PATCH', { ...plan, title: 'Robot night updated' }, admin)).status).toBe(200);
  expect((await fetch(`${base}/api/events/${id}`).then(response => response.json())).event.goingCount).toBe(1);
  expect((await write(`/api/admin/events/${id}`, 'PATCH', { ...plan, plannedDate: '2027-10-23' }, admin)).status).toBe(200);
  expect((await fetch(`${base}/api/events/${id}`).then(response => response.json())).event.goingCount).toBe(0);
  expect((await write(`/api/admin/events/${id}`, 'PATCH', { ...plan, plannedDate: null, startTime: null, endTime: null }, admin)).status).toBe(200);
  expect((await write(`/api/events/${id}/going`, 'POST', undefined, visitorTwo)).status).toBe(409);
});

test('share images turn public covers into wide JPEG previews and hide removed content', async () => {
  const admin = await adminCookie();
  const event = await write('/api/admin/events', 'POST', {
    title: 'Shareable workshop', description: 'Build a circuit together.', category: 'WORKSHOP',
    plannedDate: null, endDate: null, startTime: null, endTime: null,
    placeType: 'SCHOOL', generalLocation: 'B102', coverUrl: '/covers/cover-robotics.webp',
  }, admin);
  expect(event.status).toBe(201);
  const eventId = (await event.json()).id as number;
  const idea = await write('/api/ideas', 'POST', {
    title: 'Shareable idea', description: 'Something to try together.', coverUrl: '/covers/cover-ideas-paper.webp',
  });
  expect(idea.status).toBe(201);
  const ideaId = (await idea.json()).idea.id as number;
  for (const path of [`/api/share/events/${eventId}/image.jpg`, `/api/share/ideas/${ideaId}/image.jpg`]) {
    const response = await fetch(`${base}${path}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/jpeg');
    const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
    expect(metadata).toMatchObject({ format: 'jpeg', width: 1200, height: 630 });
  }
  expect((await write(`/api/admin/events/${eventId}`, 'DELETE', undefined, admin)).status).toBe(200);
  expect((await write(`/api/admin/ideas/${ideaId}`, 'DELETE', undefined, admin)).status).toBe(200);
  expect((await fetch(`${base}/api/share/events/${eventId}/image.jpg`)).status).toBe(404);
  expect((await fetch(`${base}/api/share/ideas/${ideaId}/image.jpg`)).status).toBe(404);
});

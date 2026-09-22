import { requestExistingTestLink, requestTestLink, redeemTestLink } from './helpers/magic-link.js';
import { once } from 'node:events';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createApp } from '../src/app.js';
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
beforeEach(async () => { await pool.query('DELETE FROM rate_limits'); await pool.query('DELETE FROM role_changes'); await pool.query("UPDATE users SET role='MEMBER'"); });
afterAll(async () => { if (server) await new Promise<void>(r => server.close(() => r())); await pool.end(); });
async function member(name: string) {
  const { email, url } = await requestTestLink(base, origin, name);
  const { cookie } = await redeemTestLink(base, url);
  const profile = await fetch(`${base}/api/me`, { headers: { cookie } }).then(r => r.json());
  return { email, cookie, id: String(profile.user.id) };
}
async function bootstrap(email: string, extra = ['--confirmed-by', 'School sponsor', '--operator', 'Server admin']) {
  try {
    const result = await promisify(execFile)(process.execPath, ['--import', 'tsx', 'src/modules/ops/bootstrap.ts', '--email', email, ...extra], { env: { ...process.env, DATABASE_URL: databaseUrl } });
    return { ok: true, output: result.stdout };
  } catch (error) { return { ok: false, output: String(error) }; }
}
async function recover(emails: string[], extra = ['--confirmed-by', 'School sponsor', '--operator', 'Server admin', '--handover-checklist', 'Shared ownership and organisational account handover recorded']) {
  try {
    const result = await promisify(execFile)(process.execPath, ['--import', 'tsx', 'src/modules/ops/recover.ts', '--emails', emails.join(','), ...extra], { env: { ...process.env, DATABASE_URL: databaseUrl } });
    return { ok: true, output: result.stdout };
  } catch (error) { return { ok: false, output: String(error) }; }
}
test('Server admin bootstraps a verified Member once after sponsor confirmation; the existing session sees the persisted role', async () => {
  const first = await member('First Ops');
  expect(await bootstrap(first.email)).toMatchObject({ ok: true });
  const response = await fetch(`${base}/api/me`, { headers: { cookie: first.cookie } });
  expect(await response.json()).toMatchObject({ user: { role: 'OPS' } });
  const second = await member('Another Member');
  expect(await bootstrap(second.email)).toMatchObject({ ok: false });
  const unchanged = await fetch(`${base}/api/me`, { headers: { cookie: second.cookie } });
  expect(await unchanged.json()).toMatchObject({ user: { role: 'MEMBER' } });
});

test('An existing Ops appoints another verified Member through the API and the audit identifies both actors', async () => {
  const first = await member('Existing Ops');
  const second = await member('New Ops');
  expect((await bootstrap(first.email)).ok).toBe(true);
  const appoint = () => fetch(`${base}/api/ops/appointments`, { method: 'POST', headers: { origin, cookie: first.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: second.id }) });
  expect((await appoint()).status).toBe(201);
  expect((await appoint()).status).toBe(409);
  const profile = await fetch(`${base}/api/me`, { headers: { cookie: second.cookie } }).then(r => r.json());
  expect(profile.user.role).toBe('OPS');
  const dashboard = await fetch(`${base}/api/ops`, { headers: { cookie: second.cookie } }).then(r => r.json());
  expect(dashboard.changes).toHaveLength(2);
  expect(dashboard.changes[0]).toMatchObject({ source: 'APPOINTMENT', actorId: first.id, targetId: second.id, previousRole: 'MEMBER', newRole: 'OPS' });
  expect(dashboard.changes[1]).toMatchObject({ source: 'BOOTSTRAP', operator: 'Server admin', confirmedBy: 'School sponsor' });
  expect(JSON.stringify(dashboard)).not.toContain('@gso.schule.koeln');
});

test('Visitors and Members cannot see the Ops directory or appoint roles, including through profile editing', async () => {
  const ordinary = await member('Ordinary Member');
  for (const [cookie, status] of [['', 401], [ordinary.cookie, 403]] as const) {
    expect((await fetch(`${base}/api/ops`, { headers: { cookie } })).status).toBe(status);
    expect((await fetch(`${base}/api/ops/appointments`, { method: 'POST', headers: { origin, cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: ordinary.id }) })).status).toBe(status);
  }
  expect((await fetch(`${base}/api/me`, { method: 'PATCH', headers: { origin, cookie: ordinary.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Ordinary Member', role: 'OPS' }) })).status).toBe(400);
  expect((await bootstrap(ordinary.email)).ok).toBe(true);
  for (const badOrigin of ['', 'https://evil.example']) {
    expect((await fetch(`${base}/api/ops/appointments`, { method: 'POST', headers: { origin: badOrigin, cookie: ordinary.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: ordinary.id }) })).status).toBe(403);
  }
  await pool.query("UPDATE users SET affiliation='ALUMNI' WHERE id=$1", [ordinary.id]);
  expect((await fetch(`${base}/api/ops`, { headers: { cookie: ordinary.cookie } })).status).toBe(401);
  expect((await bootstrap(ordinary.email)).ok).toBe(false);
});

test('Bootstrap rejects absent, unverified or Alumni accounts and requires sponsor and operator attribution', async () => {
  const candidate = await member('Candidate');
  expect((await bootstrap(candidate.email, [])).ok).toBe(false);
  expect((await bootstrap('missing@gso.schule.koeln')).ok).toBe(false);
  await pool.query('UPDATE users SET email_verified=false WHERE id=$1', [candidate.id]);
  expect((await bootstrap(candidate.email)).ok).toBe(false);
  await pool.query("UPDATE users SET email_verified=true, affiliation='ALUMNI' WHERE id=$1", [candidate.id]);
  expect((await bootstrap(candidate.email)).ok).toBe(false);
});

test('Concurrent bootstrap commands yield one initial Ops and one audit record', async () => {
  const first = await member('First candidate');
  const second = await member('Second candidate');
  const results = await Promise.all([bootstrap(first.email), bootstrap(second.email)]);
  expect(results.filter(result => result.ok)).toHaveLength(1);
  const winner = results[0].ok ? first : second;
  const dashboard = await fetch(`${base}/api/ops`, { headers: { cookie: winner.cookie } }).then(r => r.json());
  expect(dashboard.changes).toHaveLength(1);
  expect(dashboard.changes[0]).toMatchObject({ targetId: winner.id, source: 'BOOTSTRAP' });
});

test('Server admin recovery restores multiple Ops after sponsor confirmation and records a distinct handover audit', async () => {
  const first = await member('Recovered first'); const second = await member('Recovered second');
  const restored = await recover([first.email, second.email]);
  expect(restored.ok).toBe(true);
  for (const candidate of [first, second]) {
    const profile = await fetch(`${base}/api/me`, { headers: { cookie: candidate.cookie } }).then(r => r.json());
    expect(profile.user.role).toBe('OPS');
    expect((await fetch(`${base}/api/ops`, { headers: { cookie: candidate.cookie } })).status).toBe(200);
  }
  const freshLink = await requestExistingTestLink(base, origin, first.email, 'Recovered first');
  const fresh = await redeemTestLink(base, freshLink.url);
  expect((await fetch(`${base}/api/ops`, { headers: { cookie: fresh.cookie } })).status).toBe(200);
  const dashboard = await fetch(`${base}/api/ops`, { headers: { cookie: first.cookie } }).then(r => r.json());
  expect(dashboard.changes).toHaveLength(2);
  expect(dashboard.changes).toEqual(expect.arrayContaining([
    expect.objectContaining({ targetId: first.id, source: 'RECOVERY', confirmedBy: 'School sponsor' }),
    expect.objectContaining({ targetId: second.id, source: 'RECOVERY', confirmedBy: 'School sponsor' }),
  ]));
  const third = await member('Recovery should reject');
  expect((await recover([third.email])).ok).toBe(false);
});

test('Recovery is not available to ordinary Members or without the documented handover inputs', async () => {
  const candidate = await member('Recovery candidate');
  await pool.query("UPDATE users SET blocked=true, block_reason='Resolve first' WHERE id=$1", [candidate.id]);
  expect((await fetch(`${base}/api/ops`, { headers: { cookie: candidate.cookie } })).status).toBe(403);
  expect((await recover([candidate.email], ['--confirmed-by', 'Sponsor', '--operator', 'Admin'])).ok).toBe(false);
  const blocked = await recover([candidate.email]);
  expect(blocked).toMatchObject({ ok: false }); expect(blocked.output).toContain('Every recovery target');
  expect((await pool.query("SELECT role FROM users WHERE id=$1", [candidate.id])).rows[0].role).toBe('MEMBER');
  expect((await pool.query("SELECT count(*)::int AS count FROM role_changes WHERE target_id=$1", [candidate.id])).rows[0].count).toBe(0);
  expect((await recover(['missing@gso.schule.koeln'])).ok).toBe(false);
});

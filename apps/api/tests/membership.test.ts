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
async function project(cookie: string) {
  const response = await write('/api/projects', cookie, { title: 'Team project', goal: 'Build together', description: 'Open to Members' });
  expect(response.status).toBe(201);
  return (await response.json()).project.id as number;
}
test('Members join a preparing Project immediately, repeated joins are unique, and leave retains their participation history', async () => {
  const owner = await member(); const participant = await member(); const id = await project(owner.cookie);
  const path = `/api/projects/${id}/membership`;
  expect((await fetch(`${base}${path}`)).status).toBe(200);
  expect(await fetch(`${base}${path}`).then(r => r.json())).toEqual({ count: 0 });
  const joins = await Promise.all(Array.from({length: 3}, () => write(path, participant.cookie, {})));
  expect(joins.map(r => r.status)).toEqual([200,200,200]);
  const read = () => fetch(`${base}${path}`, {headers:{cookie:participant.cookie}}).then(r => r.json());
  const joined = await read();
  expect(joined).toMatchObject({count:1, joined:true, isOwner:false, canJoin:true, members:[{name:'Private author'}], history:[{leftAt:null}]});
  expect(await fetch(`${base}${path}`).then(r => r.json())).toEqual({count:1});
  expect((await write(path, participant.cookie, {}, 'DELETE')).status).toBe(200);
  expect((await write(path, participant.cookie, {}, 'DELETE')).status).toBe(200);
  const left = await read();
  expect(left).toMatchObject({count:0,joined:false,members:[]});
  expect(left.history).toEqual([{joinedAt:joined.history[0].joinedAt,leftAt:expect.any(String)}]);
  await write(path, participant.cookie, {});
  expect((await read()).history).toHaveLength(2);
  expect((await fetch(`${base}/api/projects/${id}`,{headers:{cookie:owner.cookie}}).then(r=>r.json())).project).toMatchObject({canEdit:true,owner:{name:'Private author'},status:'PLANNING'});
});
test('An owner cannot use Leave to bypass responsibility; closed projects do not accept new members', async () => {
  const owner = await member(); const participant = await member(); const id = await project(owner.cookie);
  const path = `/api/projects/${id}/membership`;
  await write(path, owner.cookie, {});
  expect((await write(path, owner.cookie, {}, 'DELETE')).status).toBe(409);
  expect((await fetch(`${base}${path}`,{headers:{cookie:owner.cookie}}).then(r=>r.json()))).toMatchObject({joined:true,isOwner:true,count:1});
  const before = await fetch(`${base}/api/projects/${id}`,{headers:{cookie:owner.cookie}}).then(r=>r.json());
  await write(path, participant.cookie, {}); await write(path, participant.cookie, {}, 'DELETE');
  expect(await fetch(`${base}/api/projects/${id}`,{headers:{cookie:owner.cookie}}).then(r=>r.json())).toEqual(before);
  for (const status of ['COMPLETED','CANCELLED']) {
    await pool.query('UPDATE activities SET status=$2 WHERE id=$1',[id,status]);
    expect((await write(path, participant.cookie, {})).status).toBe(409);
    expect((await fetch(`${base}${path}`,{headers:{cookie:participant.cookie}}).then(r=>r.json())).canJoin).toBe(false);
  }
});
test('Interested and team membership are independent, joining grants no editing rights and Members cannot act for others', async () => {
  const owner = await member(); const participant = await member(); const id = await project(owner.cookie);
  const path = `/api/projects/${id}/membership`; const interest = `/api/projects/${id}/interested`;
  await write(interest, participant.cookie, {});
  expect(await fetch(`${base}${path}`).then(r=>r.json())).toEqual({count:0});
  expect((await write(path, '', {})).status).toBe(401);
  expect((await write(path, '', {}, 'DELETE')).status).toBe(401);
  expect((await write(path, participant.cookie, {}, 'POST', 'https://untrusted.example')).status).toBe(403);
  expect((await write(path, participant.cookie, {userId:'other'})).status).toBe(400);
  await write(path, participant.cookie, {});
  expect((await fetch(`${base}/api/projects/${id}`,{headers:{cookie:participant.cookie}}).then(r=>r.json())).project.canEdit).toBe(false);
  expect((await write(`/api/projects/${id}`,participant.cookie,{title:'Overwrite',goal:'No',description:'No'},'PATCH')).status).toBe(403);
  await write(interest, participant.cookie, {}, 'DELETE');
  expect(await fetch(`${base}${path}`).then(r=>r.json())).toEqual({count:1});
  await write(interest, participant.cookie, {});
  await write(path, participant.cookie, {}, 'DELETE');
  expect(await fetch(`${base}${interest}`,{headers:{cookie:participant.cookie}}).then(r=>r.json())).toEqual({count:1,interested:true});
  await pool.query("UPDATE users SET affiliation='ALUMNI' WHERE email=$1",[participant.email]);
  expect((await write(path,participant.cookie,{})).status).toBe(401);
  expect(await fetch(`${base}${path}`,{headers:{cookie:participant.cookie}}).then(r=>r.json())).toEqual({count:0});
  const event = await write('/api/events',owner.cookie,{title:'Not a project',description:'Test',category:'TALK'}).then(r=>r.json());
  for (const target of [`/api/projects/${event.event.id}/membership`, '/api/projects/2147483647/membership','/api/projects/invalid/membership']) {
    expect((await fetch(`${base}${target}`)).status).toBe(404);
    expect((await write(target,owner.cookie,{})).status).toBe(404);
  }
});

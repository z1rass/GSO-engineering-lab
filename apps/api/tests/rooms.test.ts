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
async function activity(cookie: string, type='projects') {
  const input = type==='projects' ? {title:'Room project',description:'Prepare',goal:'Build'} : {title:'Room event',description:'Prepare',category:'WORKSHOP'};
  const result = await write(`/api/${type}`,cookie,input).then(r=>r.json());
  return result[type==='projects'?'project':'event'].id as number;
}
const slot = {date:'2026-11-28',startTime:'16:00',endTime:'18:00',room:'A103',message:'Use the side entrance'};
test('Owner requests a Project room; Ops see the queue and an alternative stays unconfirmed until explicitly confirmed',async()=>{
  const owner=await member(); const ops=await member();
  await pool.query("UPDATE users SET role='OPS' WHERE email=$1",[ops.email]);
  for(const type of ['projects']) {
    const id=await activity(owner.cookie,type); const path=`/api/activities/${id}/room-request`;
    expect((await write(path,owner.cookie,{note:'A room for 12 people in November'})).status).toBe(201);
    const own=await fetch(`${base}${path}`,{headers:{cookie:owner.cookie}}).then(r=>r.json());
    expect(own.request).toMatchObject({status:'PENDING',note:'A room for 12 people in November'});
    const queue=await fetch(`${base}/api/ops/room-requests`,{headers:{cookie:ops.cookie}}).then(r=>r.json());
    expect(queue.requests).toEqual(expect.arrayContaining([expect.objectContaining({activityId:id,status:'PENDING'})]));
    const respond=`/api/ops/room-requests/${own.request.id}`;
    expect((await write(respond,ops.cookie,{status:'ALTERNATIVE',...slot},'PATCH')).status).toBe(200);
    expect((await fetch(`${base}${path}`,{headers:{cookie:owner.cookie}}).then(r=>r.json())).request).toMatchObject({status:'ALTERNATIVE',room:'A103',date:'2026-11-28'});
    expect(await fetch(`${base}${path}`).then(r=>r.json())).toEqual({request:{status:'ALTERNATIVE'}});
    expect((await write(respond,ops.cookie,{status:'CONFIRMED',...slot},'PATCH')).status).toBe(200);
    expect(await fetch(`${base}${path}`).then(r=>r.json())).toEqual({request:{status:'CONFIRMED'}});
    const view=await fetch(`${base}/api/${type}/${id}`,{headers:{cookie:owner.cookie}}).then(r=>r.json());
    expect(view[type==='projects'?'project':'event'].status).toBe('PLANNING');
  }
});
test('A scheduled school Event requests a room once; the owner accepts another time before Ops confirms its room',async()=>{
  const owner=await member();const ops=await member();await pool.query("UPDATE users SET role='OPS' WHERE email=$1",[ops.email]);
  const input={title:'School workshop',description:'Build together',category:'WORKSHOP',placeType:'SCHOOL',plannedDate:'2026-11-28',startTime:'16:00',endTime:'18:00'};
  const created=await write('/api/events',owner.cookie,input);expect(created.status).toBe(201);
  const id=(await created.json()).event.id;const path=`/api/activities/${id}/room-request`;
  const before=(await fetch(`${base}${path}`,{headers:{cookie:owner.cookie}}).then(r=>r.json())).request;
  expect(before.status).toBe('PENDING');
  expect((await write(`/api/events/${id}`,owner.cookie,input,'PATCH')).status).toBe(200);
  expect((await fetch(`${base}${path}`,{headers:{cookie:owner.cookie}}).then(r=>r.json())).request.id).toBe(before.id);
  const alternate={...slot,startTime:'17:00',endTime:'19:00'};
  expect((await write(`/api/ops/room-requests/${before.id}`,ops.cookie,{status:'ALTERNATIVE',...alternate},'PATCH')).status).toBe(200);
  expect((await write(`/api/ops/room-requests/${before.id}`,ops.cookie,{status:'CONFIRMED',...alternate},'PATCH')).status).toBe(409);
  expect((await write(`${path}/accept`,owner.cookie,{})).status).toBe(200);
  const accepted=await fetch(`${base}/api/events/${id}`).then(r=>r.json());
  expect(accepted.event).toMatchObject({plannedDate:alternate.date,startTime:'17:00',endTime:'19:00',status:'PLANNING'});
  expect((await write(`/api/ops/room-requests/${before.id}`,ops.cookie,{status:'CONFIRMED',...alternate},'PATCH')).status).toBe(200);
  expect((await fetch(`${base}/api/events/${id}`,{headers:{cookie:owner.cookie}}).then(r=>r.json())).event.exactRoom).toBe('A103');
  expect((await write(`/api/events/${id}/open`,owner.cookie,{})).status).toBe(200);
});
test('A school Event without a date stays in preparation until its schedule is saved',async()=>{
  const owner=await member();
  const input={title:'Planning a workshop',description:'Find a date',category:'WORKSHOP',placeType:'SCHOOL'};
  const created=await write('/api/events',owner.cookie,input);expect(created.status).toBe(201);
  const id=(await created.json()).event.id;const roomPath=`/api/activities/${id}/room-request`;
  expect((await fetch(`${base}${roomPath}`,{headers:{cookie:owner.cookie}}).then(r=>r.json())).request).toBeNull();
  expect((await write(roomPath,owner.cookie,{note:'Please book it'})).status).toBe(409);
  expect((await write(`/api/events/${id}`,owner.cookie,{...input,plannedDate:'2026-11-28',startTime:'16:00',endTime:'18:00'},'PATCH')).status).toBe(200);
  expect((await fetch(`${base}${roomPath}`,{headers:{cookie:owner.cookie}}).then(r=>r.json())).request.status).toBe('PENDING');
});
test('Confirmed room conditions are final and cannot be overwritten or reverted, even by Ops',async()=>{
  const owner=await member();const ops=await member();await pool.query("UPDATE users SET role='OPS' WHERE email=$1",[ops.email]);
  const id=await activity(owner.cookie);const path=`/api/activities/${id}/room-request`;
  await write(path,owner.cookie,{note:'Room please'});
  const read=()=>fetch(`${base}${path}`,{headers:{cookie:owner.cookie}}).then(r=>r.json());
  const room=(await read()).request;
  const respond=`/api/ops/room-requests/${room.id}`;
  expect((await write(respond,ops.cookie,{status:'CONFIRMED',...slot},'PATCH')).status).toBe(200);
  const before=await read();
  for(const status of ['CONFIRMED','ALTERNATIVE','PENDING']) expect((await write(respond,ops.cookie,{...slot,status,room:'B202'},'PATCH')).status).toBe(status==='PENDING'?400:409);
  expect((await write(path,owner.cookie,{note:'Replace request'})).status).toBe(409);
  expect(await read()).toEqual(before);
});
test('Only the owner requests, only current Ops answer, and private notes and rooms never leak publicly',async()=>{
  const owner=await member();const other=await member();const ops=await member();await pool.query("UPDATE users SET role='OPS' WHERE email=$1",[ops.email]);
  const id=await activity(owner.cookie);const path=`/api/activities/${id}/room-request`;
  expect((await write(path,'',{note:'Please'})).status).toBe(401);
  for(const actor of [other,ops]) expect((await write(path,actor.cookie,{note:'Please'})).status).toBe(403);
  expect((await write(path,owner.cookie,{note:'Please'},'POST','https://untrusted.example')).status).toBe(403);
  await write(path,owner.cookie,{note:'Private wishes'});
  const room=(await fetch(`${base}${path}`,{headers:{cookie:owner.cookie}}).then(r=>r.json())).request;
  const respond=`/api/ops/room-requests/${room.id}`;
  expect((await fetch(`${base}/api/ops/room-requests`)).status).toBe(401);
  expect((await fetch(`${base}/api/ops/room-requests`,{headers:{cookie:other.cookie}})).status).toBe(403);
  expect((await write(respond,owner.cookie,{status:'CONFIRMED',...slot},'PATCH')).status).toBe(403);
  for(const invalid of [{date:'2026-02-30'},{endTime:'15:00'},{endDate:'2026-11-27'},{room:''},{status:'PENDING'}])
    expect((await write(respond,ops.cookie,{status:'CONFIRMED',...slot,...invalid},'PATCH')).status).toBe(400);
  await write(respond,ops.cookie,{status:'ALTERNATIVE',...slot},'PATCH');
  expect(await fetch(`${base}${path}`,{headers:{cookie:other.cookie}}).then(r=>r.json())).toEqual({request:{status:'ALTERNATIVE'},canRequest:false,canRespond:false});
  await write(respond,ops.cookie,{status:'CONFIRMED',...slot},'PATCH');
  expect(await fetch(`${base}${path}`,{headers:{cookie:other.cookie}}).then(r=>r.json())).toEqual({request:{status:'CONFIRMED',date:'2026-11-28',endDate:null,startTime:'16:00',endTime:'18:00',room:'A103'},canRequest:false,canRespond:false});
  expect(await fetch(`${base}${path}`).then(r=>r.json())).toEqual({request:{status:'CONFIRMED'}});
  await pool.query("UPDATE users SET affiliation='ALUMNI' WHERE email=$1",[ops.email]);
  expect((await write(respond,ops.cookie,{status:'CONFIRMED',...slot},'PATCH')).status).toBe(401);
});

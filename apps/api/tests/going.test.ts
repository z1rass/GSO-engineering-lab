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
const readyEvent={title:'Build night',description:'Build together',category:'BUILD_NIGHT',plannedDate:'2026-11-28',startTime:'16:00',endTime:'18:00',generalLocation:'Online'};
async function createEvent(cookie:string,input:object=readyEvent){const response=await write('/api/events',cookie,input);expect(response.status).toBe(201);return (await response.json()).event.id as number;}
test('Only the owner opens a ready Event; Members register and withdraw without duplicates or public identities',async()=>{
 const owner=await member();const guest=await member();const id=await createEvent(owner.cookie);const path=`/api/events/${id}`;
 expect((await write(`${path}/going`,guest.cookie,{})).status).toBe(409);
 expect((await write(`${path}/open`,guest.cookie,{})).status).toBe(403);
 expect((await write(`${path}/open`,owner.cookie,{})).status).toBe(200);
 expect((await write(`${path}/open`,owner.cookie,{})).status).toBe(200);
 const results=await Promise.all(Array.from({length:3},()=>write(`${path}/going`,guest.cookie,{})));
 expect(results.map(r=>r.status)).toEqual([200,200,200]);
 expect((await fetch(`${base}${path}/going`,{headers:{cookie:guest.cookie}})).headers.get('cache-control')).toBe('no-store');
 expect(await fetch(`${base}${path}/going`).then(r=>r.json())).toEqual({open:true,count:1});
 expect(await fetch(`${base}${path}/going`,{headers:{cookie:guest.cookie}}).then(r=>r.json())).toMatchObject({open:true,count:1,going:true,isOwner:false,participants:[{name:'Private author'}]});
 expect(await fetch(`${base}${path}/interested`).then(r=>r.json())).toEqual({count:0,interested:null});
 expect((await write(`${path}/going`,guest.cookie,{},'DELETE')).status).toBe(200);
 expect((await write(`${path}/going`,guest.cookie,{},'DELETE')).status).toBe(200);
 expect(await fetch(`${base}${path}/going`).then(r=>r.json())).toEqual({open:true,count:0});
});
test('Opening requires complete conditions and a matching confirmed school room whenever requested or declared',async()=>{
 const owner=await member();const ops=await member();await pool.query("UPDATE users SET role='OPS' WHERE email=$1",[ops.email]);
 for(const partial of [{plannedDate:null},{startTime:null},{endTime:null},{generalLocation:''}]){
  const id=await createEvent(owner.cookie,{...readyEvent,...partial});expect((await write(`/api/events/${id}/open`,owner.cookie,{})).status).toBe(409);
 }
 const id=await createEvent(owner.cookie,{...readyEvent,placeType:'SCHOOL'});const path=`/api/events/${id}`;
 expect((await write(`${path}/open`,owner.cookie,{})).status).toBe(409);
 const room=(await fetch(`${base}/api/activities/${id}/room-request`,{headers:{cookie:owner.cookie}}).then(r=>r.json())).request;
 const slot={date:'2026-11-28',startTime:'15:00',endTime:'19:00',room:'A103'};
 await write(`/api/ops/room-requests/${room.id}`,ops.cookie,{...slot,status:'ALTERNATIVE'},'PATCH');
 expect((await write(`${path}/open`,owner.cookie,{})).status).toBe(409);
 await write(`/api/ops/room-requests/${room.id}`,ops.cookie,{...slot,status:'CONFIRMED'},'PATCH');
 expect((await write(`${path}/open`,owner.cookie,{})).status).toBe(200);
 expect((await fetch(`${base}${path}`,{headers:{cookie:owner.cookie}}).then(r=>r.json())).event.exactRoom).toBe('A103');
 expect((await write(path,owner.cookie,{...readyEvent,placeType:'OTHER'},'PATCH')).status).toBe(409);
 await write(path,owner.cookie,{...readyEvent,placeType:'SCHOOL',plannedDate:'2026-11-29'},'PATCH');
 expect((await write(`${path}/open`,owner.cookie,{})).status).toBe(409);
});
test('Rescheduling atomically moves Going to Interested and closes registration; description edits preserve Going',async()=>{
 const owner=await member();const first=await member();const second=await member();const id=await createEvent(owner.cookie);const path=`/api/events/${id}`;
 await write(`${path}/open`,owner.cookie,{});
 await write(`${path}/going`,first.cookie,{});await write(`${path}/going`,second.cookie,{});
 await write(`${path}/interested`,first.cookie,{});
 expect((await write(path,owner.cookie,{...readyEvent,description:'Better description'},'PATCH')).status).toBe(200);
 expect(await fetch(`${base}${path}/going`).then(r=>r.json())).toEqual({open:true,count:2});
 expect((await write(path,owner.cookie,{...readyEvent,plannedDate:'2026-11-29'},'PATCH')).status).toBe(200);
 expect(await fetch(`${base}${path}/going`).then(r=>r.json())).toEqual({open:false,count:0});
 expect(await fetch(`${base}${path}/interested`).then(r=>r.json())).toEqual({count:2,interested:null});
 expect((await write(`${path}/going`,first.cookie,{})).status).toBe(409);
 await write(`${path}/open`,owner.cookie,{});await write(`${path}/going`,first.cookie,{});
 expect((await write(path,owner.cookie,{...readyEvent,plannedDate:'2026-11-29',startTime:'17:00'},'PATCH')).status).toBe(200);
 expect(await fetch(`${base}${path}/going`).then(r=>r.json())).toEqual({open:false,count:0});
 expect(await fetch(`${base}${path}/interested`).then(r=>r.json())).toEqual({count:2,interested:null});
});
test('Registration enforces membership, Origin, closed state and serializes a concurrent join with rescheduling',async()=>{
 const owner=await member();const guest=await member();const id=await createEvent(owner.cookie);const path=`/api/events/${id}`;
 expect((await write(`${path}/open`,'',{})).status).toBe(401);
 expect((await write(`${path}/open`,owner.cookie,{},'POST','https://untrusted.example')).status).toBe(403);
 await write(`${path}/open`,owner.cookie,{});
 expect((await write(`${path}/going`,'',{})).status).toBe(401);
 expect((await write(`${path}/going`,guest.cookie,{userId:'someone-else'})).status).toBe(400);
 await write(`${path}/going`,guest.cookie,{});
 expect((await write(path,owner.cookie,{...readyEvent,plannedDate:'2026-02-30'},'PATCH')).status).toBe(400);
 expect(await fetch(`${base}${path}/going`).then(r=>r.json())).toEqual({open:true,count:1});
 const concurrent=await Promise.all([write(`${path}/going`,guest.cookie,{}),write(path,owner.cookie,{...readyEvent,plannedDate:'2026-12-01'},'PATCH')]);
 expect([200,409]).toContain(concurrent[0]!.status);expect(concurrent[1]!.status).toBe(200);
 expect(await fetch(`${base}${path}/going`).then(r=>r.json())).toEqual({open:false,count:0});
 await pool.query("UPDATE activities SET status='CANCELLED' WHERE id=$1",[id]);
 expect((await write(`${path}/open`,owner.cookie,{})).status).toBe(409);
 expect((await write(`${path}/going`,guest.cookie,{})).status).toBe(409);
 await pool.query("UPDATE users SET affiliation='ALUMNI' WHERE email=$1",[guest.email]);
 expect((await write(`${path}/going`,guest.cookie,{})).status).toBe(401);
 expect(await fetch(`${base}${path}/going`,{headers:{cookie:guest.cookie}}).then(r=>r.json())).toEqual({open:false,count:0});
});
test('Selecting school after opening creates the room request and returns the Event to preparation',async()=>{
 const owner=await member();const id=await createEvent(owner.cookie);const path=`/api/events/${id}`;
 await write(`${path}/open`,owner.cookie,{});
 expect((await write(path,owner.cookie,{...readyEvent,placeType:'SCHOOL'},'PATCH')).status).toBe(200);
 expect((await fetch(`${base}/api/activities/${id}/room-request`,{headers:{cookie:owner.cookie}}).then(r=>r.json())).request.status).toBe('PENDING');
 expect((await fetch(`${base}${path}`).then(r=>r.json())).event.status).toBe('PLANNING');
 expect((await write(`${path}/going`,owner.cookie,{})).status).toBe(409);
});

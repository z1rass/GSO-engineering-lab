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
async function activity(cookie:string,type='projects'){
 const data=type==='projects'?{title:'Tasks lab',goal:'Build',description:'Together'}:{title:'Tasks night',description:'Together',category:'WORKSHOP'};
 return (await write(`/api/${type}`,cookie,data).then(r=>r.json()))[type==='projects'?'project':'event'].id as number;
}
test('Owner must confirm unfinished Tasks before closing either Activity type; history and public materials survive',async()=>{
 const owner=await member();const worker=await member();
 for(const type of ['projects','events'])for(const status of ['COMPLETED','CANCELLED']){
  const id=await activity(owner.cookie,type);const path=`/api/activities/${id}`;
  const read=()=>fetch(`${base}${path}/tasks`,{headers:{cookie:owner.cookie}}).then(r=>r.json());
  const open=(await write(`${path}/tasks`,owner.cookie,{title:'Open work'}).then(r=>r.json())).task;
  const working=(await write(`${path}/tasks`,owner.cookie,{title:'In progress'}).then(r=>r.json())).task;
  const done=(await write(`${path}/tasks`,owner.cookie,{title:'Finished'}).then(r=>r.json())).task;
  await write(`/api/tasks/${working.id}/take`,worker.cookie,{});await write(`/api/tasks/${done.id}/take`,worker.cookie,{});await write(`/api/tasks/${done.id}/complete`,worker.cookie,{});
  const before=(await read()).tasks;
  const warning=await write(`${path}/close`,owner.cookie,{status});expect(warning.status).toBe(409);expect(await warning.json()).toMatchObject({error:'CONFIRM_UNFINISHED_TASKS',unfinishedCount:2});
  expect((await read()).tasks).toEqual(before);
  expect((await fetch(`${base}/api/${type}/${id}`).then(r=>r.json()))[type==='projects'?'project':'event'].status).toBe('PLANNING');
  expect((await write(`${path}/close`,owner.cookie,{status,confirmUnfinished:true})).status).toBe(200);
  const after=(await read()).tasks;
  expect(after.find((t:{id:number})=>t.id===open.id)).toMatchObject({status:'CANCELLED',owner:null,canTake:false});
  expect(after.find((t:{id:number})=>t.id===working.id)).toMatchObject({status:'CANCELLED',owner:before[1].owner,canComplete:false});
  expect(after.find((t:{id:number})=>t.id===done.id)).toMatchObject({status:'DONE',owner:before[2].owner});
  const archived=(await fetch(`${base}/api/${type}/${id}`).then(r=>r.json()))[type==='projects'?'project':'event'];expect(archived).toMatchObject({status,description:'Together'});expect(archived).not.toHaveProperty('owner');
  expect((await write(`${path}/tasks`,owner.cookie,{title:'Too late'})).status).toBe(409);
 }
});
test('Cancellation without a successor ends pending transfer and lets the former active owner leave; closed Activity rejects new work',async()=>{
 const owner=await member();const next=await member();const ops=await member();await pool.query("UPDATE users SET role='OPS' WHERE email=$1",[ops.email]);
 const id=await activity(owner.cookie);const path=`/api/activities/${id}`;
 await write(`/api/projects/${id}/membership`,owner.cookie,{});
 const transfer=(await write(`${path}/ownership`,owner.cookie,{email:next.email}).then(r=>r.json())).transfer;
 expect((await write(`${path}/close`,next.cookie,{status:'CANCELLED'})).status).toBe(403);
 expect((await write(`${path}/close`,ops.cookie,{status:'CANCELLED'})).status).toBe(403);
 expect((await write(`${path}/close`,'',{status:'CANCELLED'})).status).toBe(401);
 expect((await write(`${path}/close`,owner.cookie,{status:'CANCELLED'},'POST','https://other.example')).status).toBe(403);
 expect((await write(`${path}/close`,owner.cookie,{status:'ACTIVE'})).status).toBe(400);
 expect((await write(`${path}/close`,owner.cookie,{status:'CANCELLED'})).status).toBe(200);
 expect((await fetch(`${base}${path}/ownership`,{headers:{cookie:next.cookie}}).then(r=>r.json())).pending).toBeNull();
 expect((await write(`${path}/ownership/cancel`,next.cookie,{transferId:transfer.id})).status).toBe(409);
 expect((await write(`/api/projects/${id}/membership`,owner.cookie,{},'DELETE')).status).toBe(200);
 expect((await write(`/api/projects/${id}/membership`,next.cookie,{})).status).toBe(409);
 expect((await write(`/api/projects/${id}/start`,owner.cookie,{})).status).toBe(409);
 expect((await write(`${path}/room-request`,owner.cookie,{note:'Room please'})).status).toBe(409);
 expect((await fetch(`${base}${path}/room-request`,{headers:{cookie:owner.cookie}}).then(r=>r.json())).canRequest).toBe(false);
});
test('Archived Event keeps its Idea, materials and participants, and cannot reschedule or obtain a new room approval',async()=>{
 const owner=await member();const guest=await member();const ops=await member();await pool.query("UPDATE users SET role='OPS' WHERE email=$1",[ops.email]);
 const idea=(await write('/api/ideas',owner.cookie,{title:'Keep this idea',description:'Build together'}).then(r=>r.json())).idea;
 const input={title:'Finale',description:'Results',category:'TALK',plannedDate:'2026-11-28',startTime:'10:00',endTime:'12:00',generalLocation:'Online',materials:'Demo notes',repositoryUrl:'https://github.com/example/lab',ideaId:idea.id};
 const event=(await write('/api/events',owner.cookie,input).then(r=>r.json())).event;
 const id=event.id;const path=`/api/activities/${id}`;
 await write(`/api/events/${id}/open`,owner.cookie,{});await write(`/api/events/${id}/going`,guest.cookie,{});
 const {ideaId,...edit}={...input,placeType:'SCHOOL'};void ideaId;
 expect((await write(`/api/events/${id}`,owner.cookie,edit,'PATCH')).status).toBe(200);
 const room=(await fetch(`${base}${path}/room-request`,{headers:{cookie:owner.cookie}}).then(r=>r.json())).request;
 expect((await write(`${path}/close`,owner.cookie,{status:'COMPLETED'})).status).toBe(200);
 expect((await write(`/api/events/${id}`,owner.cookie,{...edit,plannedDate:'2026-12-01'},'PATCH')).status).toBe(409);
 expect((await write(`/api/events/${id}`,owner.cookie,{...edit,materials:'Final demo notes'},'PATCH')).status).toBe(200);
 expect((await fetch(`${base}/api/events/${id}`).then(r=>r.json())).event).toMatchObject({status:'COMPLETED',ideaId:idea.id,materials:'Final demo notes',repositoryUrl:input.repositoryUrl});
 expect((await fetch(`${base}/api/events/${id}/going`).then(r=>r.json()))).toMatchObject({open:false,count:1});
 expect((await write(`/api/events/${id}/going`,guest.cookie,{})).status).toBe(409);
 expect((await write(`/api/events/${id}/open`,owner.cookie,{})).status).toBe(409);
 expect((await write(`/api/ops/room-requests/${room.id}`,ops.cookie,{status:'CONFIRMED',date:'2026-11-28',startTime:'10:00',endTime:'12:00',room:'A103'},'PATCH')).status).toBe(409);
 expect((await fetch(`${base}/api/ideas/${idea.id}`).then(r=>r.json())).idea.title).toBe('Keep this idea');
});
test('Concurrent task creation and closure leave no unfinished work in the closed Activity',async()=>{
 const owner=await member();
 for(const type of ['projects','events']){
  const id=await activity(owner.cookie,type);const path=`/api/activities/${id}`;
  const results=await Promise.all([write(`${path}/tasks`,owner.cookie,{title:'Racing task'}),write(`${path}/close`,owner.cookie,{status:'CANCELLED',confirmUnfinished:true})]);
  expect([201,409]).toContain(results[0]!.status);expect(results[1]!.status).toBe(200);
  const tasks=await fetch(`${base}${path}/tasks`,{headers:{cookie:owner.cookie}}).then(r=>r.json());
  expect(tasks.tasks.every((task:{status:string})=>task.status==='CANCELLED')).toBe(true);
 }
});

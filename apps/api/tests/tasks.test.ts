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
const taskInput={title:'Prepare materials',description:'Write a short guide',dueDate:'2026-11-28'};
test('Owner creates Tasks for Projects and Events; one of concurrent takers wins and completion preserves attribution without joining',async()=>{
 const owner=await member();const first=await member();const second=await member();
 for(const type of ['projects','events']){
  const id=await activity(owner.cookie,type);const path=`/api/activities/${id}/tasks`;
  const created=await write(path,owner.cookie,taskInput);expect(created.status).toBe(201);const task=(await created.json()).task;
  const attempts=await Promise.all([write(`/api/tasks/${task.id}/take`,first.cookie,{}),write(`/api/tasks/${task.id}/take`,second.cookie,{})]);
  expect(attempts.map(r=>r.status).sort()).toEqual([200,409]);const winner=attempts[0]!.status===200?first:second;
  const read=()=>fetch(`${base}${path}`,{headers:{cookie:winner.cookie}}).then(r=>r.json());
  const owned=(await read()).tasks[0];expect(owned).toMatchObject({status:'IN_PROGRESS',owner:{name:'Private author'},canComplete:true});
  const publicView=await fetch(`${base}${path}`).then(r=>r.json());expect(publicView).toEqual({tasks:[{id:task.id,title:'Prepare materials',description:'Write a short guide',dueDate:'2026-11-28',status:'IN_PROGRESS'}]});
  const participation=await fetch(`${base}/api/${type}/${id}/${type==='projects'?'membership':'going'}`).then(r=>r.json());expect(participation.count).toBe(0);
  expect((await write(`/api/tasks/${task.id}/complete`,winner.cookie,{})).status).toBe(200);
  expect((await read()).tasks[0]).toMatchObject({status:'DONE',owner:owned.owner});
  expect((await write(`/api/tasks/${task.id}/release`,winner.cookie,{})).status).toBe(409);
 }
});
test('Task Owner releases unfinished work; Activity Owner and Ops edit and cancel, other Members cannot change the task',async()=>{
 const owner=await member();const worker=await member();const other=await member();const ops=await member();await pool.query("UPDATE users SET role='OPS' WHERE email=$1",[ops.email]);
 const id=await activity(owner.cookie);const path=`/api/activities/${id}/tasks`;
 expect((await write(path,other.cookie,taskInput)).status).toBe(403);
 const task=(await write(path,ops.cookie,taskInput).then(r=>r.json())).task;
 const taskPath=`/api/tasks/${task.id}`;
 await write(`${taskPath}/take`,worker.cookie,{});
 expect((await write(`${taskPath}/release`,other.cookie,{})).status).toBe(403);
 expect((await write(`${taskPath}/complete`,other.cookie,{})).status).toBe(403);
 expect((await write(`${taskPath}/release`,worker.cookie,{})).status).toBe(200);
 const read=()=>fetch(`${base}${path}`,{headers:{cookie:owner.cookie}}).then(r=>r.json());
 expect((await read()).tasks[0]).toMatchObject({status:'OPEN',owner:null,canTake:true});
 expect((await write(taskPath,other.cookie,{...taskInput,title:'Overwrite'},'PATCH')).status).toBe(403);
 expect((await write(taskPath,owner.cookie,{...taskInput,title:'Revised task'},'PATCH')).status).toBe(200);
 expect((await read()).tasks[0].title).toBe('Revised task');
 await write(`${taskPath}/take`,worker.cookie,{});const before=(await read()).tasks[0];
 expect((await write(`${taskPath}/cancel`,ops.cookie,{})).status).toBe(200);
 expect((await read()).tasks[0]).toMatchObject({status:'CANCELLED',owner:before.owner});
 expect((await write(`${taskPath}/take`,worker.cookie,{})).status).toBe(409);
});
test('Task writes require a current Member, valid input and open Activity; closed Tasks keep their attribution',async()=>{
 const owner=await member();const id=await activity(owner.cookie);const path=`/api/activities/${id}/tasks`;
 expect((await write(path,'',taskInput)).status).toBe(401);
 expect((await write(path,owner.cookie,taskInput,'POST','https://untrusted.example')).status).toBe(403);
 for(const input of [{...taskInput,dueDate:'2026-02-30'},{...taskInput,ownerId:'other'},{...taskInput,status:'DONE'}])expect((await write(path,owner.cookie,input)).status).toBe(400);
 const task=(await write(path,owner.cookie,{title:'No deadline'}).then(r=>r.json())).task;
 expect((await write(`/api/tasks/${task.id}/take`,'',{})).status).toBe(401);
 expect((await write(`/api/tasks/${task.id}/take`,owner.cookie,{ownerId:'other'})).status).toBe(400);
 await write(`/api/tasks/${task.id}/take`,owner.cookie,{});
 const response=await fetch(`${base}${path}`,{headers:{cookie:owner.cookie}});expect(response.headers.get('cache-control')).toBe('no-store');
 await pool.query("UPDATE activities SET status='COMPLETED' WHERE id=$1",[id]);
 expect((await write(path,owner.cookie,taskInput)).status).toBe(409);
 expect((await write(`/api/tasks/${task.id}/release`,owner.cookie,{})).status).toBe(409);
 await pool.query("UPDATE users SET affiliation='ALUMNI' WHERE email=$1",[owner.email]);
 expect((await write(`/api/tasks/${task.id}/complete`,owner.cookie,{})).status).toBe(401);
 expect((await fetch(`${base}${path}`,{headers:{cookie:owner.cookie}}).then(r=>r.json())).tasks[0]).not.toHaveProperty('owner');
});

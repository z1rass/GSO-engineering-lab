import {once} from 'node:events';
import type {Server} from 'node:http';
import type {AddressInfo} from 'node:net';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
import {Pool} from 'pg';
import {afterAll,beforeAll,beforeEach,expect,test} from 'vitest';
import {createApp} from '../src/app.js';
import {requestTestLink,redeemTestLink} from './helpers/magic-link.js';
const url=process.env.TEST_DATABASE_URL??'postgres://lab:lab_local@127.0.0.1:55433/lab_test';
if(!new URL(url).pathname.endsWith('_test'))throw new Error('Dedicated test database required');
const pool=new Pool({connectionString:url});
let server:Server;let base:string;const origin='http://localhost:5173';
beforeAll(async()=>{await migrate(drizzle(pool),{migrationsFolder:'../../database/migrations'});server=createApp(pool).listen(0,'127.0.0.1');await once(server,'listening');base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;});
beforeEach(async()=>{await pool.query('DELETE FROM seasons');await pool.query('DELETE FROM rate_limits');});
afterAll(async()=>{if(server)await new Promise<void>(r=>server.close(()=>r()));await pool.end();});
async function member(ops=false){const {email,url}=await requestTestLink(base,origin,'Season member');const {cookie}=await redeemTestLink(base,url);if(ops)await pool.query("UPDATE users SET role='OPS' WHERE email=$1",[email]);return cookie;}
function write(path:string,cookie:string,body:unknown,method='POST'){return fetch(`${base}${path}`,{method,headers:{cookie,origin,'Content-Type':'application/json'},body:JSON.stringify(body)});}
const seasonInput={number:0,title:'Build the Lab',description:'Build together',startsOn:'2026-11-01',endsOn:'2027-01-15',status:'DRAFT'};
test('Project continues across actual Seasons without losing its team or Tasks; public Season content never exposes identities',async()=>{
 const ops=await member(true);const owner=await member();const participant=await member();
 const first=(await write('/api/ops/seasons',ops,{...seasonInput,status:'ACTIVE'}).then(r=>r.json())).season;
 const later=(await write('/api/ops/seasons',ops,{...seasonInput,number:2,status:'UPCOMING'}).then(r=>r.json())).season;
 const project=(await write('/api/projects',owner,{title:'Persistent project',description:'Public notes',goal:'Build'}).then(r=>r.json())).project;
 const path=`/api/activities/${project.id}/seasons`;
 expect((await fetch(`${base}${path}`).then(r=>r.json())).seasons).toEqual([]);
 expect((await write(path,participant,{seasonId:first.id})).status).toBe(403);
 expect((await write(path,owner,{seasonId:first.id})).status).toBe(200);
 await write(`/api/projects/${project.id}/membership`,participant,{});
 const task=(await write(`/api/activities/${project.id}/tasks`,owner,{title:'Keep this task'}).then(r=>r.json())).task;
 await write(`/api/tasks/${task.id}/take`,participant,{});
 const teamBefore=await fetch(`${base}/api/projects/${project.id}/membership`,{headers:{cookie:owner}}).then(r=>r.json());
 const tasksBefore=await fetch(`${base}/api/activities/${project.id}/tasks`,{headers:{cookie:owner}}).then(r=>r.json());
 await write(`/api/ops/seasons/${first.id}`,ops,{...seasonInput,status:'FINISHED'},'PATCH');
 expect((await write(path,owner,{seasonId:later.id})).status).toBe(200);
 expect((await write(path,owner,{seasonId:later.id})).status).toBe(200);
 const history=await fetch(`${base}${path}`).then(r=>r.json());expect(history.seasons.map((s:{number:number})=>s.number)).toEqual([0,2]);
 expect(history).not.toHaveProperty('candidates');
 expect(await fetch(`${base}/api/projects/${project.id}/membership`,{headers:{cookie:owner}}).then(r=>r.json())).toEqual(teamBefore);
 expect(await fetch(`${base}/api/activities/${project.id}/tasks`,{headers:{cookie:owner}}).then(r=>r.json())).toEqual(tasksBefore);
 expect((await fetch(`${base}/api/projects/${project.id}`).then(r=>r.json())).project).toMatchObject({id:project.id,status:'PLANNING'});
 for(const season of [first,later]){
  const view=await fetch(`${base}/api/seasons/${season.id}`).then(r=>r.json());expect(view.activities).toEqual([{id:project.id,type:'PROJECT',title:'Persistent project',description:'Public notes',status:'PLANNING'}]);
 }
 const event=(await write('/api/events',owner,{title:'Build night',description:'Open to all',category:'BUILD_NIGHT'}).then(r=>r.json())).event;
 expect((await write(`/api/activities/${event.id}/seasons`,owner,{seasonId:later.id})).status).toBe(200);
 expect((await fetch(`${base}/api/activities/recent`).then(r=>r.json())).activities).toContainEqual({id:event.id,type:'EVENT',title:'Build night',description:'Open to all',status:'PLANNING'});
});
test('Ops publish and edit Seasons; drafts stay private, invalid dates and competing active Seasons are rejected',async()=>{
 const ops=await member(true);const user=await member();
 expect((await write('/api/ops/seasons',user,seasonInput)).status).toBe(403);
 expect((await write('/api/ops/seasons','',seasonInput)).status).toBe(401);
 expect((await write('/api/ops/seasons',ops,{...seasonInput,endsOn:'2026-01-01'})).status).toBe(400);
 const created=await write('/api/ops/seasons',ops,seasonInput);expect(created.status).toBe(201);const id=(await created.json()).season.id;
 expect((await fetch(`${base}/api/seasons`).then(r=>r.json())).seasons).toEqual([]);
 expect((await fetch(`${base}/api/seasons/${id}`)).status).toBe(404);
 expect((await fetch(`${base}/api/ops/seasons`,{headers:{cookie:ops}}).then(r=>r.json())).seasons).toHaveLength(1);
 expect((await write(`/api/ops/seasons/${id}`,ops,{...seasonInput,status:'ACTIVE'},'PATCH')).status).toBe(200);
 expect((await fetch(`${base}/api/seasons/current`).then(r=>r.json())).season).toMatchObject({id,status:'ACTIVE'});
 expect((await write('/api/ops/seasons',ops,{...seasonInput,number:1,status:'ACTIVE'})).status).toBe(409);
 expect((await write(`/api/ops/seasons/${id}`,ops,{...seasonInput,status:'FINISHED'},'PATCH')).status).toBe(200);
 expect((await fetch(`${base}/api/seasons/current`).then(r=>r.json())).season).toBeNull();
 expect((await fetch(`${base}/api/seasons/${id}`).then(r=>r.json())).season.status).toBe('FINISHED');
});
test('Season links reject unpublished or finished targets and closed Activities; concurrent activation has one winner',async()=>{
 const ops=await member(true);const owner=await member();
 const draft=(await write('/api/ops/seasons',ops,seasonInput).then(r=>r.json())).season;
 const otherInput={...seasonInput,number:1};const other=(await write('/api/ops/seasons',ops,otherInput).then(r=>r.json())).season;
 const project=(await write('/api/projects',owner,{title:'Unassigned',goal:'Independent',description:'No season required'}).then(r=>r.json())).project;
 const path=`/api/activities/${project.id}/seasons`;
 expect((await write(path,owner,{seasonId:draft.id})).status).toBe(409);
 expect((await write(path,'',{seasonId:draft.id})).status).toBe(401);
 const attempts=await Promise.all([write(`/api/ops/seasons/${draft.id}`,ops,{...seasonInput,status:'ACTIVE'},'PATCH'),write(`/api/ops/seasons/${other.id}`,ops,{...otherInput,status:'ACTIVE'},'PATCH')]);
 expect(attempts.map(r=>r.status).sort()).toEqual([200,409]);
 const current=(await fetch(`${base}/api/seasons/current`).then(r=>r.json())).season;
 await write(`/api/activities/${project.id}/close`,owner,{status:'COMPLETED'});
 expect((await write(path,owner,{seasonId:current.id})).status).toBe(409);
 expect((await fetch(`${base}/api/activities/recent`).then(r=>r.json())).activities).not.toContainEqual(expect.objectContaining({id:project.id}));
});

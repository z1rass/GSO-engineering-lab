import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createApp } from '../src/app.js';
import { requestTestLink, redeemTestLink, ownershipInvitationToken } from './helpers/magic-link.js';
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
test('Ownership changes only when the named Member accepts; editing and leave follow the new owner for both Activity types',async()=>{
 const owner=await member();const successor=await member();const stranger=await member();
 const successorId=(await fetch(`${base}/api/me`,{headers:{cookie:successor.cookie}}).then(r=>r.json())).user.id;
 for(const type of ['projects','events']){
  const id=await activity(owner.cookie,type);const path=`/api/activities/${id}/ownership`;
  const detail=(cookie:string)=>fetch(`${base}/api/${type}/${id}`,{headers:{cookie}}).then(r=>r.json()).then(b=>b[type==='projects'?'project':'event']);
  const before=await detail(owner.cookie);
  const oldTask=(await write(`/api/activities/${id}/tasks`,owner.cookie,{title:'Existing responsibility'}).then(r=>r.json())).task;
  await write(`/api/tasks/${oldTask.id}/take`,owner.cookie,{});
  const proposed=await write(path,owner.cookie,{email:successor.email});expect(proposed.status).toBe(201);
  const token=await ownershipInvitationToken(successor.email);
  expect((await detail(successor.cookie))).toMatchObject({owner:before.owner,canEdit:false});
  expect((await write(`/api/ownership-invitations/${token}/accept`,stranger.cookie,{})).status).toBe(404);
  expect(await fetch(`${base}/api/ownership-invitations/${token}`,{headers:{cookie:successor.cookie}}).then(r=>r.json())).toMatchObject({invitation:{activityId:id}});
  const attempts=await Promise.all([write(`/api/ownership-invitations/${token}/accept`,successor.cookie,{}),write(`/api/ownership-invitations/${token}/accept`,successor.cookie,{})]);
  expect(attempts.map(r=>r.status).sort()).toEqual([200,409]);
  expect(await detail(successor.cookie)).toMatchObject({owner:{id:successorId},canEdit:true});
  expect(await detail(owner.cookie)).toMatchObject({owner:{id:successorId},canEdit:false});
  const tasks=await fetch(`${base}/api/activities/${id}/tasks`,{headers:{cookie:successor.cookie}}).then(r=>r.json());
  expect(tasks.tasks[0]).toMatchObject({owner:before.owner,status:'IN_PROGRESS'});
  const participation=await fetch(`${base}/api/${type}/${id}/${type==='projects'?'membership':'going'}`).then(r=>r.json());
  expect(participation.count).toBe(0);
  expect((await write(`/api/activities/${id}/tasks`,owner.cookie,{title:'Old rights'})).status).toBe(403);
  expect((await write(`/api/activities/${id}/tasks`,successor.cookie,{title:'New rights'})).status).toBe(201);
  const input=type==='projects'?{title:'Updated',goal:'Build',description:'Together'}:{title:'Updated',description:'Together',category:'WORKSHOP'};
  expect((await write(`/api/${type}/${id}`,owner.cookie,input,'PATCH')).status).toBe(403);
  expect((await write(`/api/${type}/${id}`,successor.cookie,input,'PATCH')).status).toBe(200);
  if(type==='projects'){
   expect((await write(`/api/projects/${id}/membership`,successor.cookie,{},'DELETE')).status).toBe(409);
   expect((await write(`/api/projects/${id}/membership`,owner.cookie,{},'DELETE')).status).toBe(200);
  }
 }
});
test('Only owner proposes; Ops or recipient can cancel, stale acceptance cannot consume a replacement, and private data stays private',async()=>{
 const owner=await member();const successor=await member();const other=await member();const ops=await member();
 await pool.query("UPDATE users SET role='OPS' WHERE email=$1",[ops.email]);
 const successorId=(await fetch(`${base}/api/me`,{headers:{cookie:successor.cookie}}).then(r=>r.json())).user.id;
 const id=await activity(owner.cookie);const path=`/api/activities/${id}/ownership`;
 expect((await write(path,other.cookie,{email:successor.email})).status).toBe(403);
 expect((await write(path,ops.cookie,{email:successor.email})).status).toBe(403);
 expect((await fetch(`${base}${path}`)).status).toBe(401);
 const state=await fetch(`${base}${path}`,{headers:{cookie:owner.cookie}});expect(state.headers.get('cache-control')).toBe('no-store');
 const ownerState=await state.json();expect(ownerState.canPropose).toBe(true);
 expect(JSON.stringify(ownerState)).not.toContain(successor.email);
 const first=(await write(path,owner.cookie,{email:successor.email}).then(r=>r.json())).transfer;
 const firstToken=await ownershipInvitationToken(successor.email);
 expect((await write(path,owner.cookie,{email:successor.email})).status).toBe(409);
 expect((await fetch(`${base}${path}`,{headers:{cookie:other.cookie}}).then(r=>r.json()))).toEqual({pending:null,canPropose:false});
 expect((await write(`${path}/cancel`,other.cookie,{transferId:first.id})).status).toBe(403);
 expect((await write(`${path}/cancel`,ops.cookie,{transferId:first.id})).status).toBe(200);
 const second=(await write(path,owner.cookie,{email:successor.email}).then(r=>r.json())).transfer;
 expect((await write(`/api/ownership-invitations/${firstToken}/accept`,successor.cookie,{})).status).toBe(409);
 const pending=(await fetch(`${base}${path}`,{headers:{cookie:successor.cookie}}).then(r=>r.json())).pending;
 expect(pending).toMatchObject({id:second.id,recipient:{id:successorId},canCancel:true});
 expect((await write(`${path}/cancel`,successor.cookie,{transferId:second.id})).status).toBe(200);
 expect((await fetch(`${base}/api/ownership-invitations/${firstToken}`,{headers:{cookie:successor.cookie}})).status).toBe(410);
});
test('Transfers reject self, Alumni, unverified recipients, closed Activities and unauthenticated or cross-origin actions',async()=>{
 const owner=await member();const successor=await member();
 const me=(cookie:string)=>fetch(`${base}/api/me`,{headers:{cookie}}).then(r=>r.json()).then(b=>b.user.id);
 const ownerId=await me(owner.cookie);const recipientId=await me(successor.cookie);
 const id=await activity(owner.cookie);const path=`/api/activities/${id}/ownership`;
 expect((await write(path,'',{email:successor.email})).status).toBe(401);
 expect((await write(path,owner.cookie,{email:successor.email},'POST','https://other.example')).status).toBe(403);
 expect((await write(path,owner.cookie,{email:owner.email})).status).toBe(400);
 expect((await write(path,owner.cookie,{email:successor.email,ownerId})).status).toBe(400);
 await pool.query("UPDATE users SET affiliation='ALUMNI' WHERE id=$1",[recipientId]);
 expect((await write(path,owner.cookie,{email:successor.email})).status).toBe(400);
 await pool.query("UPDATE users SET affiliation='MEMBER',email_verified=false WHERE id=$1",[recipientId]);
 expect((await write(path,owner.cookie,{email:successor.email})).status).toBe(400);
 await pool.query('UPDATE users SET email_verified=true WHERE id=$1',[recipientId]);
 const transfer=(await write(path,owner.cookie,{email:successor.email}).then(r=>r.json())).transfer;
 const token=await ownershipInvitationToken(successor.email);
 await pool.query("UPDATE users SET affiliation='ALUMNI' WHERE id=$1",[recipientId]);
 expect((await write(`/api/ownership-invitations/${token}/accept`,successor.cookie,{})).status).toBe(401);
 await pool.query("UPDATE users SET affiliation='MEMBER' WHERE id=$1",[recipientId]);
 await pool.query("UPDATE activities SET status='COMPLETED' WHERE id=$1",[id]);
 expect((await write(`/api/ownership-invitations/${token}/accept`,successor.cookie,{})).status).toBe(409);
 expect((await write(`${path}/cancel`,owner.cookie,{transferId:transfer.id})).status).toBe(200);
 expect((await write(path,owner.cookie,{email:successor.email})).status).toBe(409);
});
test('Expired email invitation cannot transfer ownership or expose its raw token in storage',async()=>{
 const owner=await member();const recipient=await member();
 const id=await activity(owner.cookie);const path=`/api/activities/${id}/ownership`;
 const transfer=(await write(path,owner.cookie,{email:recipient.email}).then(r=>r.json())).transfer;
 const token=await ownershipInvitationToken(recipient.email);
 const stored=(await pool.query('SELECT token_hash FROM ownership_transfers WHERE id=$1',[transfer.id])).rows[0].token_hash;
 expect(stored).not.toBe(token);
 await pool.query("UPDATE ownership_transfers SET expires_at=NOW()-INTERVAL '1 minute' WHERE id=$1",[transfer.id]);
 expect((await fetch(`${base}/api/ownership-invitations/${token}`,{headers:{cookie:recipient.cookie}})).status).toBe(410);
 expect((await write(`/api/ownership-invitations/${token}/accept`,recipient.cookie,{})).status).toBe(409);
 expect((await fetch(`${base}/api/projects/${id}`,{headers:{cookie:owner.cookie}}).then(r=>r.json())).project.canEdit).toBe(true);
});

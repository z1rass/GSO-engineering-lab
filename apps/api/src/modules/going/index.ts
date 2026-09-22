import {registrationReady} from './readiness.js';
import type {Express,Request,RequestHandler} from 'express';
import type {Pool} from 'pg';
import {z} from 'zod';
const idSchema=z.coerce.number().int().positive().max(2147483647);
export function mountGoing(app:Express,pool:Pool,requireMember:RequestHandler,getMember:(request:Request)=>Promise<{id:string}|null>){
 app.get('/api/events/:id/going',async(request,response)=>{
  const id=idSchema.safeParse(request.params.id);if(!id.success){response.status(404).json({error:'NOT_FOUND'});return;}
  const event=await pool.query("SELECT status,owner_id FROM activities WHERE id=$1 AND type='EVENT'",[id.data]);
  if(!event.rows[0]){response.status(404).json({error:'NOT_FOUND'});return;}
  const viewer=await getMember(request);
  const people=await pool.query('SELECT u.id,u.name FROM event_going g JOIN users u ON u.id=g.user_id WHERE g.event_id=$1 ORDER BY u.name,u.id',[id.data]);
  const data={open:event.rows[0].status==='ACTIVE' && await registrationReady(pool,id.data),count:people.rowCount};
  response.json(viewer?{...data,going:people.rows.some(p=>p.id===viewer.id),isOwner:event.rows[0].owner_id===viewer.id,canOpen:['PLANNING','ACTIVE'].includes(event.rows[0].status)&&await registrationReady(pool,id.data),participants:people.rows}:data);
 });
 for(const action of ['open','join','leave'] as const){
  const method=action==='leave'?'delete':'post';const suffix=action==='open'?'open':'going';
  app[method](`/api/events/:id/${suffix}`,requireMember,async(request,response)=>{
   const id=idSchema.safeParse(request.params.id);if(!id.success){response.status(404).json({error:'NOT_FOUND'});return;}
   if(!z.object({}).strict().safeParse(request.body??{}).success){response.status(400).json({error:'INVALID_GOING'});return;}
   const client=await pool.connect();
   try{
    await client.query('BEGIN');
    const result=await client.query("SELECT status,owner_id FROM activities WHERE id=$1 AND type='EVENT' FOR UPDATE",[id.data]);const event=result.rows[0];
    if(!event){await client.query('ROLLBACK');response.status(404).json({error:'NOT_FOUND'});return;}
    if(action==='open'){
     if(event.owner_id!==response.locals.userId){await client.query('ROLLBACK');response.status(403).json({error:'OWNER_REQUIRED'});return;}
     if(!['PLANNING','ACTIVE'].includes(event.status)){await client.query('ROLLBACK');response.status(409).json({error:'EVENT_CLOSED'});return;}
     if(!(await registrationReady(client,id.data))){await client.query('ROLLBACK');response.status(409).json({error:'CONDITIONS_NOT_READY'});return;}
     await client.query("UPDATE activities SET status='ACTIVE',updated_at=NOW() WHERE id=$1",[id.data]);
    }else if(action==='join'){
     if(event.status!=='ACTIVE'||!(await registrationReady(client,id.data))){await client.query('ROLLBACK');response.status(409).json({error:'REGISTRATION_CLOSED'});return;}
     await client.query('INSERT INTO event_going(event_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[id.data,response.locals.userId]);
    }else await client.query('DELETE FROM event_going WHERE event_id=$1 AND user_id=$2',[id.data,response.locals.userId]);
    await client.query('COMMIT');response.json({saved:true});
   }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  });
 }
}

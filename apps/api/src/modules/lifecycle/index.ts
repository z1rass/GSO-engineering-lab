import type {Express,RequestHandler} from 'express';
import type {Pool} from 'pg';
import {z} from 'zod';
const idSchema=z.coerce.number().int().positive().max(2147483647);
const closeSchema=z.object({status:z.enum(['COMPLETED','CANCELLED']),confirmUnfinished:z.boolean().default(false)}).strict();
export function mountLifecycle(app:Express,pool:Pool,requireMember:RequestHandler){
 app.post('/api/activities/:id/close',requireMember,async(request,response)=>{
  const id=idSchema.safeParse(request.params.id);const input=closeSchema.safeParse(request.body);
  if(!id.success){response.status(404).json({error:'NOT_FOUND'});return;}
  if(!input.success){response.status(400).json({error:'INVALID_CLOSURE'});return;}
  const client=await pool.connect();try{
   await client.query('BEGIN');
   const activity=(await client.query('SELECT owner_id,status FROM activities WHERE id=$1 FOR UPDATE',[id.data])).rows[0];
   if(!activity){await client.query('ROLLBACK');response.status(404).json({error:'NOT_FOUND'});return;}
   if(activity.owner_id!==response.locals.userId){await client.query('ROLLBACK');response.status(403).json({error:'OWNER_REQUIRED'});return;}
   if(!['PLANNING','ACTIVE'].includes(activity.status)){await client.query('ROLLBACK');response.status(409).json({error:'ACTIVITY_CLOSED'});return;}
   const unfinished=(await client.query("SELECT count(*)::int AS count FROM tasks WHERE activity_id=$1 AND status IN ('OPEN','IN_PROGRESS')",[id.data])).rows[0].count;
   if(unfinished&&!input.data.confirmUnfinished){await client.query('ROLLBACK');response.status(409).json({error:'CONFIRM_UNFINISHED_TASKS',unfinishedCount:unfinished});return;}
   await client.query("UPDATE tasks SET status='CANCELLED',updated_at=NOW() WHERE activity_id=$1 AND status IN ('OPEN','IN_PROGRESS')",[id.data]);
   await client.query("UPDATE ownership_transfers SET status='CANCELLED',resolved_at=NOW() WHERE activity_id=$1 AND status='PENDING'",[id.data]);
   await client.query('UPDATE activities SET status=$2,updated_at=NOW() WHERE id=$1',[id.data,input.data.status]);
   await client.query('COMMIT');response.json({saved:true});
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 });
}

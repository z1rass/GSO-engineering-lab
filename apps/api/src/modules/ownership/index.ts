import type {Express,RequestHandler} from 'express';
import type {Pool} from 'pg';
import {z} from 'zod';
const idSchema=z.coerce.number().int().positive().max(2147483647);
const proposal=z.object({recipientId:z.string().min(1).max(200)}).strict();
const decision=z.object({transferId:z.number().int().positive().max(2147483647)}).strict();
export function mountOwnership(app:Express,pool:Pool,requireMember:RequestHandler){
 const path='/api/activities/:id/ownership';
 app.get(path,requireMember,async(request,response)=>{
  const id=idSchema.safeParse(request.params.id);if(!id.success){response.status(404).json({error:'NOT_FOUND'});return;}
  const activity=(await pool.query("SELECT owner_id,status,EXISTS(SELECT 1 FROM users WHERE id=$2 AND role='OPS') AS ops FROM activities WHERE id=$1",[id.data,response.locals.userId])).rows[0];
  if(!activity){response.status(404).json({error:'NOT_FOUND'});return;}
  const active=['PLANNING','ACTIVE'].includes(activity.status);
  const isOwner=activity.owner_id===response.locals.userId;
  const pending=(await pool.query(`SELECT t.id,json_build_object('id',u.id,'name',u.name) AS recipient,
   json_build_object('id',o.id,'name',o.name) AS "fromOwner",($3 AND t.recipient_id=$2) AS "canAccept",true AS "canCancel"
   FROM ownership_transfers t JOIN users u ON u.id=t.recipient_id JOIN users o ON o.id=t.from_owner_id
   WHERE t.activity_id=$1 AND t.status='PENDING' AND ($4 OR t.recipient_id=$2)`,[id.data,response.locals.userId,active,isOwner||activity.ops])).rows[0]??null;
  const candidates=isOwner&&active?(await pool.query("SELECT id,name,education,year FROM users WHERE affiliation='MEMBER' AND email_verified=true AND id<>$1 ORDER BY name,id",[activity.owner_id])).rows:[];
  response.json({pending,canPropose:isOwner&&active,candidates});
 });
 for(const action of ['propose','accept','cancel'] as const){
  app.post(action==='propose'?path:`${path}/${action}`,requireMember,async(request,response)=>{
   const id=idSchema.safeParse(request.params.id);const input=action==='propose'?proposal.safeParse(request.body):decision.safeParse(request.body);
   if(!id.success){response.status(404).json({error:'NOT_FOUND'});return;}
   if(!input.success){response.status(400).json({error:'INVALID_TRANSFER'});return;}
   const client=await pool.connect();try{
    await client.query('BEGIN');
    const activity=(await client.query("SELECT owner_id,status,EXISTS(SELECT 1 FROM users WHERE id=$2 AND role='OPS') AS ops FROM activities WHERE id=$1 FOR UPDATE",[id.data,response.locals.userId])).rows[0];
    if(!activity){await client.query('ROLLBACK');response.status(404).json({error:'NOT_FOUND'});return;}
    if(action!=='cancel'&&!['PLANNING','ACTIVE'].includes(activity.status)){await client.query('ROLLBACK');response.status(409).json({error:'ACTIVITY_CLOSED'});return;}
    if(action==='propose'){
     if(activity.owner_id!==response.locals.userId){await client.query('ROLLBACK');response.status(403).json({error:'OWNER_REQUIRED'});return;}
     const {recipientId}=proposal.parse(request.body);
     const recipient=await client.query("SELECT id FROM users WHERE id=$1 AND affiliation='MEMBER' AND email_verified=true FOR SHARE",[recipientId]);
     if(!recipient.rowCount||recipientId===activity.owner_id){await client.query('ROLLBACK');response.status(400).json({error:'INVALID_RECIPIENT'});return;}
     const pending=await client.query("SELECT id FROM ownership_transfers WHERE activity_id=$1 AND status='PENDING'",[id.data]);
     if(pending.rowCount){await client.query('ROLLBACK');response.status(409).json({error:'TRANSFER_PENDING'});return;}
     const created=await client.query('INSERT INTO ownership_transfers(activity_id,from_owner_id,recipient_id) VALUES($1,$2,$3) RETURNING id',[id.data,activity.owner_id,recipientId]);
     await client.query('COMMIT');response.status(201).json({transfer:{id:created.rows[0].id}});
    }else{
     const {transferId}=decision.parse(request.body);
     const transfer=(await client.query("SELECT * FROM ownership_transfers WHERE id=$1 AND activity_id=$2 AND status='PENDING' FOR UPDATE",[transferId,id.data])).rows[0];
     if(!transfer||transfer.from_owner_id!==activity.owner_id){await client.query('ROLLBACK');response.status(409).json({error:'TRANSFER_CHANGED'});return;}
     if(action==='cancel'){
      if(activity.owner_id!==response.locals.userId&&transfer.recipient_id!==response.locals.userId&&!activity.ops){await client.query('ROLLBACK');response.status(403).json({error:'TRANSFER_MANAGER_REQUIRED'});return;}
      await client.query("UPDATE ownership_transfers SET status='CANCELLED',resolved_at=NOW() WHERE id=$1",[transferId]);
      await client.query('COMMIT');response.json({saved:true});return;
     }
     if(transfer.recipient_id!==response.locals.userId){await client.query('ROLLBACK');response.status(403).json({error:'RECIPIENT_REQUIRED'});return;}
     const eligible=await client.query("SELECT id FROM users WHERE id=$1 AND affiliation='MEMBER' AND email_verified=true FOR SHARE",[response.locals.userId]);
     if(!eligible.rowCount){await client.query('ROLLBACK');response.status(403).json({error:'MEMBER_REQUIRED'});return;}
     await client.query('UPDATE activities SET owner_id=$2,updated_at=NOW() WHERE id=$1',[id.data,transfer.recipient_id]);
     await client.query("UPDATE ownership_transfers SET status='ACCEPTED',resolved_at=NOW() WHERE id=$1",[transferId]);
     await client.query('COMMIT');response.json({saved:true});
    }
   }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  });
 }
}

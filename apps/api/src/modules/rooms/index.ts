import type { Express, Request, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';

const idSchema=z.coerce.number().int().positive().max(2147483647);
const requestSchema=z.object({note:z.string().trim().min(1).max(3000)}).strict();
const answerSchema=z.object({status:z.enum(['ALTERNATIVE','CONFIRMED']),date:z.iso.date(),endDate:z.iso.date().nullable().default(null),
  startTime:z.iso.time({precision:-1}),endTime:z.iso.time({precision:-1}),room:z.string().trim().min(1).max(300),message:z.string().trim().max(3000).default(''),
}).strict().refine(value=>(!value.endDate || value.endDate>=value.date) && (value.endDate && value.endDate>value.date || value.endTime>value.startTime));
const fields=`r.id,r.activity_id AS "activityId",r.status,r.note,r.date::text AS date,r.end_date::text AS "endDate",r.start_time AS "startTime",r.end_time AS "endTime",r.room,r.message`;
export function mountRooms(app:Express,pool:Pool,requireMember:RequestHandler,getMember:(request:Request)=>Promise<{id:string}|null>) {
  const path='/api/activities/:id/room-request';
  app.get(path,async(request,response)=>{
    response.set('Cache-Control','no-store');
    const id=idSchema.safeParse(request.params.id);
    if(!id.success){response.status(404).json({error:'NOT_FOUND'});return;}
    const activity=await pool.query('SELECT owner_id FROM activities WHERE id=$1',[id.data]);
    if(!activity.rows[0]){response.status(404).json({error:'NOT_FOUND'});return;}
    const result=await pool.query(`SELECT ${fields} FROM room_requests r WHERE r.activity_id=$1`,[id.data]);
    const room=result.rows[0]; const member=await getMember(request);
    if(!member){response.json({request:room?{status:room.status}:null});return;}
    const ops=await pool.query("SELECT id FROM users WHERE id=$1 AND role='OPS'",[member.id]);
    const owner=activity.rows[0].owner_id===member.id;
    const canRespond=Boolean(ops.rowCount);
    const details=owner||canRespond ? room : room?.status==='CONFIRMED' ? {status:room.status,date:room.date,endDate:room.endDate,startTime:room.startTime,endTime:room.endTime,room:room.room} : room?{status:room.status}:null;
    response.json({request:details??null,canRequest:owner,canRespond});
  });
  app.post(path,requireMember,async(request,response)=>{
    const id=idSchema.safeParse(request.params.id);const input=requestSchema.safeParse(request.body);
    if(!id.success){response.status(404).json({error:'NOT_FOUND'});return;}
    if(!input.success){response.status(400).json({error:'INVALID_REQUEST'});return;}
    const activity=await pool.query('SELECT owner_id FROM activities WHERE id=$1',[id.data]);
    if(!activity.rows[0]){response.status(404).json({error:'NOT_FOUND'});return;}
    if(activity.rows[0].owner_id!==response.locals.userId){response.status(403).json({error:'OWNER_REQUIRED'});return;}
    const created=await pool.query('INSERT INTO room_requests(activity_id,note) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id',[id.data,input.data.note]);
    if(!created.rowCount){response.status(409).json({error:'REQUEST_EXISTS'});return;}
    response.status(201).json({saved:true});
  });
  // /api/ops middleware enforces current Member and Ops role before these routes.
  app.get('/api/ops/room-requests',async(_request,response)=>{
    const result=await pool.query(`SELECT ${fields},a.title,a.type FROM room_requests r JOIN activities a ON a.id=r.activity_id ORDER BY (r.status='CONFIRMED'),r.created_at,r.id`);
    response.json({requests:result.rows});
  });
  app.patch('/api/ops/room-requests/:id',async(request,response)=>{
    const id=idSchema.safeParse(request.params.id);const input=answerSchema.safeParse(request.body);
    if(!id.success){response.status(404).json({error:'NOT_FOUND'});return;}
    if(!input.success){response.status(400).json({error:'INVALID_RESPONSE'});return;}
    const v=input.data;
    const result=await pool.query(`UPDATE room_requests SET status=$2,date=$3,end_date=$4,start_time=$5,end_time=$6,room=$7,message=$8,updated_at=NOW() WHERE id=$1 AND status<>'CONFIRMED' RETURNING id`,[id.data,v.status,v.date,v.endDate,v.startTime,v.endTime,v.room,v.message]);
    if(!result.rowCount){const exists=await pool.query('SELECT id FROM room_requests WHERE id=$1',[id.data]);response.status(exists.rowCount?409:404).json({error:exists.rowCount?'CONFIRMATION_FINAL':'NOT_FOUND'});return;}
    response.json({saved:true});
  });
}

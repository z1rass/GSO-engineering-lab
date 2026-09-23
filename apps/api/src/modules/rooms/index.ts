import type { Express, Request, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { registrationReady } from '../going/readiness.js';

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
    const activity=await pool.query('SELECT owner_id,status FROM activities WHERE id=$1',[id.data]);
    if(!activity.rows[0]){response.status(404).json({error:'NOT_FOUND'});return;}
    const result=await pool.query(`SELECT ${fields} FROM room_requests r WHERE r.activity_id=$1`,[id.data]);
    const room=result.rows[0]; const member=await getMember(request);
    if(!member){response.json({request:room?{status:room.status}:null});return;}
    const ops=await pool.query("SELECT id FROM users WHERE id=$1 AND role='OPS'",[member.id]);
    const owner=activity.rows[0].owner_id===member.id;
    const canRespond=Boolean(ops.rowCount);
    const details=owner||canRespond ? room : room?.status==='CONFIRMED' ? {status:room.status,date:room.date,endDate:room.endDate,startTime:room.startTime,endTime:room.endTime,room:room.room} : room?{status:room.status}:null;
    const event=await pool.query('SELECT place_type,planned_date::text AS date,end_date::text AS "endDate",start_time AS "startTime",end_time AS "endTime" FROM event_details WHERE activity_id=$1',[id.data]);
    const offerAccepted=room?.status==='ALTERNATIVE'&&event.rows[0]&&event.rows[0].date===room.date&&event.rows[0].endDate===room.endDate&&event.rows[0].startTime===room.startTime&&event.rows[0].endTime===room.endTime;
    response.json({request:details??null,canRequest:Boolean(owner&&['PLANNING','ACTIVE'].includes(activity.rows[0].status)&&(!event.rowCount||event.rows[0].place_type==='SCHOOL'&&event.rows[0].date&&event.rows[0].startTime&&event.rows[0].endTime)),canRespond:canRespond&&['PLANNING','ACTIVE'].includes(activity.rows[0].status),...(owner&&event.rowCount?{canAccept:event.rows[0]?.place_type==='SCHOOL'&&room?.status==='ALTERNATIVE'&&!offerAccepted,offerAccepted:Boolean(offerAccepted)}:{})});
  });
  app.post(path,requireMember,async(request,response)=>{
    const id=idSchema.safeParse(request.params.id);const input=requestSchema.safeParse(request.body);
    if(!id.success){response.status(404).json({error:'NOT_FOUND'});return;}
    if(!input.success){response.status(400).json({error:'INVALID_REQUEST'});return;}
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      const activity=await client.query('SELECT owner_id,status FROM activities WHERE id=$1 FOR UPDATE',[id.data]);
      if(!activity.rows[0]){await client.query('ROLLBACK');response.status(404).json({error:'NOT_FOUND'});return;}
      if(activity.rows[0].owner_id!==response.locals.userId){await client.query('ROLLBACK');response.status(403).json({error:'OWNER_REQUIRED'});return;}
      if(!['PLANNING','ACTIVE'].includes(activity.rows[0].status)){await client.query('ROLLBACK');response.status(409).json({error:'ACTIVITY_CLOSED'});return;}
      const event=await client.query('SELECT place_type,planned_date,start_time,end_time FROM event_details WHERE activity_id=$1',[id.data]);
      if(event.rowCount&&(event.rows[0].place_type!=='SCHOOL'||!event.rows[0].planned_date||!event.rows[0].start_time||!event.rows[0].end_time)){await client.query('ROLLBACK');response.status(409).json({error:'ROOM_PLAN_INCOMPLETE'});return;}
      const created=await client.query('INSERT INTO room_requests(activity_id,note) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id',[id.data,input.data.note]);
      if(!created.rowCount){await client.query('ROLLBACK');response.status(409).json({error:'REQUEST_EXISTS'});return;}
      await client.query("UPDATE activities SET status='PLANNING',updated_at=NOW() WHERE id=$1 AND type='EVENT' AND status='ACTIVE'",[id.data]);
      await client.query('COMMIT');response.status(201).json({saved:true});
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  });
  app.post('/api/activities/:id/room-request/accept',requireMember,async(request,response)=>{
    const id=idSchema.safeParse(request.params.id);
    if(!id.success){response.status(404).json({error:'NOT_FOUND'});return;}
    if(!z.object({}).strict().safeParse(request.body).success){response.status(400).json({error:'INVALID_REQUEST'});return;}
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      const activity=await client.query("SELECT a.owner_id,a.status,p.place_type FROM activities a JOIN event_details p ON p.activity_id=a.id WHERE a.id=$1 FOR UPDATE OF a",[id.data]);
      if(!activity.rowCount){await client.query('ROLLBACK');response.status(404).json({error:'NOT_FOUND'});return;}
      if(activity.rows[0].owner_id!==response.locals.userId){await client.query('ROLLBACK');response.status(403).json({error:'OWNER_REQUIRED'});return;}
      if(!['PLANNING','ACTIVE'].includes(activity.rows[0].status)||activity.rows[0].place_type!=='SCHOOL'){await client.query('ROLLBACK');response.status(409).json({error:'INVALID_TRANSITION'});return;}
      const offer=await client.query("SELECT date::text AS date,end_date::text AS \"endDate\",start_time AS \"startTime\",end_time AS \"endTime\" FROM room_requests WHERE activity_id=$1 AND status='ALTERNATIVE' FOR UPDATE",[id.data]);
      if(!offer.rowCount){await client.query('ROLLBACK');response.status(409).json({error:'NO_ALTERNATIVE'});return;}
      const v=offer.rows[0];
      const changed=await client.query(`UPDATE event_details SET planned_date=$2,end_date=$3,start_time=$4,end_time=$5 WHERE activity_id=$1
        AND (planned_date,start_time,coalesce(end_date,planned_date),end_time) IS DISTINCT FROM ($2::date,$4::text,coalesce($3::date,$2::date),$5::text) RETURNING activity_id`,[id.data,v.date,v.endDate,v.startTime,v.endTime]);
      if(changed.rowCount){
        await client.query('INSERT INTO activity_interests(activity_id,user_id) SELECT event_id,user_id FROM event_going WHERE event_id=$1 ON CONFLICT DO NOTHING',[id.data]);
        await client.query('DELETE FROM event_going WHERE event_id=$1',[id.data]);
        await client.query("UPDATE activities SET status='PLANNING',updated_at=NOW() WHERE id=$1",[id.data]);
      }
      await client.query('COMMIT');response.json({saved:true});
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  });
  // /api/ops middleware enforces current Member and Ops role before these routes.
  app.get('/api/ops/room-requests',async(_request,response)=>{
    const result=await pool.query(`SELECT ${fields},a.title,a.type FROM room_requests r JOIN activities a ON a.id=r.activity_id WHERE a.status IN ('PLANNING','ACTIVE') ORDER BY (r.status='CONFIRMED'),r.created_at,r.id`);
    response.json({requests:result.rows});
  });
  app.patch('/api/ops/room-requests/:id',async(request,response)=>{
    const id=idSchema.safeParse(request.params.id);const input=answerSchema.safeParse(request.body);
    if(!id.success){response.status(404).json({error:'NOT_FOUND'});return;}
    if(!input.success){response.status(400).json({error:'INVALID_RESPONSE'});return;}
    const v=input.data;const client=await pool.connect();try{
      await client.query('BEGIN');
      const activity=(await client.query('SELECT a.status,a.id,a.type,p.planned_date::text AS planned_date,p.start_time,p.end_time,coalesce(p.end_date,p.planned_date)::text AS end_date FROM activities a JOIN room_requests r ON r.activity_id=a.id LEFT JOIN event_details p ON p.activity_id=a.id WHERE r.id=$1 FOR UPDATE OF a',[id.data])).rows[0];
      if(!activity){await client.query('ROLLBACK');response.status(404).json({error:'NOT_FOUND'});return;}
      if(!['PLANNING','ACTIVE'].includes(activity.status)){await client.query('ROLLBACK');response.status(409).json({error:'ACTIVITY_CLOSED'});return;}
      if(v.status==='CONFIRMED'&&activity.type==='EVENT'&&(!activity.planned_date||!activity.start_time||!activity.end_time||`${v.date}T${v.startTime}`>`${activity.planned_date}T${activity.start_time}`||`${v.endDate??v.date}T${v.endTime}`<`${activity.end_date}T${activity.end_time}`)){await client.query('ROLLBACK');response.status(409).json({error:'OWNER_MUST_ACCEPT_SCHEDULE'});return;}
      const result=await client.query(`UPDATE room_requests SET status=$2,date=$3,end_date=$4,start_time=$5,end_time=$6,room=$7,message=$8,updated_at=NOW() WHERE id=$1 AND status<>'CONFIRMED' RETURNING id`,[id.data,v.status,v.date,v.endDate,v.startTime,v.endTime,v.room,v.message]);
      if(!result.rowCount){await client.query('ROLLBACK');response.status(409).json({error:'CONFIRMATION_FINAL'});return;}
      if(v.status==='CONFIRMED'&&activity.type==='EVENT'){
        await client.query('UPDATE event_details SET exact_room=$2 WHERE activity_id=$1',[activity.id,v.room]);
        if(!(await registrationReady(client,activity.id))) await client.query("UPDATE activities SET status='PLANNING' WHERE id=$1 AND status='ACTIVE'",[activity.id]);
      }
      await client.query('COMMIT');response.json({saved:true});
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  });
}

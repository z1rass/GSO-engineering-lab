import type {Express,Request,RequestHandler} from 'express';
import type {Pool} from 'pg';
import {z} from 'zod';
const idSchema=z.coerce.number().int().positive().max(2147483647);
const content=z.object({number:z.number().int().min(0).max(2147483647),title:z.string().trim().min(1).max(120),description:z.string().trim().max(5000),startsOn:z.iso.date(),endsOn:z.iso.date(),status:z.enum(['DRAFT','UPCOMING','ACTIVE','FINISHED','ARCHIVED'])}).strict().refine(s=>s.endsOn>=s.startsOn);
const fields='id,number,title,description,starts_on::text AS "startsOn",ends_on::text AS "endsOn",status';
const activityFields='a.id,a.type,a.title,a.description,a.status';
export function mountSeasons(app:Express,pool:Pool,requireMember:RequestHandler,getMember:(request:Request)=>Promise<{id:string}|null>){
 app.get('/api/activities/recent',async(_request,response)=>{response.set('Cache-Control','no-store');response.json({activities:(await pool.query(`SELECT ${activityFields} FROM activities a WHERE status IN ('PLANNING','ACTIVE') ORDER BY created_at DESC,id DESC LIMIT 6`)).rows});});
 app.get('/api/seasons',async(_request,response)=>{response.set('Cache-Control','no-store');response.json({seasons:(await pool.query(`SELECT ${fields} FROM seasons WHERE status<>'DRAFT' ORDER BY number DESC`)).rows});});
 app.get('/api/seasons/:id',async(request,response)=>{
  response.set('Cache-Control','no-store');const id=idSchema.safeParse(request.params.id);if(!id.success){response.status(404).json({error:'NOT_FOUND'});return;}
  const season=(await pool.query(`SELECT ${fields} FROM seasons WHERE id=$1 AND status<>'DRAFT'`,[id.data])).rows[0];
  if(!season){response.status(404).json({error:'NOT_FOUND'});return;}
  const activities=(await pool.query(`SELECT ${activityFields} FROM activities a JOIN activity_seasons j ON j.activity_id=a.id WHERE j.season_id=$1 ORDER BY a.type,a.created_at DESC,a.id DESC`,[id.data])).rows;
  response.json({season,activities});
 });
 // Existing /api/ops middleware checks current Member and Ops role.
 app.get('/api/ops/seasons',async(_request,response)=>{response.json({seasons:(await pool.query(`SELECT ${fields} FROM seasons ORDER BY number DESC`)).rows});});
 for(const method of ['post','patch'] as const){
  app[method](method==='post'?'/api/ops/seasons':'/api/ops/seasons/:id',async(request:Request,response)=>{
   const input=content.safeParse(request.body);const id=method==='patch'?idSchema.safeParse(request.params.id):null;
   if(id&&!id.success){response.status(404).json({error:'NOT_FOUND'});return;}
   if(!input.success){response.status(400).json({error:'INVALID_SEASON'});return;}
   const s=input.data;try{
    const result=method==='post'?await pool.query(`INSERT INTO seasons(number,title,description,starts_on,ends_on,status) VALUES($1,$2,$3,$4,$5,$6) RETURNING ${fields}`,[s.number,s.title,s.description,s.startsOn,s.endsOn,s.status])
     :await pool.query(`UPDATE seasons SET number=$2,title=$3,description=$4,starts_on=$5,ends_on=$6,status=$7 WHERE id=$1 RETURNING ${fields}`,[id?.data,s.number,s.title,s.description,s.startsOn,s.endsOn,s.status]);
    if(!result.rowCount){response.status(404).json({error:'NOT_FOUND'});return;}response.status(method==='post'?201:200).json({season:result.rows[0]});
   }catch(error){if(error instanceof Error&&'code' in error&&error.code==='23505'){response.status(409).json({error:'SEASON_CONFLICT'});return;}throw error;}
  });
 }
 const path='/api/activities/:id/seasons';
 app.get(path,async(request,response)=>{
  response.set('Cache-Control','no-store');const id=idSchema.safeParse(request.params.id);if(!id.success){response.status(404).json({error:'NOT_FOUND'});return;}
  const activity=(await pool.query('SELECT owner_id,status,type FROM activities WHERE id=$1',[id.data])).rows[0];
  if(!activity){response.status(404).json({error:'NOT_FOUND'});return;}
  const history=(await pool.query(`SELECT s.id,s.number,s.title,s.status FROM seasons s JOIN activity_seasons j ON j.season_id=s.id WHERE j.activity_id=$1 AND s.status<>'DRAFT' ORDER BY s.number`,[id.data])).rows;
  const viewer=await getMember(request);if(!viewer){response.json({seasons:history});return;}
  const hasLink=(await pool.query('SELECT 1 FROM activity_seasons WHERE activity_id=$1 LIMIT 1',[id.data])).rowCount;
  const canAttach=activity.owner_id===viewer.id&&['PLANNING','ACTIVE'].includes(activity.status)&&(activity.type==='PROJECT'||!hasLink);
  const candidates=canAttach?(await pool.query("SELECT id,number,title,status FROM seasons WHERE status IN ('UPCOMING','ACTIVE') AND id NOT IN (SELECT season_id FROM activity_seasons WHERE activity_id=$1) ORDER BY number",[id.data])).rows:[];
  response.json({seasons:history,canAttach,candidates});
 });
 app.post(path,requireMember,async(request,response)=>{
  const id=idSchema.safeParse(request.params.id);const input=z.object({seasonId:z.number().int().positive().max(2147483647)}).strict().safeParse(request.body);
  if(!id.success){response.status(404).json({error:'NOT_FOUND'});return;}if(!input.success){response.status(400).json({error:'INVALID_SEASON'});return;}
  const client=await pool.connect();try{
   await client.query('BEGIN');
   const activity=(await client.query('SELECT owner_id,status,type FROM activities WHERE id=$1 FOR UPDATE',[id.data])).rows[0];
   if(!activity){await client.query('ROLLBACK');response.status(404).json({error:'NOT_FOUND'});return;}
   if(activity.owner_id!==response.locals.userId){await client.query('ROLLBACK');response.status(403).json({error:'OWNER_REQUIRED'});return;}
   if(!['PLANNING','ACTIVE'].includes(activity.status)){await client.query('ROLLBACK');response.status(409).json({error:'ACTIVITY_CLOSED'});return;}
   const season=await client.query("SELECT id FROM seasons WHERE id=$1 AND status IN ('UPCOMING','ACTIVE') FOR SHARE",[input.data.seasonId]);
   if(!season.rowCount){await client.query('ROLLBACK');response.status(409).json({error:'SEASON_UNAVAILABLE'});return;}
   if(activity.type==='EVENT'&&(await client.query('SELECT 1 FROM activity_seasons WHERE activity_id=$1 AND season_id<>$2',[id.data,input.data.seasonId])).rowCount){await client.query('ROLLBACK');response.status(409).json({error:'EVENT_ALREADY_ASSIGNED'});return;}
   await client.query('INSERT INTO activity_seasons(activity_id,season_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[id.data,input.data.seasonId]);
   await client.query('COMMIT');response.json({saved:true});
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 });
}

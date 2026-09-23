import type {Express,Request} from 'express';
import type {Pool} from 'pg';
import {z} from 'zod';
const idSchema=z.coerce.number().int().positive().max(2147483647);
const content=z.object({number:z.number().int().min(0).max(2147483647),title:z.string().trim().min(1).max(120),description:z.string().trim().max(5000),startsOn:z.iso.date(),endsOn:z.iso.date(),status:z.enum(['DRAFT','UPCOMING','ACTIVE','FINISHED','ARCHIVED'])}).strict().refine(s=>s.endsOn>=s.startsOn);
const fields='id,number,title,description,starts_on::text AS "startsOn",ends_on::text AS "endsOn",status';
const activityFields='a.id,a.type,a.title,a.description,a.status';
export function mountSeasons(app:Express,pool:Pool){
 app.get('/api/activities/recent',async(_request,response)=>{response.set('Cache-Control','no-store');response.json({activities:(await pool.query(`SELECT ${activityFields} FROM activities a WHERE NOT a.hidden AND status IN ('PLANNING','ACTIVE') ORDER BY created_at DESC,id DESC LIMIT 6`)).rows});});
 app.get('/api/seasons',async(_request,response)=>{response.set('Cache-Control','no-store');response.json({seasons:(await pool.query(`SELECT ${fields} FROM seasons WHERE status<>'DRAFT' ORDER BY number DESC`)).rows});});
 app.get('/api/seasons/:id',async(request,response)=>{
  response.set('Cache-Control','no-store');const id=idSchema.safeParse(request.params.id);if(!id.success){response.status(404).json({error:'NOT_FOUND'});return;}
  const season=(await pool.query(`SELECT ${fields} FROM seasons WHERE id=$1 AND status<>'DRAFT'`,[id.data])).rows[0];
  if(!season){response.status(404).json({error:'NOT_FOUND'});return;}
  const activities=(await pool.query(`SELECT ${activityFields} FROM activities a JOIN activity_seasons j ON j.activity_id=a.id WHERE j.season_id=$1 AND NOT a.hidden ORDER BY a.type,a.created_at DESC,a.id DESC`,[id.data])).rows;
  response.json({season,activities});
 });
 // Existing /api/ops middleware checks current Member and Ops role.
 app.get('/api/ops/seasons',async(_request,response)=>{response.json({seasons:(await pool.query(`SELECT ${fields} FROM seasons ORDER BY number DESC`)).rows});});
 for(const method of ['post','patch'] as const){
  app[method](method==='post'?'/api/ops/seasons':'/api/ops/seasons/:id',async(request:Request,response)=>{
   const input=content.safeParse(request.body);const id=method==='patch'?idSchema.safeParse(request.params.id):null;
   if(id&&!id.success){response.status(404).json({error:'NOT_FOUND'});return;}
   if(!input.success){response.status(400).json({error:'INVALID_SEASON'});return;}
   const s=input.data;const client=await pool.connect();try{
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(826001)'); // Keep concurrent Activity creation in the right Season.
    const result=method==='post'?await client.query(`INSERT INTO seasons(number,title,description,starts_on,ends_on,status) VALUES($1,$2,$3,$4,$5,$6) RETURNING ${fields}`,[s.number,s.title,s.description,s.startsOn,s.endsOn,s.status])
     :await client.query(`UPDATE seasons SET number=$2,title=$3,description=$4,starts_on=$5,ends_on=$6,status=$7 WHERE id=$1 RETURNING ${fields}`,[id?.data,s.number,s.title,s.description,s.startsOn,s.endsOn,s.status]);
    if(!result.rowCount){await client.query('ROLLBACK');response.status(404).json({error:'NOT_FOUND'});return;}
    if(s.status==='ACTIVE') await client.query(`INSERT INTO activity_seasons(activity_id,season_id)
      SELECT a.id,$1 FROM activities a WHERE a.status IN ('PLANNING','ACTIVE')
      AND (a.type='PROJECT' OR NOT EXISTS(SELECT 1 FROM activity_seasons j WHERE j.activity_id=a.id))
      ON CONFLICT DO NOTHING`,[result.rows[0].id]);
    await client.query('COMMIT');response.status(method==='post'?201:200).json({season:result.rows[0]});
   }catch(error){await client.query('ROLLBACK');if(error instanceof Error&&'code' in error&&error.code==='23505'){response.status(409).json({error:'SEASON_CONFLICT'});return;}throw error;}finally{client.release();}
  });
 }
 const path='/api/activities/:id/seasons';
 app.get(path,async(request,response)=>{
  response.set('Cache-Control','no-store');const id=idSchema.safeParse(request.params.id);if(!id.success){response.status(404).json({error:'NOT_FOUND'});return;}
  if(!(await pool.query('SELECT 1 FROM activities WHERE id=$1',[id.data])).rowCount){response.status(404).json({error:'NOT_FOUND'});return;}
  const history=(await pool.query(`SELECT s.id,s.number,s.title,s.status FROM seasons s JOIN activity_seasons j ON j.season_id=s.id WHERE j.activity_id=$1 AND s.status<>'DRAFT' ORDER BY s.number`,[id.data])).rows;
  response.json({seasons:history});
 });
}

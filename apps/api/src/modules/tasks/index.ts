import type {Express,Request,RequestHandler} from 'express';
import type {Pool} from 'pg';
import {z} from 'zod';
const idSchema=z.coerce.number().int().positive().max(2147483647);
const content=z.object({title:z.string().trim().min(1).max(120),description:z.string().trim().max(5000).default(''),dueDate:z.iso.date().nullable().default(null)}).strict();
const publicFields='t.id,t.title,t.description,t.due_date::text AS "dueDate",t.status';
export function mountTasks(app:Express,pool:Pool,requireMember:RequestHandler,getMember:(request:Request)=>Promise<{id:string}|null>){
 app.get('/api/activities/:id/tasks',async(request,response)=>{
  response.set('Cache-Control','no-store');const id=idSchema.safeParse(request.params.id);
  if(!id.success){response.status(404).json({error:'NOT_FOUND'});return;}
  const activity=await pool.query('SELECT owner_id,status FROM activities WHERE id=$1',[id.data]);
  if(!activity.rows[0]){response.status(404).json({error:'NOT_FOUND'});return;}
  const viewer=await getMember(request);
  if(!viewer){response.json({tasks:(await pool.query(`SELECT ${publicFields} FROM tasks t WHERE activity_id=$1 ORDER BY t.id`,[id.data])).rows});return;}
  const ops=await pool.query("SELECT id FROM users WHERE id=$1 AND role='OPS'",[viewer.id]);
  const manager=activity.rows[0].owner_id===viewer.id||Boolean(ops.rowCount);const active=['PLANNING','ACTIVE'].includes(activity.rows[0].status);
  const result=await pool.query(`SELECT ${publicFields},CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object('id',u.id,'name',u.name) END AS owner,
    ($3 AND t.status='OPEN' AND t.owner_id IS NULL) AS "canTake",
    ($3 AND t.status='IN_PROGRESS' AND (t.owner_id=$2 OR $4)) AS "canComplete",
    ($3 AND $4) AS "canEdit",($3 AND $4 AND t.status IN ('OPEN','IN_PROGRESS')) AS "canCancel"
    FROM tasks t LEFT JOIN users u ON u.id=t.owner_id WHERE t.activity_id=$1 ORDER BY t.id`,[id.data,viewer.id,active,manager]);
  response.json({tasks:result.rows,canCreate:manager&&active});
 });
 app.post('/api/activities/:id/tasks',requireMember,async(request,response)=>{
  const id=idSchema.safeParse(request.params.id);const input=content.safeParse(request.body);
  if(!id.success){response.status(404).json({error:'NOT_FOUND'});return;}
  if(!input.success){response.status(400).json({error:'INVALID_TASK'});return;}
  const client=await pool.connect();try{
   await client.query('BEGIN');
   const activity=await client.query("SELECT status,(owner_id=$2 OR EXISTS(SELECT 1 FROM users WHERE id=$2 AND role='OPS')) AS manager FROM activities WHERE id=$1 FOR UPDATE",[id.data,response.locals.userId]);
   if(!activity.rows[0]){await client.query('ROLLBACK');response.status(404).json({error:'NOT_FOUND'});return;}
   if(!activity.rows[0].manager){await client.query('ROLLBACK');response.status(403).json({error:'MANAGER_REQUIRED'});return;}
   if(!['PLANNING','ACTIVE'].includes(activity.rows[0].status)){await client.query('ROLLBACK');response.status(409).json({error:'ACTIVITY_CLOSED'});return;}
   const result=await client.query('INSERT INTO tasks(activity_id,title,description,due_date) VALUES($1,$2,$3,$4) RETURNING id',[id.data,input.data.title,input.data.description,input.data.dueDate]);
   await client.query('COMMIT');response.status(201).json({task:{id:result.rows[0].id}});
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 });
 for(const action of ['take','complete','release','cancel','edit'] as const){
  app[action==='edit'?'patch':'post'](action==='edit'?'/api/tasks/:id':`/api/tasks/:id/${action}`,requireMember,async(request,response)=>{
   const id=idSchema.safeParse(request.params.id);if(!id.success){response.status(404).json({error:'NOT_FOUND'});return;}
   const input=action==='edit'?content.safeParse(request.body):z.object({}).strict().safeParse(request.body??{});
   if(!input.success){response.status(400).json({error:'INVALID_TASK'});return;}
   const client=await pool.connect();try{
    await client.query('BEGIN');
    const activity=await client.query(`SELECT a.status,(a.owner_id=$2 OR EXISTS(SELECT 1 FROM users WHERE id=$2 AND role='OPS')) AS manager
      FROM activities a JOIN tasks t ON t.activity_id=a.id WHERE t.id=$1 FOR UPDATE OF a`,[id.data,response.locals.userId]);
    if(!activity.rows[0]){await client.query('ROLLBACK');response.status(404).json({error:'NOT_FOUND'});return;}
    const task=(await client.query('SELECT status,owner_id FROM tasks WHERE id=$1 FOR UPDATE',[id.data])).rows[0];
    if(!['PLANNING','ACTIVE'].includes(activity.rows[0].status)){await client.query('ROLLBACK');response.status(409).json({error:'ACTIVITY_CLOSED'});return;}
    if((action==='edit'||action==='cancel')&&!activity.rows[0].manager){await client.query('ROLLBACK');response.status(403).json({error:'MANAGER_REQUIRED'});return;}
    if(action!=='take'&&task.owner_id!==response.locals.userId&&!activity.rows[0].manager){await client.query('ROLLBACK');response.status(403).json({error:'TASK_OWNER_REQUIRED'});return;}
    if(action==='edit'){
     const fields=content.parse(request.body);
     await client.query('UPDATE tasks SET title=$2,description=$3,due_date=$4,updated_at=NOW() WHERE id=$1',[id.data,fields.title,fields.description,fields.dueDate]);
    }else if(action==='cancel'){
     if(!['OPEN','IN_PROGRESS'].includes(task.status)){await client.query('ROLLBACK');response.status(409).json({error:'INVALID_TRANSITION'});return;}
     await client.query("UPDATE tasks SET status='CANCELLED',updated_at=NOW() WHERE id=$1",[id.data]);
    }else if(action==='take'){
     if(task.status!=='OPEN'||task.owner_id!==null){await client.query('ROLLBACK');response.status(409).json({error:'TASK_UNAVAILABLE'});return;}
     await client.query("UPDATE tasks SET owner_id=$2,status='IN_PROGRESS',updated_at=NOW() WHERE id=$1",[id.data,response.locals.userId]);
    }else{
     if(task.status!=='IN_PROGRESS'){await client.query('ROLLBACK');response.status(409).json({error:'INVALID_TRANSITION'});return;}
     if(action==='release') await client.query("UPDATE tasks SET status='OPEN',owner_id=NULL,updated_at=NOW() WHERE id=$1",[id.data]);
     else await client.query("UPDATE tasks SET status='DONE',updated_at=NOW() WHERE id=$1",[id.data]);
    }
    await client.query('COMMIT');response.json({saved:true});
   }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  });
 }
}

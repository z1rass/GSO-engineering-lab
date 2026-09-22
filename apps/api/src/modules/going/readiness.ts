import type {Pool,PoolClient} from 'pg';

// Dates/times are Cologne wall time, matching Event and Room Request storage.
export async function registrationReady(db:Pool|PoolClient,id:number):Promise<boolean>{
 const result=await db.query(`SELECT p.planned_date IS NOT NULL AND p.start_time IS NOT NULL AND p.end_time IS NOT NULL
  AND p.general_location<>'' AND
  (NOT p.school_room_required AND r.id IS NULL OR
   r.status='CONFIRMED' AND p.exact_room=r.room
   AND (p.planned_date + p.start_time::time)>=(r.date + r.start_time::time)
   AND (coalesce(p.end_date,p.planned_date) + p.end_time::time)<=(coalesce(r.end_date,r.date) + r.end_time::time)) AS ready
  FROM event_details p LEFT JOIN room_requests r ON r.activity_id=p.activity_id WHERE p.activity_id=$1`,[id]);
 return result.rows[0]?.ready===true;
}

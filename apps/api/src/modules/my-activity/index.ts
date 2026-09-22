import type { Express, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';

export function mountMyActivity(app: Express, pool: Pool, requireMember: RequestHandler) {
  app.get('/api/me/activity', requireMember, async (request, response) => {
    if (!z.object({}).strict().safeParse(request.query).success) {
      response.status(400).json({ error: 'INVALID_QUERY' }); return;
    }
    // One statement gives all sections the same snapshot; identity comes only from the session.
    const { rows } = await pool.query(`
      WITH participation AS (
        SELECT a.id,a.type,a.title,a.status,a.owner_id=$1 AS "isOwner",
          EXISTS(SELECT 1 FROM project_memberships m WHERE m.project_id=a.id AND m.user_id=$1 AND m.left_at IS NULL) AS joined,
          EXISTS(SELECT 1 FROM event_going g WHERE g.event_id=a.id AND g.user_id=$1) AS going
        FROM activities a
      ), mine AS (SELECT * FROM participation WHERE "isOwner" OR joined OR going)
      SELECT
        COALESCE((SELECT json_agg(m ORDER BY m.id DESC) FROM mine m WHERE type='PROJECT'),'[]') AS projects,
        COALESCE((SELECT json_agg(m ORDER BY m.id DESC) FROM mine m WHERE type='EVENT'),'[]') AS events,
        COALESCE((SELECT json_agg(t ORDER BY t."dueDate" NULLS LAST,t.id) FROM (
          SELECT t.id,t.title,t.status,t.due_date::text AS "dueDate",
            json_build_object('id',a.id,'type',a.type,'title',a.title,'status',a.status) AS activity
          FROM tasks t JOIN activities a ON a.id=t.activity_id WHERE t.owner_id=$1
        ) t),'[]') AS tasks,
        json_build_object(
          'ideas',COALESCE((SELECT json_agg(i ORDER BY i.id DESC) FROM (
            SELECT i.id,i.title FROM ideas i JOIN idea_interests x ON x.idea_id=i.id WHERE x.user_id=$1
          ) i),'[]'),
          'activities',COALESCE((SELECT json_agg(a ORDER BY a.id DESC) FROM (
            SELECT a.id,a.type,a.title,a.status FROM activities a JOIN activity_interests x ON x.activity_id=a.id WHERE x.user_id=$1
          ) a),'[]')
        ) AS interested`, [response.locals.userId]);
    response.json(rows[0]);
  });
}

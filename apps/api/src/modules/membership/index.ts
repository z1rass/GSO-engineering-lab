import type { Express, Request, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';

const idSchema = z.coerce.number().int().positive().max(2147483647);
const emptyBody = z.object({}).strict();
export function mountMembership(app: Express, pool: Pool, requireMember: RequestHandler, getMember: (request: Request) => Promise<{id:string} | null>) {
  const path = '/api/projects/:id/membership';
  app.get(path, async (request, response) => {
    response.set('Cache-Control','no-store');
    const id = idSchema.safeParse(request.params.id);
    if (!id.success) { response.status(404).json({error:'NOT_FOUND'}); return; }
    const project = await pool.query("SELECT owner_id,status FROM activities WHERE id=$1 AND type='PROJECT'",[id.data]);
    if (!project.rows[0]) { response.status(404).json({error:'NOT_FOUND'}); return; }
    const viewer = await getMember(request);
    const members = await pool.query(`SELECT u.id,u.name FROM project_memberships m JOIN users u ON u.id=m.user_id
      WHERE m.project_id=$1 AND m.left_at IS NULL ORDER BY m.joined_at,m.id`,[id.data]);
    if (!viewer) { response.json({count:members.rowCount}); return; }
    const history = await pool.query('SELECT joined_at AS "joinedAt",left_at AS "leftAt" FROM project_memberships WHERE project_id=$1 AND user_id=$2 ORDER BY id',[id.data,viewer.id]);
    response.json({count:members.rowCount,members:members.rows,joined:members.rows.some(member=>member.id===viewer.id),isOwner:project.rows[0].owner_id===viewer.id,
      canJoin:['PLANNING','ACTIVE'].includes(project.rows[0].status),history:history.rows});
  });
  for (const method of ['post','delete'] as const) {
    app[method](path, requireMember, async (request,response) => {
      const id = idSchema.safeParse(request.params.id);
      if (!id.success) { response.status(404).json({error:'NOT_FOUND'}); return; }
      if (!emptyBody.safeParse(request.body ?? {}).success) { response.status(400).json({error:'INVALID_MEMBERSHIP'}); return; }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const project = await client.query("SELECT owner_id,status FROM activities WHERE id=$1 AND type='PROJECT' FOR UPDATE",[id.data]);
        if (!project.rows[0]) { await client.query('ROLLBACK'); response.status(404).json({error:'NOT_FOUND'}); return; }
        if (method === 'delete' && project.rows[0].owner_id === response.locals.userId) {
          await client.query('ROLLBACK'); response.status(409).json({error:'OWNER_MUST_TRANSFER'}); return;
        }
        if (method === 'post' && !['PLANNING','ACTIVE'].includes(project.rows[0].status)) {
          await client.query('ROLLBACK'); response.status(409).json({error:'PROJECT_CLOSED'}); return;
        }
        if (method === 'post') {
          await client.query('INSERT INTO project_memberships(project_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[id.data,response.locals.userId]);
        } else {
          await client.query('UPDATE project_memberships SET left_at=clock_timestamp() WHERE project_id=$1 AND user_id=$2 AND left_at IS NULL',[id.data,response.locals.userId]);
        }
        await client.query('COMMIT'); response.json({saved:true});
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    });
  }
}

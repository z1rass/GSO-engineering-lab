import type { Express, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';

export function mountOps(app: Express, pool: Pool, requireMember: RequestHandler) {
  app.use('/api/ops', requireMember, async (_request, response, next) => {
    const actor = await pool.query("SELECT id FROM users WHERE id=$1 AND role='OPS'", [response.locals.userId]);
    if (!actor.rowCount) { response.status(403).json({ error: 'OPS_REQUIRED' }); return; }
    next();
  });
  app.get('/api/ops', async (_request, response) => {
    const members = await pool.query(`SELECT id, name, role, education, year FROM users
      WHERE affiliation='MEMBER' AND email_verified=true ORDER BY name, id`);
    const changes = await pool.query(`SELECT c.id, c.target_id AS "targetId", c.actor_id AS "actorId",
      target.name AS "targetName", actor.name AS "actorName", c.previous_role AS "previousRole", c.new_role AS "newRole",
      c.source, c.operator, c.confirmed_by AS "confirmedBy", c.handover_checklist AS "handoverChecklist", c.created_at AS "createdAt"
      FROM role_changes c LEFT JOIN users target ON target.id=c.target_id LEFT JOIN users actor ON actor.id=c.actor_id
      ORDER BY c.id DESC LIMIT 100`);
    response.json({ members: members.rows, changes: changes.rows });
  });
  app.post('/api/ops/appointments', async (request, response) => {
    const input = z.object({ userId: z.string().min(1).max(200) }).strict().safeParse(request.body);
    if (!input.success) { response.status(400).json({ error: 'INVALID_APPOINTMENT' }); return; }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Recheck authority within the same transaction that changes the role.
      const actor = await client.query("SELECT id FROM users WHERE id=$1 AND role='OPS' AND affiliation='MEMBER' AND email_verified=true FOR SHARE", [response.locals.userId]);
      if (!actor.rowCount) { await client.query('ROLLBACK'); response.status(403).json({ error: 'OPS_REQUIRED' }); return; }
      const target = await client.query("UPDATE users SET role='OPS', updated_at=NOW() WHERE id=$1 AND role='MEMBER' AND affiliation='MEMBER' AND email_verified=true RETURNING id", [input.data.userId]);
      if (!target.rowCount) { await client.query('ROLLBACK'); response.status(409).json({ error: 'NOT_ELIGIBLE' }); return; }
      await client.query("INSERT INTO role_changes (target_id, actor_id, previous_role, new_role, source) VALUES ($1,$2,'MEMBER','OPS','APPOINTMENT')", [input.data.userId, response.locals.userId]);
      await client.query('COMMIT');
      response.status(201).json({ appointed: true });
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  });
}

import type { Express, Request } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
const idSchema = z.coerce.number().int().positive().max(2147483647);
const reason = z.string().trim().min(1).max(1000);
const visibility = z.object({ hidden: z.boolean(), reason }).strict();

export function mountContentVisibility(app: Express, pool: Pool, getMember: (request: Request) => Promise<{ id: string } | null>) {
  // All existing direct content and child-resource routes pass this gate, including writes.
  for (const route of ['ideas', 'projects', 'events', 'activities', 'tasks']) {
    app.use(`/api/${route}/:id`, async (request, response, next) => {
      const id = idSchema.safeParse(request.params.id); if (!id.success) { next(); return; }
      const sql = route === 'ideas' ? 'SELECT hidden FROM ideas WHERE id=$1'
        : route === 'tasks' ? 'SELECT a.hidden FROM tasks t JOIN activities a ON a.id=t.activity_id WHERE t.id=$1'
        : 'SELECT hidden FROM activities WHERE id=$1';
      if ((await pool.query(sql, [id.data])).rows[0]?.hidden) {
        response.set('Cache-Control', 'no-store');
        const member = await getMember(request);
        const ops = member && (await pool.query("SELECT id FROM users WHERE id=$1 AND role='OPS'", [member.id])).rowCount;
        if (!ops) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
      }
      next();
    });
  }
}

export function mountModeration(app: Express, pool: Pool) {
  app.post('/api/ops/moderation/users/:id', async (request, response) => {
    const input = z.object({ blocked: z.boolean(), reason }).strict().safeParse(request.body);
    if (!input.success) { response.status(400).json({ error: 'INVALID_MODERATION' }); return; }
    if (request.params.id === response.locals.userId && input.data.blocked) { response.status(409).json({ error: 'CANNOT_BLOCK_SELF' }); return; }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const changed = await client.query('UPDATE users SET blocked=$2,block_reason=$3 WHERE id=$1 RETURNING id', [request.params.id, input.data.blocked, input.data.blocked ? input.data.reason : '']);
      if (!changed.rowCount) { await client.query('ROLLBACK'); response.status(404).json({ error: 'NOT_FOUND' }); return; }
      await client.query("INSERT INTO moderation_actions(target_type,target_id,action,reason,actor_id) VALUES('USER',$1,$2,$3,$4)", [request.params.id, input.data.blocked ? 'BLOCK' : 'UNBLOCK', input.data.reason, response.locals.userId]);
      await client.query('COMMIT'); response.json({ saved: true });
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  });
  app.get('/api/ops/moderation', async (_request, response) => {
    const ideas = (await pool.query('SELECT id,title,hidden FROM ideas ORDER BY id DESC')).rows;
    const activities = (await pool.query('SELECT id,type,title,hidden FROM activities ORDER BY id DESC')).rows;
    const users = (await pool.query('SELECT id,name,role,blocked,block_reason AS "blockReason" FROM users ORDER BY name,id')).rows;
    const history = (await pool.query(`SELECT m.id,m.target_type AS "targetType",m.target_id AS "targetId",m.action,m.reason,
      m.created_at AS "createdAt",u.name AS "actorName" FROM moderation_actions m LEFT JOIN users u ON u.id=m.actor_id ORDER BY m.id DESC LIMIT 100`)).rows;
    response.json({ ideas, activities, users, history, viewerId: response.locals.userId });
  });
  for (const target of [{ route: 'ideas', table: 'ideas', type: 'IDEA' }, { route: 'activities', table: 'activities', type: 'ACTIVITY' }]) {
    app.post(`/api/ops/moderation/${target.route}/:id`, async (request, response) => {
      const id = idSchema.safeParse(request.params.id); const input = visibility.safeParse(request.body);
      if (!id.success) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
      if (!input.success) { response.status(400).json({ error: 'INVALID_MODERATION' }); return; }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const changed = await client.query(`UPDATE ${target.table} SET hidden=$2 WHERE id=$1 RETURNING id`, [id.data, input.data.hidden]);
        if (!changed.rowCount) { await client.query('ROLLBACK'); response.status(404).json({ error: 'NOT_FOUND' }); return; }
        await client.query('INSERT INTO moderation_actions(target_type,target_id,action,reason,actor_id) VALUES($1,$2,$3,$4,$5)', [target.type, String(id.data), input.data.hidden ? 'HIDE' : 'RESTORE', input.data.reason, response.locals.userId]);
        await client.query('COMMIT'); response.json({ saved: true });
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    });
  }
}

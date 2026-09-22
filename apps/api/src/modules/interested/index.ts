import type { Express, Request, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';

// SQL identifiers come only from this fixed map, never from request input.
const targets = [
  { route: 'ideas', table: 'ideas', interests: 'idea_interests', key: 'idea_id', condition: 'TRUE' },
  { route: 'projects', table: 'activities', interests: 'activity_interests', key: 'activity_id', condition: "type='PROJECT'" },
  { route: 'events', table: 'activities', interests: 'activity_interests', key: 'activity_id', condition: "type='EVENT'" },
];
const targetId = z.coerce.number().int().positive().max(2147483647);
export function mountInterested(app: Express, pool: Pool, requireMember: RequestHandler, getMember: (request: Request) => Promise<{ id: string } | null>) {
  for (const target of targets) {
    const path = `/api/${target.route}/:id/interested`;
    const requireTarget: RequestHandler = async (request, response, next) => {
      response.set('Cache-Control', 'no-store');
      const id = targetId.safeParse(request.params.id);
      if (!id.success) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
      const exists = await pool.query(`SELECT id FROM ${target.table} WHERE id=$1 AND ${target.condition}`, [id.data]);
      if (!exists.rowCount) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
      response.locals.targetId = id.data;
      next();
    };
    app.get(path, requireTarget, async (request, response) => {
      const member = await getMember(request);
      const { rows } = await pool.query(`SELECT count(*)::int AS count,
        CASE WHEN $2::text IS NULL THEN NULL ELSE coalesce(bool_or(user_id=$2),false) END AS interested
        FROM ${target.interests} WHERE ${target.key}=$1`, [response.locals.targetId, member?.id ?? null]);
      response.json(rows[0]);
    });
    app.post(path, requireMember, requireTarget, async (request, response) => {
      if (!z.object({}).strict().safeParse(request.body).success) { response.status(400).json({ error: 'INVALID_INTEREST' }); return; }
      await pool.query(`INSERT INTO ${target.interests}(${target.key},user_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, [response.locals.targetId, response.locals.userId]);
      response.json({ saved: true });
    });
    app.delete(path, requireMember, requireTarget, async (request, response) => {
      if (!z.object({}).strict().safeParse(request.body ?? {}).success) { response.status(400).json({ error: 'INVALID_INTEREST' }); return; }
      await pool.query(`DELETE FROM ${target.interests} WHERE ${target.key}=$1 AND user_id=$2`, [response.locals.targetId, response.locals.userId]);
      response.json({ saved: true });
    });
  }
}

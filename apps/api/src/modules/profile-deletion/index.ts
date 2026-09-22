import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import { z } from 'zod';
import type { Pool } from 'pg';

const input = z.object({ cancelActivityIds: z.array(z.number().int().positive().max(2147483647)).max(100) }).strict();
const id = z.string().trim().min(1).max(100);

export function mountProfileDeletion(app: Express, pool: Pool) {
  app.get('/api/ops/users/:id/profile-deletion', async (request, response) => {
    const actor = await pool.query("SELECT id FROM users WHERE id=$1 AND role='OPS' AND affiliation='MEMBER' AND email_verified=true", [response.locals.userId]);
    if (!actor.rowCount) { response.status(403).json({ error: 'OPS_REQUIRED' }); return; }
    const targetId = id.safeParse(request.params.id);
    if (!targetId.success) { response.status(400).json({ error: 'INVALID_USER' }); return; }
    const target = (await pool.query("SELECT id,name FROM users WHERE id=$1 AND affiliation<>'DELETED'", [targetId.data])).rows[0];
    if (!target) { response.status(404).json({ error: 'USER_NOT_FOUND' }); return; }
    const activities = (await pool.query("SELECT id,title,status FROM activities WHERE owner_id=$1 AND status IN ('PLANNING','ACTIVE') ORDER BY id", [target.id])).rows;
    response.json({ user: target, activities });
  });
  app.post('/api/ops/users/:id/profile-deletion', async (request, response) => {
    const actor = await pool.query("SELECT id FROM users WHERE id=$1 AND role='OPS' AND affiliation='MEMBER' AND email_verified=true", [response.locals.userId]);
    if (!actor.rowCount) { response.status(403).json({ error: 'OPS_REQUIRED' }); return; }
    const targetId = id.safeParse(request.params.id);
    const parsed = input.safeParse(request.body);
    if (!targetId.success || !parsed.success) { response.status(400).json({ error: 'INVALID_PROFILE_DELETION' }); return; }
    if (targetId.data === response.locals.userId) { response.status(409).json({ error: 'CANNOT_DELETE_SELF' }); return; }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const target = (await client.query('SELECT id,email,affiliation FROM users WHERE id=$1 FOR UPDATE', [targetId.data])).rows[0];
      if (!target || target.affiliation === 'DELETED') { await client.query('ROLLBACK'); response.status(404).json({ error: 'USER_NOT_FOUND' }); return; }
      const active = (await client.query("SELECT id,title FROM activities WHERE owner_id=$1 AND status IN ('PLANNING','ACTIVE') ORDER BY id FOR UPDATE", [target.id])).rows as { id: number; title: string }[];
      const requested = [...new Set(parsed.data.cancelActivityIds)].sort((a, b) => a - b);
      const required = active.map(activity => activity.id);
      if (requested.length !== required.length || requested.some((activityId, index) => activityId !== required[index])) {
        await client.query('ROLLBACK');
        response.status(409).json({ error: 'ACTIVE_OWNERSHIP_REQUIRES_RESOLUTION', activities: active });
        return;
      }
      if (required.length) {
        await client.query("UPDATE activities SET status='CANCELLED',updated_at=NOW() WHERE owner_id=$1 AND status IN ('PLANNING','ACTIVE')", [target.id]);
        await client.query("UPDATE tasks SET status='CANCELLED',updated_at=NOW() WHERE activity_id=ANY($1::int[]) AND status IN ('OPEN','IN_PROGRESS')", [required]);
        await client.query("UPDATE ownership_transfers SET status='CANCELLED',resolved_at=NOW() WHERE activity_id=ANY($1::int[]) AND status='PENDING'", [required]);
      }
      await client.query("UPDATE ownership_transfers SET status='CANCELLED',resolved_at=NOW() WHERE (recipient_id=$1 OR from_owner_id=$1) AND status='PENDING'", [target.id]);
      await client.query('UPDATE ideas SET created_by=NULL,updated_at=NOW() WHERE created_by=$1', [target.id]);
      await client.query('DELETE FROM sessions WHERE user_id=$1', [target.id]);
      await client.query('DELETE FROM accounts WHERE user_id=$1', [target.id]);
      await client.query('DELETE FROM verifications WHERE identifier=$1', [target.email]);
      await client.query("UPDATE users SET name='Deleted participant',email=$2,email_verified=false,image=NULL,education=NULL,year=NULL,interests=NULL,role='MEMBER',affiliation='DELETED',blocked=false,block_reason='',updated_at=NOW() WHERE id=$1", [target.id, `deleted-${randomUUID()}@invalid.local`]);
      await client.query('COMMIT');
      response.json({ deleted: true, userId: target.id, cancelledActivityIds: required });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Profile deletion failed', error);
      response.status(503).json({ error: 'SERVICE_UNAVAILABLE' });
    } finally { client.release(); }
  });
}

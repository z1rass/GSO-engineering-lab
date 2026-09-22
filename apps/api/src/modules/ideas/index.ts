import type { Express, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { desc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { z } from 'zod';
import { ideas } from '../../database/schema.js';

const content = z.object({ title: z.string().trim().min(1).max(120), description: z.string().trim().min(1).max(5000) }).strict();
// Deliberately whitelist the public projection; authorship stays private.
const publicIdea = { id: ideas.id, title: ideas.title, description: ideas.description, createdAt: ideas.createdAt, updatedAt: ideas.updatedAt };
const ideaId = z.coerce.number().int().positive().max(2147483647);
export function mountIdeas(app: Express, pool: Pool, requireMember: RequestHandler) {
  const db = drizzle(pool);
  app.use('/api/ideas', (_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
  app.get('/api/ideas', async (_request, response) => {
    response.json({ ideas: await db.select(publicIdea).from(ideas).orderBy(desc(ideas.id)) });
  });
  app.get('/api/ideas/:id', async (request, response) => {
    const id = ideaId.safeParse(request.params.id);
    if (!id.success) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    const [idea] = await db.select(publicIdea).from(ideas).where(eq(ideas.id, id.data));
    if (!idea) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    response.json({ idea });
  });
  app.post('/api/ideas', requireMember, async (request, response) => {
    const input = content.safeParse(request.body);
    if (!input.success) { response.status(400).json({ error: 'INVALID_IDEA' }); return; }
    const [idea] = await db.insert(ideas).values({ ...input.data, createdBy: response.locals.userId }).returning(publicIdea);
    response.status(201).json({ idea });
  });
  app.patch('/api/ideas/:id', requireMember, async (request, response) => {
    const actor = await pool.query("SELECT id FROM users WHERE id=$1 AND role='OPS'", [response.locals.userId]);
    if (!actor.rowCount) { response.status(403).json({ error: 'OPS_REQUIRED' }); return; }
    const id = ideaId.safeParse(request.params.id);
    if (!id.success) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    const input = content.safeParse(request.body);
    if (!input.success) { response.status(400).json({ error: 'INVALID_IDEA' }); return; }
    const [idea] = await db.update(ideas).set({ ...input.data, updatedAt: new Date() }).where(eq(ideas.id, id.data)).returning(publicIdea);
    if (!idea) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    response.json({ idea });
  });

}

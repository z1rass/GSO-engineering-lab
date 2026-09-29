import { randomBytes, randomInt } from 'node:crypto';
import type { Express, RequestHandler } from 'express';
import type { Database } from '../../database/index.js';
import { z } from 'zod';
import { trustedOrigin, limitWrites } from '../../shared/public-writes.js';

const ideaCovers = ['/covers/cover-ideas-paper.webp', '/covers/cover-circuit-riso.webp', '/covers/event-glass.jpg',
  '/covers/event-ribbon.jpg', '/covers/project-amber.jpg', '/covers/project-structure.jpg',
  '/covers/cover-glass-loop.webp', '/covers/event-chrome.jpg', '/covers/project-paper.jpg'] as const;
const content = z.object({ title: z.string().trim().min(1).max(120), description: z.string().trim().min(1).max(5000),
  coverUrl: z.enum(ideaCovers).optional() }).strict();
const ideaId = z.coerce.number().int().positive().max(2147483647);
const voteCookie = 'gso_idea_voter';
const publicFields = `i.id, i.title, i.description, i.cover_url AS "coverUrl", i.created_at AS "createdAt", i.updated_at AS "updatedAt",
  (SELECT count(*) FROM idea_votes v WHERE v.idea_id=i.id) AS "voteCount",
  EXISTS(SELECT 1 FROM idea_votes v WHERE v.idea_id=i.id AND v.visitor_id=?) AS "voted"`;
export function mountIdeas(app: Express, db: Database) {
  const visitor: RequestHandler = (request, response, next) => {
    const value = request.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${voteCookie}=`))?.slice(voteCookie.length + 1);
    const id = value && /^[a-f0-9]{32}$/.test(value) ? value : randomBytes(16).toString('hex');
    response.locals.visitorId = id;
    if (id !== value) response.append('Set-Cookie', `${voteCookie}=${id}; Path=/api/ideas; HttpOnly; SameSite=Strict; Max-Age=31536000${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
    next();
  };
  app.use('/api/ideas', (_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
  app.use('/api/ideas', visitor);
  app.get('/api/ideas', (_request, response) => {
    const ideas = db.prepare(`SELECT ${publicFields} FROM ideas i WHERE i.hidden=0 ORDER BY i.id DESC`).all(response.locals.visitorId);
    response.json({ ideas: ideas.map(idea => ({ ...idea, voted: Boolean(idea.voted) })) });
  });
  app.get('/api/ideas/:id', (request, response) => {
    const id = ideaId.safeParse(request.params.id);
    if (!id.success) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    const idea = db.prepare(`SELECT ${publicFields} FROM ideas i WHERE i.id=? AND i.hidden=0`).get(response.locals.visitorId, id.data);
    if (!idea) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    response.json({ idea: { ...idea, voted: Boolean(idea.voted) } });
  });
  app.post('/api/ideas', trustedOrigin, limitWrites(10, 60 * 60_000), (request, response) => {
    const input = content.safeParse(request.body);
    if (!input.success) { response.status(400).json({ error: 'INVALID_IDEA' }); return; }
    const now = new Date().toISOString();
    const coverUrl = input.data.coverUrl ?? ideaCovers[randomInt(ideaCovers.length)]!;
    const idea = db.prepare(`INSERT INTO ideas(title,description,cover_url,created_at,updated_at) VALUES(?,?,?,?,?)
      RETURNING id,title,description,cover_url AS "coverUrl",created_at AS "createdAt",updated_at AS "updatedAt"`)
      .get(input.data.title, input.data.description, coverUrl, now, now);
    response.status(201).json({ idea });
  });
  app.post('/api/ideas/:id/vote', trustedOrigin, limitWrites(60, 60 * 60_000), (request, response) => {
    const id = ideaId.safeParse(request.params.id);
    if (!id.success) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    const exists = db.prepare('SELECT 1 FROM ideas WHERE id=? AND hidden=0').get(id.data);
    if (!exists) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    db.prepare('INSERT OR IGNORE INTO idea_votes(idea_id,visitor_id) VALUES(?,?)').run(id.data, response.locals.visitorId);
    const count = db.prepare('SELECT count(*) AS count FROM idea_votes WHERE idea_id=?').get(id.data) as { count: number };
    response.json({ voted: true, voteCount: count.count });
  });
  app.delete('/api/ideas/:id/vote', trustedOrigin, limitWrites(60, 60 * 60_000), (request, response) => {
    const id = ideaId.safeParse(request.params.id);
    if (!id.success) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    const exists = db.prepare('SELECT 1 FROM ideas WHERE id=? AND hidden=0').get(id.data);
    if (!exists) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    db.prepare('DELETE FROM idea_votes WHERE idea_id=? AND visitor_id=?').run(id.data, response.locals.visitorId);
    const count = db.prepare('SELECT count(*) AS count FROM idea_votes WHERE idea_id=?').get(id.data) as { count: number };
    response.json({ voted: false, voteCount: count.count });
  });
}

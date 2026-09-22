import { mountRooms } from './modules/rooms/index.js';
import { mountMembership } from './modules/membership/index.js';
import { mountInterested } from './modules/interested/index.js';
import { mountEvents } from './modules/events/index.js';
import { mountProjects } from './modules/projects/index.js';
import { mountIdeas } from './modules/ideas/index.js';
import { mountOps } from './modules/ops/index.js';
import { mountAuth } from './modules/auth/index.js';
import express, { type ErrorRequestHandler } from 'express';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { seasons } from './database/schema.js';

export function createApp(pool: Pool) {
  const app = express();
  const db = drizzle(pool);
  app.disable('x-powered-by');
  const { requireMember, getMember } = mountAuth(app, pool);
  mountOps(app, pool, requireMember);
  mountIdeas(app, pool, requireMember);
  mountProjects(app, pool, requireMember, getMember);
  mountEvents(app, pool, requireMember, getMember);
  mountInterested(app, pool, requireMember, getMember);
  mountMembership(app, pool, requireMember, getMember);
  mountRooms(app, pool, requireMember, getMember);
  app.get('/api/health', (_request, response) => { response.json({ status: 'ok' }); });
  app.get('/api/seasons/current', async (_request, response) => {
    response.set('Cache-Control', 'no-store');
    try {
      const [season] = await db.select().from(seasons).where(eq(seasons.status, 'ACTIVE')).limit(1);
      response.json({ season: season ?? null });
    } catch {
      console.error('Current Season database query failed');
      response.status(503).json({ error: 'Season temporarily unavailable' });
    }
  });
  const handleError: ErrorRequestHandler = (error, _request, response, _next) => {
    void _next;
    const badJson = error instanceof SyntaxError;
    response.status(badJson ? 400 : 503).json({ error: badJson ? 'INVALID_JSON' : 'SERVICE_UNAVAILABLE' });
  };
  app.use(handleError);
  return app;
}

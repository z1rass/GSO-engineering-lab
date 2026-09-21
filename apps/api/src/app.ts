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
  mountAuth(app, pool);
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

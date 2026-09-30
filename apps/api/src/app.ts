import express, { type ErrorRequestHandler } from 'express';
import type { Database } from './database/index.js';
import { mountSiteAdmin } from './modules/site-admin/index.js';
import { mountIdeas } from './modules/ideas/index.js';
import { mountPublicEvents } from './modules/public-events/index.js';
import { mountSocialPreviews } from './modules/social-preview/index.js';

export function createApp(db: Database) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');
  app.use('/api/admin/covers', express.json({ limit: '3mb' }));
  app.use(express.json({ limit: '128kb' }));
  mountSiteAdmin(app, db);
  mountIdeas(app, db);
  mountPublicEvents(app, db);
  mountSocialPreviews(app, db);
  app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));
  const handleError: ErrorRequestHandler = (error, _request, response, _next) => {
    void _next;
    if (response.headersSent) return;
    response.status(error?.type === 'entity.too.large' ? 413 : error instanceof SyntaxError ? 400 : 503)
      .json({ error: error?.type === 'entity.too.large' ? 'PAYLOAD_TOO_LARGE' : error instanceof SyntaxError ? 'INVALID_JSON' : 'SERVICE_UNAVAILABLE' });
  };
  app.use(handleError);
  return app;
}

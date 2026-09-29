import type { Express } from 'express';
import type { Database } from '../../database/index.js';
import { z } from 'zod';

const id = z.coerce.number().int().positive().max(2147483647);
const fields = `e.id,e.title,e.description,e.status,e.cover_url AS "coverUrl",e.materials,
  (SELECT i.id FROM ideas i WHERE i.id=e.idea_id AND i.hidden=0) AS "ideaId",
  e.category,e.planned_date AS "plannedDate",e.end_date AS "endDate",
  e.start_time AS "startTime",e.end_time AS "endTime",e.general_location AS "generalLocation",
  e.place_type AS "placeType"`;
const from = 'FROM events e WHERE e.hidden=0';

export function mountPublicEvents(app: Express, db: Database) {
  app.use('/api/events', (_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
  app.get('/api/events', (_request, response) => {
    response.json({ events: db.prepare(`SELECT ${fields} ${from} ORDER BY e.id DESC`).all() });
  });
  app.get('/api/events/:id', (request, response) => {
    const parsed = id.safeParse(request.params.id);
    if (!parsed.success) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    const event = db.prepare(`SELECT ${fields} ${from} AND e.id=?`).get(parsed.data);
    if (!event) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    response.json({ event });
  });
}

import { randomBytes } from 'node:crypto';
import type { Express, RequestHandler } from 'express';
import type { Database } from '../../database/index.js';
import { z } from 'zod';
import { limitWrites, trustedOrigin } from '../../shared/public-writes.js';

const id = z.coerce.number().int().positive().max(2147483647);
const fields = `e.id,e.title,e.description,e.status,e.cover_url AS "coverUrl",e.materials,e.updated_at AS "updatedAt",
  (SELECT i.id FROM ideas i WHERE i.id=e.idea_id AND i.hidden=0) AS "ideaId",
  e.category,e.planned_date AS "plannedDate",e.end_date AS "endDate",
  e.start_time AS "startTime",e.end_time AS "endTime",e.general_location AS "generalLocation",
  e.place_type AS "placeType",
  (SELECT count(*) FROM event_going g WHERE g.event_id=e.id) AS "goingCount",
  EXISTS(SELECT 1 FROM event_going g WHERE g.event_id=e.id AND g.visitor_id=?) AS "going"`;
const from = 'FROM events e WHERE e.hidden=0';
const visitorCookie = 'gso_event_visitor';
function berlinToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function mountPublicEvents(app: Express, db: Database) {
  const visitor: RequestHandler = (request, response, next) => {
    const value = request.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${visitorCookie}=`))?.slice(visitorCookie.length + 1);
    const visitorId = value && /^[a-f0-9]{32}$/.test(value) ? value : randomBytes(16).toString('hex');
    response.locals.visitorId = visitorId;
    if (visitorId !== value) response.append('Set-Cookie', `${visitorCookie}=${visitorId}; Path=/api/events; HttpOnly; SameSite=Strict; Max-Age=31536000${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
    next();
  };
  app.use('/api/events', (_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
  app.use('/api/events', visitor);
  app.get('/api/events', (_request, response) => {
    const events = db.prepare(`SELECT ${fields} ${from} ORDER BY e.id DESC`).all(response.locals.visitorId);
    response.json({ events: events.map(event => ({ ...event, going: Boolean(event.going) })) });
  });
  app.get('/api/events/:id', (request, response) => {
    const parsed = id.safeParse(request.params.id);
    if (!parsed.success) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    const event = db.prepare(`SELECT ${fields} ${from} AND e.id=?`).get(response.locals.visitorId, parsed.data);
    if (!event) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    response.json({ event: { ...event, going: Boolean(event.going) } });
  });
  const goingLimit = limitWrites(60, 60 * 60_000);
  app.post('/api/events/:id/going', trustedOrigin, goingLimit, (request, response) => {
    const parsed = id.safeParse(request.params.id);
    if (!parsed.success) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    const event = db.prepare('SELECT planned_date AS "plannedDate",end_date AS "endDate",status FROM events WHERE id=? AND hidden=0')
      .get(parsed.data) as { plannedDate: string | null; endDate: string | null; status: string } | undefined;
    if (!event) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    if (!event.plannedDate || (event.endDate ?? event.plannedDate) < berlinToday() || ['CANCELLED', 'COMPLETED'].includes(event.status)) {
      response.status(409).json({ error: 'GOING_CLOSED' }); return;
    }
    db.prepare('INSERT OR IGNORE INTO event_going(event_id,visitor_id) VALUES(?,?)').run(parsed.data, response.locals.visitorId);
    const count = db.prepare('SELECT count(*) AS count FROM event_going WHERE event_id=?').get(parsed.data) as { count: number };
    response.json({ going: true, goingCount: count.count });
  });
  app.delete('/api/events/:id/going', trustedOrigin, goingLimit, (request, response) => {
    const parsed = id.safeParse(request.params.id);
    if (!parsed.success || !db.prepare('SELECT 1 FROM events WHERE id=? AND hidden=0').get(parsed.data)) {
      response.status(404).json({ error: 'NOT_FOUND' }); return;
    }
    db.prepare('DELETE FROM event_going WHERE event_id=? AND visitor_id=?').run(parsed.data, response.locals.visitorId);
    const count = db.prepare('SELECT count(*) AS count FROM event_going WHERE event_id=?').get(parsed.data) as { count: number };
    response.json({ going: false, goingCount: count.count });
  });
}

import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Express, Request, RequestHandler } from 'express';
import type { Database } from '../../database/index.js';
import { z } from 'zod';
import { trustedOrigin } from '../../shared/public-writes.js';

const cookieName = 'gso_site_admin';
const durationSeconds = 60 * 60 * 24 * 7;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const id = z.coerce.number().int().positive().max(2147483647);
const gallery = ['/covers/event-ribbon.jpg', '/covers/event-chrome.jpg', '/covers/event-glass.jpg', '/covers/project-paper.jpg', '/covers/project-amber.jpg', '/covers/project-structure.jpg', '/covers/cover-robotics.webp', '/covers/cover-circuit-riso.webp', '/covers/cover-glass-loop.webp', '/covers/cover-ideas-paper.webp'];
const coverInput = z.string().refine(value => gallery.includes(value) || /^\/api\/covers\/[a-f0-9-]{36}$/.test(value));
const ideaInput = z.object({ title: z.string().trim().min(1).max(120), description: z.string().trim().min(1).max(5000) }).strict();
const eventInput = z.object({
  title: z.string().trim().min(1).max(120), description: z.string().trim().min(1).max(12000),
  category: z.enum(['TALK', 'WORKSHOP', 'BUILD_NIGHT', 'STUDY_SESSION', 'HACKATHON', 'SOCIAL', 'OTHER']).default('OTHER'),
  plannedDate: z.iso.date().nullable().default(null), endDate: z.iso.date().nullable().default(null),
  startTime: z.iso.time({ precision: -1 }).nullable().default(null), endTime: z.iso.time({ precision: -1 }).nullable().default(null),
  placeType: z.literal('SCHOOL').default('SCHOOL'), generalLocation: z.string().trim().min(1).max(30),
  coverUrl: coverInput.nullable().default(null),
}).strict().refine(value => !value.endDate || (value.plannedDate && value.endDate >= value.plannedDate), { message: 'Invalid end date' })
  .refine(value => !value.startTime || Boolean(value.plannedDate && value.endTime), { message: 'Complete the schedule' })
  .refine(value => !value.endTime || Boolean(value.plannedDate && value.startTime), { message: 'Complete the schedule' })
  .refine(value => !value.startTime || !value.endTime || Boolean(value.endDate && value.endDate > value.plannedDate!) || value.endTime > value.startTime, { message: 'End must follow start' });

function fixedEqual(a: string, b: string) {
  const left = createHmac('sha256', 'gso-admin-password-compare').update(a).digest();
  const right = createHmac('sha256', 'gso-admin-password-compare').update(b).digest();
  return timingSafeEqual(left, right);
}
function parseCookies(request: Request) {
  const value = request.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`));
  return value?.slice(cookieName.length + 1) ?? '';
}
function cookie(value: string, maxAge: number) {
  return `${cookieName}=${value}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

export function mountSiteAdmin(app: Express, db: Database) {
  const password = process.env.ADMIN_PASSWORD ?? '';
  const secret = process.env.ADMIN_SESSION_SECRET ?? '';
  const configured = password.length >= 16 && secret.length >= 32;
  const signingKey = configured ? createHmac('sha256', secret).update(password).digest() : Buffer.alloc(32);
  const sign = (value: string) => createHmac('sha256', signingKey).update(value).digest('hex');
  const authenticated = (request: Request) => {
    if (!configured) return false;
    const parts = parseCookies(request).split('.');
    if (parts.length !== 3 || !/^\d+$/.test(parts[0]!) || !/^[a-f0-9]{32}$/.test(parts[1]!) || !/^[a-f0-9]{64}$/.test(parts[2]!)) return false;
    const [issued, nonce, signature] = parts as [string, string, string];
    const age = Math.floor(Date.now() / 1000) - Number(issued);
    return age >= 0 && age < durationSeconds && timingSafeEqual(Buffer.from(sign(`${issued}.${nonce}`), 'hex'), Buffer.from(signature, 'hex'));
  };
  const requireAdmin: RequestHandler = (request, response, next) => {
    if (!authenticated(request)) { response.status(401).json({ error: 'ADMIN_REQUIRED' }); return; }
    next();
  };
  app.use('/api/admin', (_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
  app.get('/api/admin/session', (request, response) => response.json({ configured, authenticated: authenticated(request) }));
  app.post('/api/admin/login', trustedOrigin, (request, response) => {
    if (!configured) { response.status(503).json({ error: 'ADMIN_NOT_CONFIGURED' }); return; }
    const source = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    const now = Date.now();
    const attempt = loginAttempts.get(source);
    if (attempt && attempt.resetAt > now && attempt.count >= 5) { response.status(429).json({ error: 'TOO_MANY_ATTEMPTS' }); return; }
    const supplied = z.object({ password: z.string().max(1000) }).safeParse(request.body);
    if (!supplied.success || !fixedEqual(supplied.data.password, password)) {
      const current = attempt && attempt.resetAt > now ? attempt : { count: 0, resetAt: now + 15 * 60_000 };
      current.count += 1; loginAttempts.set(source, current);
      response.status(401).json({ error: 'INVALID_PASSWORD' }); return;
    }
    loginAttempts.delete(source);
    const body = `${Math.floor(now / 1000)}.${randomBytes(16).toString('hex')}`;
    response.setHeader('Set-Cookie', cookie(`${body}.${sign(body)}`, durationSeconds));
    response.json({ authenticated: true });
  });
  app.post('/api/admin/logout', trustedOrigin, (_request, response) => {
    response.setHeader('Set-Cookie', cookie('', 0)); response.json({ authenticated: false });
  });
  app.post('/api/admin/covers', trustedOrigin, requireAdmin, (request, response) => {
    const parsed = z.object({ mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']), data: z.base64() }).strict().safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ error: 'INVALID_IMAGE' }); return; }
    const bytes = Buffer.from(parsed.data.data, 'base64');
    const type = parsed.data.mimeType;
    const valid = type === 'image/jpeg' ? bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
      : type === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
    if (!valid || bytes.length > 2_000_000 || bytes.length < 32) { response.status(400).json({ error: 'INVALID_IMAGE' }); return; }
    const imageId = randomUUID();
    db.prepare('INSERT INTO cover_uploads(id,mime_type,data) VALUES(?,?,?)').run(imageId, type, parsed.data.data);
    response.status(201).json({ coverUrl: `/api/covers/${imageId}` });
  });
  app.get('/api/covers/:id', (request, response) => {
    const imageId = z.uuid().safeParse(request.params.id);
    if (!imageId.success) { response.status(404).end(); return; }
    const image = db.prepare('SELECT mime_type,data FROM cover_uploads WHERE id=?').get(imageId.data) as { mime_type: string; data: string } | undefined;
    if (!image) { response.status(404).end(); return; }
    response.set('Content-Type', image.mime_type);
    response.set('Cache-Control', 'public, max-age=31536000, immutable');
    response.set('X-Content-Type-Options', 'nosniff');
    response.send(Buffer.from(image.data, 'base64'));
  });

  app.patch('/api/admin/ideas/:id', trustedOrigin, requireAdmin, (request, response) => {
    const parsedId = id.safeParse(request.params.id); const parsed = ideaInput.safeParse(request.body);
    if (!parsedId.success || !parsed.success) { response.status(400).json({ error: 'INVALID_IDEA' }); return; }
    const result = db.prepare('UPDATE ideas SET title=?,description=?,updated_at=? WHERE id=? AND hidden=0')
      .run(parsed.data.title, parsed.data.description, new Date().toISOString(), parsedId.data);
    if (!result.changes) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    response.json({ id: parsedId.data });
  });
  app.delete('/api/admin/ideas/:id', trustedOrigin, requireAdmin, (request, response) => {
    const parsedId = id.safeParse(request.params.id);
    if (!parsedId.success) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    const result = db.prepare('UPDATE ideas SET hidden=1,updated_at=? WHERE id=? AND hidden=0')
      .run(new Date().toISOString(), parsedId.data);
    if (!result.changes) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    response.json({ id: parsedId.data });
  });

  app.post('/api/admin/events', trustedOrigin, requireAdmin, (request, response) => {
    const parsed = eventInput.safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ error: 'INVALID_EVENT', issues: parsed.error.issues.map(issue => issue.message) }); return; }
    const input = parsed.data;
    const now = new Date().toISOString();
    const result = db.prepare(`INSERT INTO events(title,description,category,planned_date,end_date,start_time,end_time,general_location,place_type,cover_url,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(input.title, input.description, input.category, input.plannedDate, input.endDate,
      input.startTime, input.endTime, input.generalLocation, input.placeType, input.coverUrl, now, now);
    response.status(201).json({ id: Number(result.lastInsertRowid) });
  });
  app.patch('/api/admin/events/:id', trustedOrigin, requireAdmin, (request, response) => {
    const parsedId = id.safeParse(request.params.id); const parsed = eventInput.safeParse(request.body);
    if (!parsedId.success || !parsed.success) { response.status(400).json({ error: 'INVALID_EVENT' }); return; }
    const input = parsed.data;
    const previous = db.prepare('SELECT planned_date AS "plannedDate",end_date AS "endDate",start_time AS "startTime",end_time AS "endTime" FROM events WHERE id=? AND hidden=0')
      .get(parsedId.data) as { plannedDate: string | null; endDate: string | null; startTime: string | null; endTime: string | null } | undefined;
    if (!previous) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    const scheduleChanged = previous.plannedDate !== input.plannedDate || previous.endDate !== input.endDate
      || previous.startTime !== input.startTime || previous.endTime !== input.endTime;
    db.exec('BEGIN');
    try {
      const result = db.prepare(`UPDATE events SET title=?,description=?,cover_url=?,category=?,planned_date=?,end_date=?,start_time=?,end_time=?,
        general_location=?,place_type=?,updated_at=? WHERE id=? AND hidden=0`).run(input.title, input.description, input.coverUrl,
        input.category, input.plannedDate, input.endDate, input.startTime, input.endTime, input.generalLocation, input.placeType,
        new Date().toISOString(), parsedId.data);
      if (!result.changes) { db.exec('ROLLBACK'); response.status(404).json({ error: 'NOT_FOUND' }); return; }
      if (scheduleChanged) db.prepare('DELETE FROM event_going WHERE event_id=?').run(parsedId.data);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    response.json({ id: parsedId.data });
  });
  app.delete('/api/admin/events/:id', trustedOrigin, requireAdmin, (request, response) => {
    const parsedId = id.safeParse(request.params.id);
    if (!parsedId.success) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    const result = db.prepare('UPDATE events SET hidden=1,updated_at=? WHERE id=? AND hidden=0')
      .run(new Date().toISOString(), parsedId.data);
    if (!result.changes) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    response.json({ id: parsedId.data });
  });
}

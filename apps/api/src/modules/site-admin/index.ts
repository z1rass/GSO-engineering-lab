import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Express, Request, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';

const cookieName = 'gso_site_admin';
const durationSeconds = 60 * 60 * 24 * 7;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const id = z.coerce.number().int().positive().max(2147483647);
const ideaInput = z.object({ title: z.string().trim().min(1).max(120), description: z.string().trim().min(1).max(5000) }).strict();
const eventInput = z.object({
  title: z.string().trim().min(1).max(120), description: z.string().trim().min(1).max(12000),
  category: z.enum(['TALK', 'WORKSHOP', 'BUILD_NIGHT', 'STUDY_SESSION', 'HACKATHON', 'SOCIAL', 'OTHER']).default('OTHER'),
  plannedDate: z.iso.date().nullable().default(null), endDate: z.iso.date().nullable().default(null),
  startTime: z.iso.time({ precision: -1 }).nullable().default(null), endTime: z.iso.time({ precision: -1 }).nullable().default(null),
  placeType: z.enum(['SCHOOL', 'ONLINE', 'OTHER']).default('OTHER'), generalLocation: z.string().trim().max(300).default(''),
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

export function mountSiteAdmin(app: Express, pool: Pool) {
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
  const trustedOrigin: RequestHandler = (request, response, next) => {
    const origin = request.get('origin');
    const configuredOrigin = new URL(process.env.AUTH_BASE_URL ?? 'http://localhost:5173').origin;
    const extraOrigins = (process.env.AUTH_ADDITIONAL_ORIGINS ?? '').split(',').map(value => value.trim());
    const devLoopback = process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1):5173$/.test(origin ?? '');
    if (origin !== configuredOrigin && !extraOrigins.includes(origin ?? '') && !devLoopback) { response.status(403).json({ error: 'INVALID_ORIGIN' }); return; }
    next();
  };
  app.use('/api/admin', (_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
  app.get('/api/admin/session', (request, response) => response.json({ configured, authenticated: authenticated(request) }));
  app.post('/api/admin/login', trustedOrigin, (request, response) => {
    if (!configured) { response.status(503).json({ error: 'ADMIN_NOT_CONFIGURED' }); return; }
    const source = request.socket.remoteAddress ?? 'unknown';
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

  app.post('/api/admin/ideas', trustedOrigin, requireAdmin, async (request, response) => {
    const parsed = ideaInput.safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ error: 'INVALID_IDEA' }); return; }
    const { rows } = await pool.query('INSERT INTO ideas(title,description) VALUES($1,$2) RETURNING id', [parsed.data.title, parsed.data.description]);
    response.status(201).json({ id: rows[0]!.id });
  });
  app.patch('/api/admin/ideas/:id', trustedOrigin, requireAdmin, async (request, response) => {
    const parsedId = id.safeParse(request.params.id); const parsed = ideaInput.safeParse(request.body);
    if (!parsedId.success || !parsed.success) { response.status(400).json({ error: 'INVALID_IDEA' }); return; }
    const result = await pool.query('UPDATE ideas SET title=$2,description=$3,updated_at=NOW() WHERE id=$1 AND NOT hidden RETURNING id', [parsedId.data, parsed.data.title, parsed.data.description]);
    if (!result.rowCount) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    response.json({ id: parsedId.data });
  });

  app.post('/api/admin/events', trustedOrigin, requireAdmin, async (request, response) => {
    const parsed = eventInput.safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ error: 'INVALID_EVENT', issues: parsed.error.issues.map(issue => issue.message) }); return; }
    const input = parsed.data;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("INSERT INTO users(id,name,email,affiliation,email_verified) VALUES('site-admin','GSO Engineering Lab','site-admin@local.invalid','SYSTEM',false) ON CONFLICT (id) DO NOTHING");
      const activity = await client.query<{ id: number }>("INSERT INTO activities(type,title,description,owner_id,status) VALUES('EVENT',$1,$2,'site-admin','PLANNING') RETURNING id", [input.title, input.description]);
      const eventId = activity.rows[0]!.id;
      await client.query("INSERT INTO activity_seasons(activity_id,season_id) SELECT $1,id FROM seasons WHERE status='ACTIVE' ON CONFLICT DO NOTHING", [eventId]);
      await client.query(`INSERT INTO event_details(activity_id,category,planned_date,end_date,start_time,end_time,general_location,school_room_required,place_type)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [eventId, input.category, input.plannedDate, input.endDate, input.startTime, input.endTime,
          input.placeType === 'ONLINE' ? 'Online' : input.placeType === 'SCHOOL' ? 'GSO' : input.generalLocation, input.placeType === 'SCHOOL', input.placeType]);
      if (input.placeType === 'SCHOOL' && input.plannedDate && input.startTime && input.endTime) await client.query("INSERT INTO room_requests(activity_id,note) VALUES($1,'') ON CONFLICT DO NOTHING", [eventId]);
      await client.query('COMMIT');
      response.status(201).json({ id: eventId });
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  });
  app.patch('/api/admin/events/:id', trustedOrigin, requireAdmin, async (request, response) => {
    const parsedId = id.safeParse(request.params.id); const parsed = eventInput.safeParse(request.body);
    if (!parsedId.success || !parsed.success) { response.status(400).json({ error: 'INVALID_EVENT' }); return; }
    const input = parsed.data;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const previous = await client.query(`SELECT a.status, p.place_type AS "placeType", (p.planned_date,p.start_time,coalesce(p.end_date,p.planned_date),p.end_time)
        IS DISTINCT FROM ($2::date,$3::text,coalesce($4::date,$2::date),$5::text) AS rescheduled
        FROM activities a JOIN event_details p ON p.activity_id=a.id WHERE a.id=$1 AND a.type='EVENT' AND NOT a.hidden FOR UPDATE OF a`,
      [parsedId.data, input.plannedDate, input.startTime, input.endDate, input.endTime]);
      if (!previous.rowCount) { await client.query('ROLLBACK'); response.status(404).json({ error: 'NOT_FOUND' }); return; }
      if (['COMPLETED', 'CANCELLED'].includes(previous.rows[0]!.status) && previous.rows[0]!.rescheduled) { await client.query('ROLLBACK'); response.status(409).json({ error: 'EVENT_CLOSED' }); return; }
      if (previous.rows[0]!.placeType === 'SCHOOL' && input.placeType !== 'SCHOOL') {
        const confirmed = await client.query("SELECT 1 FROM room_requests WHERE activity_id=$1 AND status='CONFIRMED'", [parsedId.data]);
        if (confirmed.rowCount) { await client.query('ROLLBACK'); response.status(409).json({ error: 'CONFIRMATION_FINAL' }); return; }
        await client.query("DELETE FROM room_requests WHERE activity_id=$1 AND status<>'CONFIRMED'", [parsedId.data]);
      }
      if (previous.rows[0]!.rescheduled) {
        await client.query('INSERT INTO activity_interests(activity_id,user_id) SELECT event_id,user_id FROM event_going WHERE event_id=$1 ON CONFLICT DO NOTHING', [parsedId.data]);
        await client.query('DELETE FROM event_going WHERE event_id=$1', [parsedId.data]);
      }
      const status = ['COMPLETED', 'CANCELLED'].includes(previous.rows[0]!.status) ? previous.rows[0]!.status
        : previous.rows[0]!.rescheduled || (input.placeType === 'SCHOOL' && previous.rows[0]!.placeType !== 'SCHOOL') ? 'PLANNING' : previous.rows[0]!.status;
      await client.query('UPDATE activities SET title=$2,description=$3,status=$4,updated_at=NOW() WHERE id=$1', [parsedId.data, input.title, input.description, status]);
      await client.query(`UPDATE event_details SET category=$2,planned_date=$3,end_date=$4,start_time=$5,end_time=$6,general_location=$7,school_room_required=$8,place_type=$9 WHERE activity_id=$1`,
        [parsedId.data, input.category, input.plannedDate, input.endDate, input.startTime, input.endTime,
          input.placeType === 'ONLINE' ? 'Online' : input.placeType === 'SCHOOL' ? 'GSO' : input.generalLocation, input.placeType === 'SCHOOL', input.placeType]);
      if (input.placeType === 'SCHOOL' && input.plannedDate && input.startTime && input.endTime) await client.query("INSERT INTO room_requests(activity_id,note) VALUES($1,'') ON CONFLICT DO NOTHING", [parsedId.data]);
      await client.query('COMMIT'); response.json({ id: parsedId.data });
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  });
}

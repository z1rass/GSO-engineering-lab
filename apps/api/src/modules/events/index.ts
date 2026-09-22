import type { Express, Request, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';

import { webUrl } from '../../shared/validation/web-url.js';
const content = z.object({ title: z.string().trim().min(1).max(120), description: z.string().trim().min(1).max(5000),
  category: z.enum(['TALK','WORKSHOP','BUILD_NIGHT','STUDY_SESSION','HACKATHON','SOCIAL','OTHER']),
  plannedDate: z.iso.date().nullable().default(null), endDate: z.iso.date().nullable().default(null),
  startTime: z.iso.time({ precision: -1 }).nullable().default(null), endTime: z.iso.time({ precision: -1 }).nullable().default(null),
  generalLocation: z.string().trim().max(300).default(''), exactRoom: z.string().trim().max(300).default(''),
  repositoryUrl: webUrl.nullable().default(null), materials: z.string().max(5000).default(''),
  privateInstructions: z.string().max(5000).default(''), discordUrl: webUrl.nullable().default(null),
}).strict().refine(input => {
  if (input.endDate && (!input.plannedDate || input.endDate < input.plannedDate)) return false;
  if (input.startTime && input.endTime && (!input.endDate || input.endDate === input.plannedDate) && input.endTime <= input.startTime) return false;
  return true;
}, { message: 'End must follow start; an end date requires a start date' });
const idSchema = z.coerce.number().int().positive().max(2147483647);
const publicFields = `a.id, a.title, a.description, a.status, a.idea_id AS "ideaId", a.materials,
  a.created_at AS "createdAt", a.updated_at AS "updatedAt", p.category,
  p.planned_date::text AS "plannedDate", p.end_date::text AS "endDate", p.start_time AS "startTime", p.end_time AS "endTime",
  p.general_location AS "generalLocation", p.repository_url AS "repositoryUrl"`;
const eventFrom = "FROM activities a JOIN event_details p ON p.activity_id=a.id WHERE a.type='EVENT'";
export function mountEvents(app: Express, pool: Pool, requireMember: RequestHandler, getMember: (request: Request) => Promise<{ id: string } | null>) {
  app.use('/api/events', (_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
  app.get('/api/events', async (_request, response) => {
    response.json({ events: (await pool.query(`SELECT ${publicFields} ${eventFrom} ORDER BY a.id DESC`)).rows });
  });
  app.get('/api/events/:id', async (request, response) => {
    const id = idSchema.safeParse(request.params.id);
    if (!id.success) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    const member = await getMember(request);
    const fields = member ? `, json_build_object('id', u.id, 'name', u.name) AS owner, p.exact_room AS "exactRoom", a.private_instructions AS "privateInstructions", a.discord_url AS "discordUrl",
      (a.owner_id=$2 OR EXISTS(SELECT 1 FROM users WHERE id=$2 AND role='OPS')) AS "canEdit"` : '';
    const from = member ? eventFrom.replace('WHERE', 'JOIN users u ON u.id=a.owner_id WHERE') : eventFrom;
    const { rows } = await pool.query(`SELECT ${publicFields}${fields} ${from} AND a.id=$1`, member ? [id.data, member.id] : [id.data]);
    if (!rows[0]) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    response.json({ event: rows[0] });
  });
  app.post('/api/events', requireMember, async (request, response) => {
    const parsed = content.safeExtend({ ideaId: z.number().int().positive().max(2147483647).nullable().default(null) }).safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ error: 'INVALID_EVENT' }); return; }
    const input = parsed.data;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (input.ideaId !== null) {
        const idea = await client.query('SELECT id FROM ideas WHERE id=$1 FOR KEY SHARE', [input.ideaId]);
        if (!idea.rowCount) { await client.query('ROLLBACK'); response.status(400).json({ error: 'INVALID_IDEA' }); return; }
      }
      const activity = await client.query<{ id: number }>(`INSERT INTO activities(type,title,description,owner_id,materials,private_instructions,discord_url,idea_id)
        VALUES ('EVENT',$1,$2,$3,$4,$5,$6,$7) RETURNING id`, [input.title, input.description, response.locals.userId, input.materials, input.privateInstructions, input.discordUrl, input.ideaId]);
      const id = activity.rows[0]!.id;
      await client.query(`INSERT INTO event_details(activity_id,category,planned_date,end_date,start_time,end_time,general_location,exact_room,repository_url)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [id,input.category,input.plannedDate,input.endDate,input.startTime,input.endTime,input.generalLocation,input.exactRoom,input.repositoryUrl]);
      const result = await client.query(`SELECT ${publicFields} ${eventFrom} AND a.id=$1`, [id]);
      await client.query('COMMIT');
      response.status(201).json({ event: result.rows[0] });
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  });

  const requireEditor: RequestHandler = async (request, response, next) => {
    const id = idSchema.safeParse(request.params.id);
    if (!id.success) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    const result = await pool.query(`SELECT owner_id=$2 OR EXISTS(SELECT 1 FROM users WHERE id=$2 AND role='OPS') AS allowed
      FROM activities WHERE id=$1 AND type='EVENT'`, [id.data, response.locals.userId]);
    if (!result.rows[0]) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    if (!result.rows[0].allowed) { response.status(403).json({ error: 'EDITOR_REQUIRED' }); return; }
    response.locals.eventId = id.data;
    next();
  };
  app.patch('/api/events/:id', requireMember, requireEditor, async (request, response) => {
    const parsed = content.safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ error: 'INVALID_EVENT' }); return; }
    const input = parsed.data;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE activities SET title=$2,description=$3,materials=$4,private_instructions=$5,discord_url=$6,updated_at=NOW() WHERE id=$1',
        [response.locals.eventId,input.title,input.description,input.materials,input.privateInstructions,input.discordUrl]);
      await client.query(`UPDATE event_details SET category=$2,planned_date=$3,end_date=$4,start_time=$5,end_time=$6,general_location=$7,exact_room=$8,repository_url=$9 WHERE activity_id=$1`,
        [response.locals.eventId,input.category,input.plannedDate,input.endDate,input.startTime,input.endTime,input.generalLocation,input.exactRoom,input.repositoryUrl]);
      await client.query('COMMIT');
      response.json({ saved: true });
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  });
}

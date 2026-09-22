import type { Express, Request, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';

const webUrl = z.url().max(2000).refine(value => { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; });
const content = z.object({ title: z.string().trim().min(1).max(120), goal: z.string().trim().min(1).max(1000), description: z.string().trim().min(1).max(5000),
  techStack: z.array(z.string().trim().min(1).max(50)).max(30).default([]),
  repositoryUrl: webUrl.nullable().default(null), documentationUrl: webUrl.nullable().default(null),
  materials: z.string().max(5000).default(''), privateInstructions: z.string().max(5000).default(''), discordUrl: webUrl.nullable().default(null),
}).strict();
const idSchema = z.coerce.number().int().positive().max(2147483647);
const publicFields = `a.id, a.title, a.description, a.status, a.idea_id AS "ideaId", a.materials,
  a.created_at AS "createdAt", a.updated_at AS "updatedAt", p.goal, p.tech_stack AS "techStack",
  p.repository_url AS "repositoryUrl", p.documentation_url AS "documentationUrl"`;
const projectFrom = "FROM activities a JOIN project_details p ON p.activity_id=a.id WHERE a.type='PROJECT'";
export function mountProjects(app: Express, pool: Pool, requireMember: RequestHandler, getMember: (request: Request) => Promise<{ id: string } | null>) {
  app.use('/api/projects', (_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
  app.get('/api/projects', async (_request, response) => {
    response.json({ projects: (await pool.query(`SELECT ${publicFields} ${projectFrom} ORDER BY a.id DESC`)).rows });
  });
  app.get('/api/projects/:id', async (request, response) => {
    const id = idSchema.safeParse(request.params.id);
    if (!id.success) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    const member = await getMember(request);
    const fields = member ? `, json_build_object('id', u.id, 'name', u.name) AS owner, a.private_instructions AS "privateInstructions", a.discord_url AS "discordUrl",
      (a.owner_id=$2 OR EXISTS(SELECT 1 FROM users WHERE id=$2 AND role='OPS')) AS "canEdit"` : '';
    const from = member ? projectFrom.replace('WHERE', 'JOIN users u ON u.id=a.owner_id WHERE') : projectFrom;
    const { rows } = await pool.query(`SELECT ${publicFields}${fields} ${from} AND a.id=$1`, member ? [id.data, member.id] : [id.data]);
    if (!rows[0]) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    response.json({ project: rows[0] });
  });
  app.post('/api/projects', requireMember, async (request, response) => {
    const parsed = content.extend({ ideaId: z.number().int().positive().max(2147483647).nullable().default(null) }).safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ error: 'INVALID_PROJECT' }); return; }
    const input = parsed.data;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (input.ideaId !== null) {
        const idea = await client.query('SELECT id FROM ideas WHERE id=$1 FOR KEY SHARE', [input.ideaId]);
        if (!idea.rowCount) { await client.query('ROLLBACK'); response.status(400).json({ error: 'INVALID_IDEA' }); return; }
      }
      const activity = await client.query<{ id: number }>(`INSERT INTO activities(type,title,description,owner_id,materials,private_instructions,discord_url,idea_id)
        VALUES ('PROJECT',$1,$2,$3,$4,$5,$6,$7) RETURNING id`, [input.title, input.description, response.locals.userId, input.materials, input.privateInstructions, input.discordUrl, input.ideaId]);
      const id = activity.rows[0]!.id;
      await client.query('INSERT INTO project_details(activity_id,goal,tech_stack,repository_url,documentation_url) VALUES($1,$2,$3,$4,$5)', [id,input.goal,input.techStack,input.repositoryUrl,input.documentationUrl]);
      const result = await client.query(`SELECT ${publicFields} ${projectFrom} AND a.id=$1`, [id]);
      await client.query('COMMIT');
      response.status(201).json({ project: result.rows[0] });
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  });
  const requireEditor: RequestHandler = async (request, response, next) => {
    const id = idSchema.safeParse(request.params.id);
    if (!id.success) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    const result = await pool.query(`SELECT owner_id=$2 OR EXISTS(SELECT 1 FROM users WHERE id=$2 AND role='OPS') AS allowed
      FROM activities WHERE id=$1 AND type='PROJECT'`, [id.data, response.locals.userId]);
    if (!result.rows[0]) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    if (!result.rows[0].allowed) { response.status(403).json({ error: 'EDITOR_REQUIRED' }); return; }
    response.locals.projectId = id.data;
    next();
  };
  app.patch('/api/projects/:id', requireMember, requireEditor, async (request, response) => {
    const parsed = content.safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ error: 'INVALID_PROJECT' }); return; }
    const input = parsed.data;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE activities SET title=$2,description=$3,materials=$4,private_instructions=$5,discord_url=$6,updated_at=NOW() WHERE id=$1',
        [response.locals.projectId,input.title,input.description,input.materials,input.privateInstructions,input.discordUrl]);
      await client.query('UPDATE project_details SET goal=$2,tech_stack=$3,repository_url=$4,documentation_url=$5 WHERE activity_id=$1',
        [response.locals.projectId,input.goal,input.techStack,input.repositoryUrl,input.documentationUrl]);
      await client.query('COMMIT');
      response.json({ saved: true });
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  });
  app.post('/api/projects/:id/start', requireMember, requireEditor, async (request, response) => {
    if (!z.object({}).strict().safeParse(request.body).success) { response.status(400).json({ error: 'INVALID_TRANSITION' }); return; }
    const changed = await pool.query("UPDATE activities SET status='ACTIVE',updated_at=NOW() WHERE id=$1 AND status IN ('PLANNING','ACTIVE') RETURNING id", [response.locals.projectId]);
    if (!changed.rowCount) { response.status(409).json({ error: 'INVALID_TRANSITION' }); return; }
    response.json({ started: true });
  });

}

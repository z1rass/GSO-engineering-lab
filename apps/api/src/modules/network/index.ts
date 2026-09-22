import type { Express } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';

const idSchema = z.coerce.number().int().positive().max(2147483647);
const content = z.object({
  name: z.string().trim().min(1).max(120), company: z.string().trim().max(200).default(''),
  professionalRole: z.string().trim().max(200).default(''),
  topics: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  notes: z.string().trim().max(5000).default(''), contactMethod: z.string().trim().max(1000).default(''),
  source: z.string().trim().max(1000).default(''),
}).strict();
const fields = `c.id,c.name,c.company,c.professional_role AS "professionalRole",c.topics,c.notes,
  c.contact_method AS "contactMethod",c.source,c.created_at AS "createdAt",c.updated_at AS "updatedAt",
  CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object('id',u.id,'name',u.name) END AS "addedBy"`;

// Mounted after mountOps: every route inherits current Member + Ops checks and no-store.
export function mountNetwork(app: Express, pool: Pool) {
  app.get('/api/ops/network', async (_request, response) => {
    const result = await pool.query(`SELECT ${fields} FROM contacts c LEFT JOIN users u ON u.id=c.added_by ORDER BY c.name,c.id`);
    response.json({ contacts: result.rows });
  });
  app.get('/api/ops/network/:id', async (request, response) => {
    const id = idSchema.safeParse(request.params.id);
    if (!id.success) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    const result = await pool.query(`SELECT ${fields} FROM contacts c LEFT JOIN users u ON u.id=c.added_by WHERE c.id=$1`, [id.data]);
    if (!result.rowCount) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    response.json({ contact: result.rows[0] });
  });
  for (const method of ['post', 'patch'] as const) {
    app[method](method === 'post' ? '/api/ops/network' : '/api/ops/network/:id', async (request, response) => {
      const input = content.safeParse(request.body);
      const id = method === 'patch' ? idSchema.safeParse('id' in request.params ? request.params.id : undefined) : null;
      if (id && !id.success) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
      if (!input.success) { response.status(400).json({ error: 'INVALID_CONTACT' }); return; }
      const c = input.data; const values = [c.name, c.company, c.professionalRole, c.topics, c.notes, c.contactMethod, c.source];
      const result = method === 'post'
        ? await pool.query('INSERT INTO contacts(name,company,professional_role,topics,notes,contact_method,source,added_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id', [...values, response.locals.userId])
        : await pool.query('UPDATE contacts SET name=$1,company=$2,professional_role=$3,topics=$4,notes=$5,contact_method=$6,source=$7,updated_at=NOW() WHERE id=$8 RETURNING id', [...values, id?.data]);
      if (!result.rowCount) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
      response.status(method === 'post' ? 201 : 200).json({ contact: result.rows[0] });
    });
  }
  app.delete('/api/ops/network/:id', async (request, response) => {
    const id = idSchema.safeParse(request.params.id);
    if (!id.success) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    const result = await pool.query('DELETE FROM contacts WHERE id=$1 RETURNING id', [id.data]);
    if (!result.rowCount) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    response.json({ deleted: true });
  });
}

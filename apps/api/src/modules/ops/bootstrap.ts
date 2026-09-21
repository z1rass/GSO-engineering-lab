import { parseArgs } from 'node:util';
import { Pool } from 'pg';
import { z } from 'zod';

async function main() {
  const { values } = parseArgs({ options: { email: { type: 'string' }, 'confirmed-by': { type: 'string' }, operator: { type: 'string' } } });
  const input = z.object({ email: z.email().transform(value => value.toLowerCase()),
    'confirmed-by': z.string().trim().min(1).max(200), operator: z.string().trim().min(1).max(200),
  }).safeParse(values);
  if (!input.success || !process.env.DATABASE_URL) throw new Error('Usage: DATABASE_URL=… npm run ops:bootstrap --workspace @gso/api -- --email <school email> --confirmed-by <sponsor> --operator <server admin>');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Serialize bootstrap calls so simultaneous admins cannot both find zero Ops.
      await client.query('SELECT pg_advisory_xact_lock(73003)');
      const existing = await client.query("SELECT id FROM users WHERE role = 'OPS' LIMIT 1");
      if (existing.rowCount) throw new Error('Ops already exist. Use normal appointment inside the site; bootstrap is not recovery.');
      const target = await client.query<{ id: string }>("SELECT id FROM users WHERE email=$1 AND email_verified=true AND affiliation='MEMBER' FOR UPDATE", [input.data.email]);
      if (!target.rows[0]) throw new Error('Target must first sign in and verify their current GSO membership.');
      await client.query("UPDATE users SET role='OPS', updated_at=NOW() WHERE id=$1", [target.rows[0].id]);
      await client.query("INSERT INTO role_changes (target_id, previous_role, new_role, source, operator, confirmed_by) VALUES ($1,'MEMBER','OPS','BOOTSTRAP',$2,$3)", [target.rows[0].id, input.data.operator, input.data['confirmed-by']]);
      await client.query('COMMIT');
      console.log('Initial Ops appointed. The role change has been recorded.');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  } finally { await pool.end(); }
}
void main().catch(error => { console.error(error instanceof Error ? error.message : 'Bootstrap failed'); process.exitCode = 1; });

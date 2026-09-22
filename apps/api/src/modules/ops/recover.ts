import { parseArgs } from 'node:util';
import { Pool } from 'pg';
import { z } from 'zod';

const usage = 'Usage: DATABASE_URL=… npm run ops:recover --workspace @gso/api -- --emails <school email,...> --confirmed-by <sponsor> --operator <server admin> --handover-checklist <recorded checklist>';

async function main() {
  const { values } = parseArgs({ options: { emails: { type: 'string' }, 'confirmed-by': { type: 'string' }, operator: { type: 'string' }, 'handover-checklist': { type: 'string' } } });
  const parsed = z.object({
    emails: z.string().trim().min(1).transform(value => [...new Set(value.split(',').map(email => email.trim().toLowerCase()).filter(Boolean))]),
    'confirmed-by': z.string().trim().min(1).max(200), operator: z.string().trim().min(1).max(200),
    'handover-checklist': z.string().trim().min(1).max(2000),
  }).superRefine((value, context) => {
    if (!value.emails.length || value.emails.length > 20) context.addIssue({ code: 'custom', path: ['emails'], message: 'one to twenty emails required' });
    for (const email of value.emails) if (!z.email().safeParse(email).success || !email.endsWith('@gso.schule.koeln')) context.addIssue({ code: 'custom', path: ['emails'], message: 'school email required' });
  }).safeParse(values);
  if (!parsed.success || !process.env.DATABASE_URL) throw new Error(usage);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(73004)');
      const existing = await client.query("SELECT id FROM users WHERE role='OPS' AND affiliation='MEMBER' LIMIT 1");
      if (existing.rowCount) throw new Error('Ops still exist. Use normal appointment inside the site; recovery is only for lost access.');
      const targets = await client.query<{ id: string; email: string }>("SELECT id,email FROM users WHERE email = ANY($1::text[]) AND email_verified=true AND affiliation='MEMBER' AND blocked=false FOR UPDATE", [parsed.data.emails]);
      if (targets.rowCount !== parsed.data.emails.length) throw new Error('Every recovery target must be an existing verified Member with a school email.');
      for (const target of targets.rows) {
        await client.query("UPDATE users SET role='OPS', updated_at=NOW() WHERE id=$1", [target.id]);
        await client.query("INSERT INTO role_changes (target_id, previous_role, new_role, source, operator, confirmed_by, handover_checklist) VALUES ($1,'MEMBER','OPS','RECOVERY',$2,$3,$4)", [target.id, parsed.data.operator, parsed.data['confirmed-by'], parsed.data['handover-checklist']]);
      }
      await client.query('COMMIT');
      console.log(`Ops recovery completed for ${targets.rows.length} account(s). The role changes and sponsor confirmation are recorded.`);
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  } finally { await pool.end(); }
}
void main().catch(error => { console.error(error instanceof Error ? error.message : 'Recovery failed'); process.exitCode = 1; });

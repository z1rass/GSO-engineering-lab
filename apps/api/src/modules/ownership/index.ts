import { createHash, randomBytes } from 'node:crypto';
import type { Express, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { createMailTransport } from '../../shared/mail.js';

const idSchema = z.coerce.number().int().positive().max(2147483647);
const proposal = z.object({ email: z.email().max(320).transform(value => value.toLowerCase()) }).strict();
const decision = z.object({ transferId: z.number().int().positive().max(2147483647) }).strict();
const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

export function mountOwnership(app: Express, pool: Pool, requireMember: RequestHandler) {
  const mail = createMailTransport();
  const path = '/api/activities/:id/ownership';
  app.get(path, requireMember, async (request, response) => {
    const id = idSchema.safeParse(request.params.id);
    if (!id.success) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    const activity = (await pool.query("SELECT owner_id,status,EXISTS(SELECT 1 FROM users WHERE id=$2 AND role='OPS') AS ops FROM activities WHERE id=$1", [id.data, response.locals.userId])).rows[0];
    if (!activity) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    const isOwner = activity.owner_id === response.locals.userId;
    const pending = (await pool.query(`SELECT t.id,json_build_object('id',u.id,'name',u.name) AS recipient,
      json_build_object('id',o.id,'name',o.name) AS "fromOwner",true AS "canCancel"
      FROM ownership_transfers t JOIN users u ON u.id=t.recipient_id JOIN users o ON o.id=t.from_owner_id
      WHERE t.activity_id=$1 AND t.status='PENDING' AND ($3 OR t.recipient_id=$2)`, [id.data, response.locals.userId, isOwner || activity.ops])).rows[0] ?? null;
    response.json({ pending, canPropose: isOwner && ['PLANNING', 'ACTIVE'].includes(activity.status) });
  });

  app.post(path, requireMember, async (request, response) => {
    const id = idSchema.safeParse(request.params.id);
    const input = proposal.safeParse(request.body);
    if (!id.success) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    if (!input.success) { response.status(400).json({ error: 'INVALID_TRANSFER' }); return; }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const activity = (await client.query('SELECT owner_id,status,type,title FROM activities WHERE id=$1 FOR UPDATE', [id.data])).rows[0];
      if (!activity) { await client.query('ROLLBACK'); response.status(404).json({ error: 'NOT_FOUND' }); return; }
      if (activity.owner_id !== response.locals.userId) { await client.query('ROLLBACK'); response.status(403).json({ error: 'OWNER_REQUIRED' }); return; }
      if (!['PLANNING', 'ACTIVE'].includes(activity.status)) { await client.query('ROLLBACK'); response.status(409).json({ error: 'ACTIVITY_CLOSED' }); return; }
      const recipient = (await client.query("SELECT id,email FROM users WHERE lower(email)=$1 AND affiliation='MEMBER' AND email_verified=true FOR SHARE", [input.data.email])).rows[0];
      if (!recipient || recipient.id === activity.owner_id) { await client.query('ROLLBACK'); response.status(400).json({ error: 'INVALID_RECIPIENT' }); return; }
      if ((await client.query("SELECT 1 FROM ownership_transfers WHERE activity_id=$1 AND status='PENDING'", [id.data])).rowCount) {
        await client.query('ROLLBACK'); response.status(409).json({ error: 'TRANSFER_PENDING' }); return;
      }
      const token = randomBytes(32).toString('hex');
      const created = await client.query(`INSERT INTO ownership_transfers(activity_id,from_owner_id,recipient_id,token_hash,expires_at)
        VALUES($1,$2,$3,$4,NOW()+INTERVAL '7 days') RETURNING id`, [id.data, activity.owner_id, recipient.id, tokenHash(token)]);
      const link = new URL(`/ownership/accept?token=${token}`, process.env.AUTH_BASE_URL ?? 'http://localhost:5173').toString();
      await mail.sendMail({ from: process.env.SMTP_FROM ?? 'GSO engineering lab <lab@localhost>', to: recipient.email,
        subject: 'Verantwortung übernehmen / Transfer ownership — GSO engineering lab',
        text: `Du wurdest eingeladen, die Verantwortung für "${activity.title}" zu übernehmen. Öffne den Link und bestätige die Übergabe (7 Tage):\n${link}\n\nYou have been invited to own "${activity.title}". Open the link and confirm the transfer (7 days).\n\nWenn du das nicht möchtest, ignoriere diese Nachricht. / If you do not want this, ignore this email.` });
      await client.query('COMMIT');
      response.status(201).json({ transfer: { id: created.rows[0].id } });
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  });

  app.post(`${path}/cancel`, requireMember, async (request, response) => {
    const id = idSchema.safeParse(request.params.id);
    const input = decision.safeParse(request.body);
    if (!id.success) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    if (!input.success) { response.status(400).json({ error: 'INVALID_TRANSFER' }); return; }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const activity = (await client.query("SELECT owner_id,EXISTS(SELECT 1 FROM users WHERE id=$2 AND role='OPS') AS ops FROM activities WHERE id=$1 FOR UPDATE", [id.data, response.locals.userId])).rows[0];
      if (!activity) { await client.query('ROLLBACK'); response.status(404).json({ error: 'NOT_FOUND' }); return; }
      const transfer = (await client.query("SELECT * FROM ownership_transfers WHERE id=$1 AND activity_id=$2 AND status='PENDING' FOR UPDATE", [input.data.transferId, id.data])).rows[0];
      if (!transfer || transfer.from_owner_id !== activity.owner_id) { await client.query('ROLLBACK'); response.status(409).json({ error: 'TRANSFER_CHANGED' }); return; }
      if (activity.owner_id !== response.locals.userId && transfer.recipient_id !== response.locals.userId && !activity.ops) {
        await client.query('ROLLBACK'); response.status(403).json({ error: 'TRANSFER_MANAGER_REQUIRED' }); return;
      }
      await client.query("UPDATE ownership_transfers SET status='CANCELLED',resolved_at=NOW() WHERE id=$1", [input.data.transferId]);
      await client.query('COMMIT'); response.json({ saved: true });
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  });

  const invitationPath = '/api/ownership-invitations/:token';
  app.get(invitationPath, requireMember, async (request, response) => {
    const token = tokenSchema.safeParse(request.params.token);
    if (!token.success) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    const invitation = (await pool.query(`SELECT t.recipient_id,t.status,t.expires_at,a.id AS activity_id,a.title,a.type,a.status AS activity_status,o.name AS owner_name
      FROM ownership_transfers t JOIN activities a ON a.id=t.activity_id JOIN users o ON o.id=t.from_owner_id
      WHERE t.token_hash=$1`, [tokenHash(token.data)])).rows[0];
    if (!invitation || invitation.recipient_id !== response.locals.userId) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    if (invitation.status !== 'PENDING' || !['PLANNING', 'ACTIVE'].includes(invitation.activity_status) || new Date(invitation.expires_at) <= new Date()) {
      response.status(410).json({ error: 'INVITATION_UNAVAILABLE' }); return;
    }
    response.json({ invitation: { title: invitation.title, type: invitation.type, activityId: invitation.activity_id, fromOwner: invitation.owner_name } });
  });
  app.post(`${invitationPath}/accept`, requireMember, async (request, response) => {
    const token = tokenSchema.safeParse(request.params.token);
    if (!token.success) { response.status(404).json({ error: 'NOT_FOUND' }); return; }
    if (!z.object({}).strict().safeParse(request.body).success) { response.status(400).json({ error: 'INVALID_TRANSFER' }); return; }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const target = (await client.query('SELECT activity_id,recipient_id FROM ownership_transfers WHERE token_hash=$1', [tokenHash(token.data)])).rows[0];
      if (!target || target.recipient_id !== response.locals.userId) { await client.query('ROLLBACK'); response.status(404).json({ error: 'NOT_FOUND' }); return; }
      const activity = (await client.query('SELECT owner_id,status FROM activities WHERE id=$1 FOR UPDATE', [target.activity_id])).rows[0];
      const transfer = (await client.query('SELECT * FROM ownership_transfers WHERE token_hash=$1 FOR UPDATE', [tokenHash(token.data)])).rows[0];
      if (!activity || !transfer || transfer.status !== 'PENDING' || transfer.from_owner_id !== activity.owner_id || !['PLANNING', 'ACTIVE'].includes(activity.status) || new Date(transfer.expires_at) <= new Date()) {
        await client.query('ROLLBACK'); response.status(409).json({ error: 'TRANSFER_CHANGED' }); return;
      }
      const eligible = await client.query("SELECT 1 FROM users WHERE id=$1 AND affiliation='MEMBER' AND email_verified=true FOR SHARE", [response.locals.userId]);
      if (!eligible.rowCount) { await client.query('ROLLBACK'); response.status(403).json({ error: 'MEMBER_REQUIRED' }); return; }
      await client.query('UPDATE activities SET owner_id=$2,updated_at=NOW() WHERE id=$1', [target.activity_id, response.locals.userId]);
      await client.query("UPDATE ownership_transfers SET status='ACCEPTED',resolved_at=NOW() WHERE id=$1", [transfer.id]);
      await client.query('COMMIT'); response.json({ activityId: target.activity_id, saved: true });
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  });
}

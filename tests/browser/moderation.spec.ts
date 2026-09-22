import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
const url = process.env.TEST_DATABASE_URL ?? 'postgres://lab:lab_local@127.0.0.1:55433/lab_test';
if (!new URL(url).pathname.endsWith('_test')) throw new Error('Dedicated test database required');
const pool = new Pool({ connectionString: url });
test.beforeAll(async () => { await migrate(drizzle(pool), { migrationsFolder: './database/migrations' }); });
test.beforeEach(async () => { await pool.query('DELETE FROM rate_limits'); await pool.query('DELETE FROM activities'); await pool.query('DELETE FROM ideas'); });
test.afterAll(async () => { await pool.end(); });
async function login(page: Page, name: string, ops = false) {
  const email = `moderation-${randomUUID()}@gso.schule.koeln`;
  await page.goto('/login'); await page.getByLabel('Name', { exact: true }).fill(name); await page.getByLabel('Schul-E-Mail').fill(email);
  await page.getByRole('button', { name: 'Login-Link senden' }).click(); await expect(page.getByRole('status')).toContainText('Postfach');
  const box = await page.request.get(`http://127.0.0.1:8025/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`).then(r => r.json());
  const mail = await page.request.get(`http://127.0.0.1:8025/api/v1/message/${box.messages[0].ID}`).then(r => r.json()); await page.goto(mail.Text.match(/https?:\/\/\S+/)[0]);
  if (ops) await pool.query("UPDATE users SET role='OPS' WHERE email=$1", [email]);
}
test('Ops hide and restore content, then block a live Member session with a reason in DE/EN', async ({ page, browser }) => {
  const context = await browser.newContext(); const member = await context.newPage(); const name = `Member ${randomUUID().slice(0, 8)}`;
  try {
    await login(member, name); const idea = (await member.request.post('/api/ideas', { headers: { origin: 'http://127.0.0.1:5173' }, data: { title: 'Review this idea', description: 'Preserve this text' } }).then(r => r.json())).idea;
    await login(page, 'Moderation Ops', true); await page.goto('/ops'); await page.getByRole('link', { name: 'Moderation', exact: true }).click();
    const card = page.getByRole('article', { name: 'Review this idea', exact: true });
    await card.getByRole('button', { name: 'Ausblenden', exact: true }).click(); await card.getByLabel('Begründung', { exact: true }).fill('Bitte im Discord klären'); await card.getByRole('button', { name: 'Bestätigen', exact: true }).click();
    await expect(card.getByText('Ausgeblendet', { exact: true })).toBeVisible();
    await member.goto(`/ideas/${idea.id}`); await expect(member.locator('main')).not.toContainText('Preserve this text');
    await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('button', { name: 'English' }).click();
    await card.getByRole('button', { name: 'Restore', exact: true }).click(); await card.getByLabel('Reason', { exact: true }).fill('Resolved'); await card.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(card.getByText('Visible', { exact: true })).toBeVisible(); await member.reload(); await expect(member.getByText('Preserve this text', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Members', exact: true }).click();
    const user = page.getByRole('article', { name, exact: true }); await user.getByRole('button', { name: 'Block changes', exact: true }).click();
    await user.getByLabel('Reason', { exact: true }).fill('Contact Ops in Discord'); await user.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(user.getByText('Blocked', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const denied = await member.request.post('/api/ideas', { headers: { origin: 'http://127.0.0.1:5173' }, data: { title: 'No bypass', description: 'Existing session' } }); expect(denied.status()).toBe(403);
    await member.goto('/profile'); await expect(member.getByRole('alert')).toContainText('Contact Ops in Discord');
    await expect(member.getByRole('button', { name: 'Profil speichern', exact: true })).toHaveCount(0);
    await page.getByText('Moderation history', { exact: true }).click(); await expect(page.getByRole('region', { name: 'Moderation history' })).toContainText('Contact Ops in Discord');
  } finally { await context.close(); }
});

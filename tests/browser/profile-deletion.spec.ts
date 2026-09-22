import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL ?? 'postgres://lab:lab_local@127.0.0.1:55433/lab_test' });
test.beforeAll(async () => { await migrate(drizzle(pool), { migrationsFolder: './database/migrations' }); });
test.beforeEach(async () => { await pool.query('DELETE FROM rate_limits'); await pool.query('DELETE FROM activities'); await pool.query('DELETE FROM ideas'); });
test.afterAll(async () => { await pool.end(); });
async function login(page: Page, name: string, ops = false) {
  const email = `deletion-${randomUUID()}@gso.schule.koeln`;
  await page.goto('/login'); await page.getByLabel('Name', { exact: true }).fill(name); await page.getByLabel('Schul-E-Mail').fill(email); await page.getByRole('button', { name: 'Login-Link senden' }).click();
  let box: { messages: { ID: string }[] } = { messages: [] };
  for (let attempt = 0; attempt < 20 && !box.messages.length; attempt += 1) { box = await page.request.get(`http://127.0.0.1:8025/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`).then(r => r.json()); if (!box.messages.length) await page.waitForTimeout(100); }
  const first = box.messages[0]; if (!first) throw new Error('Magic link email did not arrive');
  const mail = await page.request.get(`http://127.0.0.1:8025/api/v1/message/${first.ID}`).then(r => r.json()); await page.goto(mail.Text.match(/https?:\/\/\S+/)[0]);
  if (ops) await pool.query("UPDATE users SET role='OPS' WHERE email=$1", [email]);
}
test('Ops removes a profile only after choosing every active responsibility', async ({ page, browser }) => {
  const context = await browser.newContext(); const member = await context.newPage(); const name = `Remove ${randomUUID().slice(0, 8)}`;
  try {
    await login(member, name); const project = (await member.request.post('/api/projects', { headers: { origin: 'http://127.0.0.1:5173' }, data: { title: 'Responsibility to resolve', description: 'Keep result', goal: 'Build' } }).then(r => r.json())).project;
    await login(page, 'Deletion Ops', true); await page.goto('/ops'); await page.getByText(name, { exact: true }).locator('..').getByRole('link', { name: 'Profil entfernen', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Profil über Ops entfernen' })).toBeVisible(); await expect(page.getByText('Responsibility to resolve', { exact: true })).toBeVisible();
    const checkbox = page.getByRole('checkbox'); await expect(checkbox).not.toBeChecked(); await checkbox.check(); await page.getByRole('button', { name: 'Profil entfernen', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('alte Sitzung'); await member.goto('/profile'); await expect(member).toHaveURL(/login/);
    expect(project.id).toBeGreaterThan(0);
  } finally { await context.close(); }
});

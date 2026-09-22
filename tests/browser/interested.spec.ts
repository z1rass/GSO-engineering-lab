import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
const databaseUrl = process.env.TEST_DATABASE_URL ?? 'postgres://lab:lab_local@127.0.0.1:55433/lab_test';
if (!new URL(databaseUrl).pathname.endsWith('_test')) throw new Error('Dedicated test database required');
const pool = new Pool({ connectionString: databaseUrl });
test.beforeAll(async () => { await migrate(drizzle(pool), { migrationsFolder: './database/migrations' }); });
test.beforeEach(async () => { await pool.query('DELETE FROM activities'); await pool.query('DELETE FROM ideas'); await pool.query('DELETE FROM rate_limits'); });
test.afterAll(async () => { await pool.end(); });
test('Member toggles Interested on all targets, with persistence, public counts and recoverable errors', async ({ page, browser, request }) => {
  const email = `project-${randomUUID()}@gso.schule.koeln`;
  await page.goto('/login');
  await page.getByLabel('Name', { exact: true }).fill('Private owner');
  await page.getByLabel('Schul-E-Mail').fill(email);
  await page.getByRole('button', { name: 'Login-Link senden' }).click();
  await expect(page.getByRole('status')).toContainText('Postfach');
  const box = await request.get(`http://127.0.0.1:8025/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`).then(r => r.json());
  const mail = await request.get(`http://127.0.0.1:8025/api/v1/message/${box.messages[0].ID}`).then(r => r.json());
  await page.goto(mail.Text.match(/https?:\/\/\S+/)[0]);
  const inputs = [
    { kind: 'ideas', body: { title: 'Interest idea', description: 'No responsibility' }, key: 'idea' },
    { kind: 'projects', body: { title: 'Interest project', goal: 'Build', description: 'No membership' }, key: 'project' },
    { kind: 'events', body: { title: 'Interest event', category: 'TALK', description: 'No registration' }, key: 'event' },
  ];
  const visitor = await browser.newContext();
  try {
    const publicPage = await visitor.newPage();
    for (const input of inputs) {
      const response = await page.request.post(`/api/${input.kind}`, { headers: { origin: 'http://127.0.0.1:5173' }, data: input.body });
      expect(response.status()).toBe(201);
      const id = (await response.json())[input.key].id;
      const path = `/${input.kind}/${id}`;
      await page.goto(path);
      await expect(page.getByText('0 Interessierte', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Interessiert', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Interessiert', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await page.reload();
      await expect(page.getByText('1 interessiert', { exact: true })).toBeVisible();
      await publicPage.goto(`http://127.0.0.1:5173${path}`);
      await expect(publicPage.getByText('1 interessiert', { exact: true })).toBeVisible();
      await expect(publicPage.getByRole('button', { name: 'Interessiert', exact: true })).toHaveCount(0);
      await page.route(`**/api${path}/interested`, async route => {
        if (route.request().method() === 'DELETE') await route.fulfill({ status: 503, json: { error: 'Unavailable' } });
        else await route.continue();
      });
      await page.getByRole('button', { name: 'Interessiert', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText('nicht gespeichert');
      await expect(page.getByText('1 interessiert', { exact: true })).toBeVisible();
      await page.unroute(`**/api${path}/interested`);
      await page.getByRole('button', { name: 'English' }).click();
      await page.getByRole('button', { name: 'Interested', exact: true }).click();
      await expect(page.getByText('0 interested', { exact: true })).toBeVisible();
      await expect(page.getByText('Interest only — no registration, team membership or responsibility.', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Deutsch' }).click();
    }
  } finally { await visitor.close(); }
});

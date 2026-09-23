import { test, expect } from '@playwright/test';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const databaseUrl = process.env.TEST_DATABASE_URL ?? 'postgres://lab:lab_local@127.0.0.1:55433/lab_test';
if (!new URL(databaseUrl).pathname.endsWith('_test')) throw new Error('Browser tests need an isolated _test database.');
const pool = new Pool({ connectionString: databaseUrl });
test.beforeAll(async () => { await migrate(drizzle(pool), { migrationsFolder: './database/migrations' }); });
test.beforeEach(async () => { await pool.query('DELETE FROM seasons'); });
test.afterAll(async () => { await pool.end(); });

test('Visitor sees the stored Season on mobile and changes the interface language without translating content', async ({ page }) => {
  await pool.query(`INSERT INTO seasons (number, title, description, starts_on, ends_on, status)
    VALUES (4, 'Robotics Together', 'Gemeinsam Roboter bauen.', '2027-03-01', '2027-04-30', 'ACTIVE')`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: 'Robotics Together' })).toBeVisible();
  await expect(page.getByText('Aktuelle Season', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByText('Current season', { exact: true })).toBeVisible();
  await expect(page.getByText('Gemeinsam Roboter bauen.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Robotics Together' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('Visitor sees a useful empty state in both languages when no Season is active', async ({ page }) => {
  await page.goto('/season');
  await expect(page.getByRole('heading', { name: 'Die nächste Season entsteht.' })).toBeVisible();
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('heading', { name: 'The next season is taking shape.' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to home' }).click();
  await expect(page.getByRole('heading', { name: 'What’s happening in the Lab?' })).toBeVisible();
});

test('Visitor can retry a failed Season request instead of seeing an endless loading message', async ({ page }) => {
  await page.route('**/api/seasons/current', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' }));
  await page.goto('/home');
  await expect(page.getByRole('alert')).toContainText('Die Season konnte nicht geladen werden.');
  await page.unroute('**/api/seasons/current');
  await page.getByRole('button', { name: 'Erneut versuchen' }).click();
  await expect(page.getByRole('heading', { name: 'Die nächste Season entsteht.' })).toBeVisible();
});

test('English remains selected when navigating from Season to the landing', async ({ page }) => {
  await page.goto('/season');
  await page.getByRole('button', { name: 'English' }).click();
  await page.getByRole('link', { name: 'GSO Engineering Lab' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'A place for people who want to explore technology beyond class.' })).toBeVisible();
  await expect(page.getByText('LEARN / BUILD / SHARE', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Deutsch' }).click();
  await expect(page.getByText('LERNEN / BAUEN / TEILEN', { exact: true })).toBeVisible();
});

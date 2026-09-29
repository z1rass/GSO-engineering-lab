import { expect, test } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

const databasePath = resolve('test-results/public-site.sqlite');
const marker = `Browser flow ${Date.now()}`;
test.afterAll(() => {
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA foreign_keys = ON');
  db.prepare('DELETE FROM events WHERE title LIKE ?').run(`${marker}%`);
  db.prepare('DELETE FROM ideas WHERE title LIKE ?').run(`${marker}%`);
  db.close();
});

test('public ideas and direct admin event management', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Verwalten|Manage/ })).toHaveCount(0);
  await page.goto('/ideas');
  await page.getByRole('link', { name: 'Idee hinzufügen' }).click();
  await page.getByRole('textbox', { name: 'Titel' }).fill(`${marker} idea`);
  await page.getByRole('textbox', { name: 'Beschreibe deine Idee' }).fill('Build something together.');
  await page.getByRole('button', { name: 'Idee veröffentlichen' }).click();
  await expect(page.getByRole('heading', { name: `${marker} idea` })).toBeVisible();
  await page.getByRole('button', { name: /Stimme geben/ }).click();
  await expect(page.getByRole('button', { name: /Stimme entfernen/ })).toContainText('1');
  await page.reload();
  await expect(page.getByRole('button', { name: /Stimme entfernen/ })).toContainText('1');

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Admin-Zugang' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Passwort' }).fill('a-local-admin-password-for-browser-tests');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.getByRole('link', { name: 'Event erstellen' }).click();
  await page.getByPlaceholder('Titel').fill(`${marker} event`);
  await page.locator('input[name="generalLocation"]').fill('B102');
  await page.locator('button[data-picker-name="plannedDate"]').click();
  await page.getByRole('dialog', { name: 'Datum' }).getByRole('button', { name: 'Heute' }).click();
  await page.locator('button[data-picker-name="startTime"]').click();
  await page.getByRole('dialog', { name: 'Beginn' }).getByRole('button', { name: '10:00' }).click();
  await page.locator('button[data-picker-name="endTime"]').click();
  await page.getByRole('dialog', { name: 'Ende' }).getByRole('button', { name: '12:00' }).click();
  await page.getByRole('button', { name: 'Vorlage 2' }).click();
  await page.getByRole('textbox', { name: 'Beschreibung' }).fill('Bring a laptop.');
  await page.getByRole('button', { name: 'Veröffentlichen' }).click();
  await expect(page.getByRole('heading', { name: `${marker} event` })).toBeVisible();
  await expect(page.getByText('B102')).toBeVisible();
  await expect(page.getByText('In Planung')).toHaveCount(0);
  await page.goto('/admin');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('listitem').filter({ hasText: `${marker} event` }).getByRole('button', { name: 'Entfernen' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: `${marker} event` })).toHaveCount(0);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('listitem').filter({ hasText: `${marker} idea` }).getByRole('button', { name: 'Entfernen' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: `${marker} idea` })).toHaveCount(0);
});

test('idea flow and admin form fit a narrow phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/ideas');
  await expect(page.getByRole('link', { name: 'Idee hinzufügen' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Idee hinzufügen' }).click();
  await expect(page.getByRole('textbox', { name: 'Beschreibe deine Idee' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto('/admin');
  await page.getByLabel('Passwort').fill('a-local-admin-password-for-browser-tests');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.getByRole('link', { name: 'Event erstellen' }).click();
  await expect(page.getByRole('button', { name: 'Vorlage 1' })).toBeVisible();
  await expect(page.locator('input[name="generalLocation"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

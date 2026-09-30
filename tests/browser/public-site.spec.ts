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
  await expect(page.getByRole('heading', { name: 'Technik ist besser, wenn wir sie gemeinsam machen.' })).toBeVisible();
  await expect(page.locator('.landing-feature-copy').getByText('Eine Tech-Community an der GSO für gemeinsame Projekte, Events, Lernen und Austausch rund um moderne Technologien.')).toBeVisible();
  await expect(page.getByRole('link', { name: /Verwalten|Manage/ })).toHaveCount(0);
  await page.goto('/ideas');
  await page.getByRole('link', { name: 'Idee hinzufügen' }).click();
  const selectedIdeaCover = await page.locator('.idea-form-preview img').getAttribute('src');
  const selectedIdeaTone = await page.locator('.public-idea-stage').getAttribute('data-tone');
  const selectedIdeaBackground = await page.locator('.showcase-app').evaluate(element => getComputedStyle(element).getPropertyValue('--page-bg').trim());
  await page.getByRole('textbox', { name: 'Deine Idee in einem Satz' }).fill(`${marker} idea`);
  await page.getByRole('textbox', { name: 'Erzähl uns mehr' }).fill('Build something together.');
  await page.getByRole('button', { name: 'Idee veröffentlichen' }).click();
  await expect(page.getByRole('heading', { name: `${marker} idea` })).toBeVisible();
  const ideaPath = new URL(page.url()).pathname;
  const ideaHtml = await page.request.get(ideaPath).then(response => response.text());
  expect(ideaHtml).toContain(`<meta property="og:title" content="${marker} idea" />`);
  expect(ideaHtml).toContain(`<meta property="og:url" content="http://127.0.0.1:5174${ideaPath}" />`);
  expect((await page.request.get(`/api/share${ideaPath}/image.jpg`)).headers()['content-type']).toContain('image/jpeg');
  const forwardedIdeaHtml = await page.request.get(ideaPath, {
    headers: { 'x-forwarded-host': 'lab.example.org', 'x-forwarded-proto': 'https' },
  }).then(response => response.text());
  expect(forwardedIdeaHtml).toContain(`<meta property="og:image" content="https://lab.example.org/api/share${ideaPath}/image.jpg?v=2-`);
  await expect(page.locator('.idea-story .story-cover')).toHaveAttribute('src', selectedIdeaCover!);
  await expect(page.locator('.idea-story')).toHaveAttribute('data-tone', selectedIdeaTone!);
  expect(await page.locator('.showcase-app').evaluate(element => getComputedStyle(element).getPropertyValue('--page-bg').trim())).toBe(selectedIdeaBackground);
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
  await page.getByRole('button', { name: 'Vorlage 7' }).click();
  await page.getByRole('textbox', { name: 'Beschreibung' }).fill('Bring a laptop.');
  await page.getByRole('button', { name: 'Veröffentlichen' }).click();
  await expect(page.getByRole('heading', { name: `${marker} event` })).toBeVisible();
  await expect(page.getByText('B102')).toBeVisible();
  await expect(page.getByText('In Planung')).toHaveCount(0);
  await page.goto('/events');
  await page.getByRole('link', { name: new RegExp(`${marker} event`) }).click();
  const eventPath = new URL(page.url()).pathname;
  const eventHtml = await page.request.get(eventPath).then(response => response.text());
  expect(eventHtml).toContain(`<meta property="og:title" content="${marker} event" />`);
  expect(eventHtml).toContain(`<meta property="og:url" content="http://127.0.0.1:5174${eventPath}" />`);
  expect(eventHtml).toContain(`<meta property="og:image" content="http://127.0.0.1:5174/api/share${eventPath}/image.jpg?v=2-`);
  expect((await page.request.get(`/api/share${eventPath}/image.jpg`)).headers()['content-type']).toContain('image/jpeg');
  await page.getByRole('button', { name: 'Ich bin dabei' }).click();
  await expect(page.getByText('1 Person ist dabei')).toBeVisible();
  await page.reload();
  await expect(page.getByText('1 Person ist dabei')).toBeVisible();
  await page.getByRole('button', { name: 'Zusage zurücknehmen' }).click();
  await expect(page.getByText('Sei dabei')).toBeVisible();
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
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto('/ideas');
  await expect(page.getByRole('link', { name: 'Idee hinzufügen' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Idee hinzufügen' }).click();
  await expect(page.getByRole('textbox', { name: 'Erzähl uns mehr' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto('/admin');
  await page.getByLabel('Passwort').fill('a-local-admin-password-for-browser-tests');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.getByRole('link', { name: 'Event erstellen' }).click();
  await expect(page.getByRole('button', { name: 'Vorlage 1', exact: true })).toBeVisible();
  await expect(page.locator('input[name="generalLocation"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('idea preview chooses one cover for the form', async ({ page }) => {
  await page.goto('/ideas/new');
  const title = page.getByRole('textbox', { name: 'Deine Idee in einem Satz' });
  const cover = page.locator('.idea-form-preview img');
  const initialCover = await cover.getAttribute('src');
  const initialTone = await page.locator('.public-idea-stage').getAttribute('data-tone');
  expect(initialCover).not.toBeNull();
  for (const letter of 'Robotik') {
    await title.pressSequentially(letter);
    await expect(cover).toHaveAttribute('src', initialCover!);
    await expect(page.locator('.public-idea-stage')).toHaveAttribute('data-tone', initialTone!);
  }
  await title.blur();
  await expect(cover).toHaveAttribute('src', initialCover!);
});

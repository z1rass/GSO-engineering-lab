import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createApp } from '../src/app.js';

const databaseUrl = process.env.TEST_DATABASE_URL ?? 'postgres://lab:lab_local@127.0.0.1:55433/lab_test';
if (!new URL(databaseUrl).pathname.endsWith('_test')) {
  throw new Error('Integration tests require a dedicated database ending in _test.');
}
const pool = new Pool({ connectionString: databaseUrl });
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  await migrate(drizzle(pool), { migrationsFolder: '../../database/migrations' });
  server = createApp(pool).listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

beforeEach(async () => { await pool.query('DELETE FROM seasons'); });
afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await pool.end();
});

test('Visitor discovers the active Season from persisted data, not a draft or hardcoded demo', async () => {
  await pool.query(`INSERT INTO seasons (number, title, description, starts_on, ends_on, status)
    VALUES (12, 'Network Builders', 'Build a network together.', '2027-03-01', '2027-04-30', 'ACTIVE'),
           (13, 'Private draft', 'Not published.', '2027-05-01', '2027-06-30', 'DRAFT')`);
  const response = await fetch(`${baseUrl}/api/seasons/current`);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ season: {
    id: expect.any(Number), number: 12, title: 'Network Builders', description: 'Build a network together.',
    startsOn: '2027-03-01', endsOn: '2027-04-30', status: 'ACTIVE',
  } });
});

test('Visitor receives an explicit empty state when only unpublished or finished Seasons exist', async () => {
  await pool.query(`INSERT INTO seasons (number, title, description, starts_on, ends_on, status)
    VALUES (1, 'Unpublished', 'Private', '2027-01-01', '2027-02-28', 'DRAFT'),
           (2, 'Past', 'Finished', '2026-01-01', '2026-02-28', 'FINISHED')`);
  const response = await fetch(`${baseUrl}/api/seasons/current`);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ season: null });
});

test('A database failure returns a generic service-unavailable response without SQL or connection details', async () => {
  const unavailableUrl = new URL(databaseUrl);
  unavailableUrl.pathname = '/gso_deliberately_absent_test';
  const unavailablePool = new Pool({ connectionString: unavailableUrl.toString(), connectionTimeoutMillis: 1000 });
  const unavailableServer = createApp(unavailablePool).listen(0, '127.0.0.1');
  await once(unavailableServer, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${(unavailableServer.address() as AddressInfo).port}/api/seasons/current`);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Season temporarily unavailable' });
  } finally {
    await new Promise<void>(resolve => unavailableServer.close(() => resolve()));
    await unavailablePool.end();
  }
});

test('Process health is available independently of Season data', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok' });
});

import { Pool } from 'pg';
import { z } from 'zod';
import { createApp } from './app.js';

const config = z.object({
  DATABASE_URL: z.string().url().default('postgres://lab:lab_local@127.0.0.1:55432/lab'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
}).parse(process.env);

const pool = new Pool({ connectionString: config.DATABASE_URL, connectionTimeoutMillis: 3000 });
const server = createApp(pool).listen(config.PORT, '0.0.0.0', () => {
  console.log(`GSO API listening on ${config.PORT}`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => {
    server.close(() => { void pool.end(); });
  });
}

import { z } from 'zod';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { openDatabase } from './database/index.js';

if (process.env.NODE_ENV !== 'production') {
  const localEnv = fileURLToPath(new URL('../../../.env.local', import.meta.url));
  if (existsSync(localEnv)) process.loadEnvFile(localEnv);
}

const config = z.object({
  SQLITE_PATH: z.string().min(1).default('../../data/lab.sqlite'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
}).parse(process.env);

const db = openDatabase(config.SQLITE_PATH);
const server = createApp(db).listen(config.PORT, '0.0.0.0', () => {
  console.log(`GSO API listening on ${config.PORT}`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => {
    server.close(() => db.close());
  });
}

import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createServer } from 'vite';
import { sharePreview } from '../../apps/web/share-preview.js';

test('detail links do not serve generic site metadata when the API is unavailable', async () => {
  const server = await createServer({
    configFile: false,
    root: resolve('apps/web'),
    plugins: [sharePreview('http://127.0.0.1:1')],
    server: { host: '127.0.0.1', port: 0 },
  });
  try {
    await server.listen();
    const address = server.httpServer?.address() as AddressInfo;
    for (const path of ['/events/2', '/ideas/5']) {
      const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
      expect(response.status).toBe(503);
      expect(await response.text()).not.toContain('gemeinsam Technik lernen, Projekte bauen');
    }
  } finally {
    await server.close();
  }
});

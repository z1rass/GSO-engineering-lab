import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5174', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'npm run dev:api', url: 'http://127.0.0.1:3002/api/health', reuseExistingServer: false,
      env: { PORT: '3002', AUTH_BASE_URL: 'http://127.0.0.1:5174', ADMIN_PASSWORD: 'a-local-admin-password-for-browser-tests', ADMIN_SESSION_SECRET: 'browser-test-secret-with-more-than-thirty-two-characters', SQLITE_PATH: resolve('test-results/public-site.sqlite') } },
    { command: 'npm run dev --workspace @gso/web -- --port 5174', url: 'http://127.0.0.1:5174', reuseExistingServer: false,
      env: { API_PROXY_TARGET: 'http://127.0.0.1:3002' } },
  ],
});

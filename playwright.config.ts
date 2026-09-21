import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'npm run dev:api', url: 'http://127.0.0.1:3001/api/health', reuseExistingServer: false,
      env: { AUTH_BASE_URL: 'http://127.0.0.1:5173', DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://lab:lab_local@127.0.0.1:55433/lab_test' } },
    { command: 'npm run dev:web', url: 'http://127.0.0.1:5173', reuseExistingServer: false },
  ],
});

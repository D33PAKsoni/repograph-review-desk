import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4310',
    viewport: { width: 1366, height: 900 },
    launchOptions: process.env.REVIEW_DESK_BROWSER ? { executablePath: process.env.REVIEW_DESK_BROWSER } : {},
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node ../deployment/test-server.mjs',
    url: 'http://127.0.0.1:4310/api/v1/health',
    reuseExistingServer: false,
    timeout: 15000,
  },
});

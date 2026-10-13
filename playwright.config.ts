import { defineConfig, devices } from '@playwright/test';

// Дымовые e2e: гоняем собранный статический сайт (astro preview).
// Бэкенд не нужен: тренажёр считается в клиенте, журнал — локальная очередь.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:4333/informatika/',
  },
  webServer: {
    command: 'node ./e2e/server.mjs',
    url: 'http://localhost:4333/informatika/',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
    env: { E2E_PORT: '4333' },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});

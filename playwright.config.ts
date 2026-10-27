import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
/** Point at an already-running server (e.g. your `pnpm dev`) instead of starting one. */
const existing = process.env.E2E_BASE_URL;
/** CI tests the production build (`pnpm build` first), closer to what Vercel serves than `next dev`. */
const ci = !!process.env.CI;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 2 : 0,
  reporter: ci ? [['list'], ['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: existing ?? `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: existing
    ? undefined
    : {
        command: `pnpm ${ci ? 'start' : 'dev'} --port ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !ci,
        timeout: 120_000,
      },
});

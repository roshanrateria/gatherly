import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration notes:
 *  - Uses the system Edge channel (`msedge`): no Playwright-managed browser
 *    downloads are required on this machine.
 *  - Specs live in tests/e2e and use the .spec.mjs suffix so the unit-test
 *    glob (`tsx --test`) never double-runs them.
 *  - The dev server is started automatically; an already-running instance is
 *    reused for fast iteration.
 *  - Two projects cover desktop and mobile form factors end to end.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.mjs',
  fullyParallel: true,
  timeout: 90_000,
  expect: { timeout: 12_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    channel: 'msedge',
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});

import { defineConfig, devices } from '@playwright/test';

const port = process.env.CI ? 3000 : 4000;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './playwright-results',
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }]],
  // Retry timing-only failures (hydration races, cold-compile) instead of
  // failing the build; also makes trace: 'on-first-retry' capture anything.
  retries: process.env.CI ? 2 : 1,
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: process.env.CI ? 'npx serve ./out -l 3000' : 'npm run dev',
    port,
    reuseExistingServer: !process.env.CI,
  },
});

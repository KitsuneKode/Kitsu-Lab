import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT ?? 3400)

/**
 * Browser tests for the book reader — the behaviour unit tests cannot see:
 * turning, spreads, fullscreen chrome, resume, device layouts.
 *
 * Runs against a production build (`npm run build` first). Uses the
 * installed Chrome, so no browser download is needed; set
 * E2E_BASE_URL to test an already-running server instead.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`,
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    {
      name: 'phone',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        port: PORT,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
})

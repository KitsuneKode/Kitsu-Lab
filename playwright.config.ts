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
  // Baselines live next to the specs, one set, made in the Playwright image.
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFileName}/{arg}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.002 } },
  projects: [
    {
      name: 'desktop',
      testIgnore: '**/visual.e2e.ts',
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'phone',
      testIgnore: '**/visual.e2e.ts',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
    },
    {
      // Only inside mcr.microsoft.com/playwright (see package.json), with
      // its bundled Chromium, so pixels match between laptops and CI.
      name: 'visual',
      testMatch: '**/visual.e2e.ts',
      use: { channel: 'chromium' },
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

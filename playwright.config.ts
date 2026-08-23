import { defineConfig, devices } from '@playwright/test'

// E2E config for the web workspace. Requires browsers: `npx playwright install`.
//
// The dev server starts automatically on a DEDICATED port, not Vite's default:
// 5173 is very often already occupied by some other project, and
// `reuseExistingServer` would then silently run the whole suite against a
// stranger's app (which is exactly what happened once). With a port of our own,
// "reuse" means reusing our own server.
const E2E_PORT = Number(process.env.E2E_PORT ?? 5199)
const E2E_URL = `http://localhost:${E2E_PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: E2E_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --port ${E2E_PORT} --strict-port`,
    url: E2E_URL,
    reuseExistingServer: !process.env.CI,
    // The import flow is gated on a configured API. Point the dev server at a
    // host nothing listens on: every call is mocked with page.route, so a real
    // request would be a test bug rather than a flake.
    env: { VITE_API_URL: 'http://api.test' },
    timeout: 120_000,
  },
})

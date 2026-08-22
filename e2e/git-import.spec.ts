import { test, expect, type Page } from '@playwright/test'

// Phase acceptance for the Git Import / Retrofit engine:
//
//   connect GitHub → select a React/Tailwind repo with a config the static
//   reader cannot fully evaluate → the workspace populates with Extracted and
//   Inferred tokens → no dead end → export, or (Pro) a retrofit PR.
//
// The API is mocked at `page.route`, so these are the real SPA and the real
// extraction (which runs in the browser) against a fixed scan payload.

const SESSION = 'e2e-jwt'

/** A config that spreads an imported preset and reads process.env. */
const TAILWIND_CONFIG = `import type { Config } from 'tailwindcss'
import basePreset from '@acme/tailwind-preset'
import plugin from 'tailwindcss/plugin'

const config: Config = {
  darkMode: 'class',
  theme: {
    extend: {
      ...basePreset.theme.extend,
      colors: {
        ...basePreset.theme.colors,
        env: process.env.BRAND_COLOR,
        brand: '#C8813D',
        ink: '#1F1D1A',
      },
      borderRadius: { lg: '0.75rem' },
      fontFamily: { sans: ['Satoshi', 'sans-serif'] },
    },
  },
  plugins: [plugin(({ addUtilities }) => addUtilities({}))],
}

export default config
`

/** The post-build truth the Smart Fallback recovers. */
const COMPILED_CSS =
  ':root,:host{--color-primary:#4F46E5;--color-secondary:#64748B;--color-surface:#FFFFFF;' +
  '--color-on-surface:#0F172A;--color-muted:#9CA3AF;--color-border:#27272A;' +
  '--color-error:#F43F5E;--color-success:#22C55E;' +
  '--spacing-xs:4px;--spacing-sm:8px;--spacing-md:16px;--spacing-lg:24px;--spacing-xl:40px;' +
  '--radius-sm:4px;--radius-md:8px;--radius-lg:12px;--shadow-sm:0 1px 2px 0 rgb(0 0 0 / 0.05);' +
  '--font-sans:Satoshi;--text-sm:14px;--text-base:16px;--text-lg:18px;--text-2xl:24px}'

const SCAN_RESPONSE = {
  import_session_id: 'sess-e2e',
  repo_full_name: 'acme/storefront',
  branch: 'main',
  commit_sha: 'abc1234def',
  files: [
    {
      path: 'package.json',
      kind: 'package_json',
      content: JSON.stringify({
        name: 'storefront',
        dependencies: { react: '^18.2.0', next: '^14.1.0', tailwindcss: '^3.4.1' },
      }),
    },
    { path: 'tailwind.config.ts', kind: 'tailwind_config', content: TAILWIND_CONFIG },
    { path: '.next/static/css/8f2a.css', kind: 'compiled_css', content: COMPILED_CSS },
  ],
  paths: ['package.json', 'tailwind.config.ts', '.next/static/css/8f2a.css'],
  scan: {
    tree_entries: 1200,
    tree_truncated: false,
    files_fetched: 3,
    bytes: 4800,
    duration_ms: 1800,
    skipped: [],
  },
  quota: { runs_used: 1, runs_limit: 2, period_end: '2026-09-01T00:00:00Z', unlimited: false },
  created_at: '2026-08-23T10:00:00Z',
}

interface MockOptions {
  canPush?: boolean
  scanStatus?: number
  scanBody?: unknown
  prStatus?: number
}

const REPOS = [
  { full_name: 'acme/storefront', private: false, default_branch: 'main', pushed_at: '2026-08-20T00:00:00Z' },
  { full_name: 'acme/internal', private: true, default_branch: 'main', pushed_at: '2026-08-19T00:00:00Z' },
]

/**
 * Mock the whole API surface the import flow touches.
 *
 * Registration order matters and is inverted: Playwright matches the most
 * recently registered route first. So the catch-all goes FIRST — it is the
 * fallback — and the specific routes are layered on top of it.
 */
async function mockApi(page: Page, opts: MockOptions = {}) {
  // Anything the flow calls that is not mocked below is a test bug, not a flake.
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({ status: 500, json: { error: 'unmocked route' } }),
  )

  await page.route('**/api/v1/auth/github/status', (route) =>
    route.fulfill({
      json: {
        connected: true,
        login: 'octocat',
        scopes: opts.canPush ? ['read:user', 'repo'] : ['read:user'],
        can_read_private: !!opts.canPush,
        can_push: !!opts.canPush,
        connected_at: '2026-08-01T00:00:00Z',
      },
    }),
  )

  await page.route('**/api/v1/github/repos**', (route) =>
    route.fulfill({ json: { data: REPOS, next_cursor: null } }),
  )
  await page.route('**/api/v1/github/repos/*/*/branches**', (route) =>
    route.fulfill({
      json: {
        data: [{ name: 'main', commit_sha: 'abc1234def' }, { name: 'develop', commit_sha: 'f00ba12' }],
        next_cursor: null,
      },
    }),
  )

  await page.route('**/api/v1/github/import', (route) =>
    route.fulfill({ status: opts.scanStatus ?? 201, json: opts.scanBody ?? SCAN_RESPONSE }),
  )
  await page.route('**/api/v1/github/import/sess-e2e', (route) =>
    route.fulfill({ json: { import_session_id: 'sess-e2e', status: 'complete', updated_at: '2026-08-23T10:00:01Z' } }),
  )
  await page.route('**/api/v1/github/import/sess-e2e/pull-request', (route) =>
    route.fulfill({
      status: opts.prStatus ?? 201,
      json: {
        pull_request_url: 'https://github.com/acme/storefront/pull/42',
        pull_request_number: 42,
        branch: 'design-spec/retrofit-1787654321',
        commit_sha: 'def5678',
      },
    }),
  )
}

/** Arrive already connected, as if the OAuth round trip had happened. */
async function seedSession(page: Page) {
  await page.addInitScript(
    ([token, login]) => {
      localStorage.setItem('dsa-session-jwt', token)
      localStorage.setItem('dsa-github-login', login)
    },
    [SESSION, 'octocat'],
  )
}

async function openImportDialog(page: Page) {
  await page.goto('/workspace')
  await page.getByTestId('workspace-menu').click()
  await page.getByTestId('open-import').click()
  return page.getByRole('dialog', { name: 'Import from GitHub' })
}

async function scanStorefront(page: Page) {
  const dialog = await openImportDialog(page)
  await dialog.getByRole('button', { name: 'acme/storefront' }).click()
  await expect(dialog.getByRole('button', { name: 'Scan repository' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Scan repository' }).click()
  return dialog
}

test.describe('Git import', () => {
  test('captures the OAuth session from the fragment and scrubs it from the URL', async ({ page }) => {
    await mockApi(page)
    await page.goto(`/settings#ds_token=${SESSION}&login=octocat`)

    await expect(page.getByText('Connected as')).toBeVisible()
    await expect(page.getByText('octocat')).toBeVisible()

    // The token must not survive in the address bar — that is browser history.
    expect(page.url()).not.toContain(SESSION)
    expect(new URL(page.url()).hash).toBe('')
  })

  test('reports the narrow grant until repository access is escalated', async ({ page }) => {
    await mockApi(page, { canPush: false })
    await seedSession(page)
    await page.goto('/settings')

    await expect(page.getByText('Read public repositories')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Grant repository access' })).toBeVisible()
  })

  test('acceptance: an unparseable config still populates the workspace, with no dead end', async ({ page }) => {
    await mockApi(page)
    await seedSession(page)
    const dialog = await scanStorefront(page)

    // The report is a result, not a failure: no error region anywhere.
    await expect(dialog.getByText(/Read \d+ tokens from/)).toBeVisible()
    await expect(dialog.getByRole('alert')).toHaveCount(0)

    // Extracted, Verify and Review are all reported, and the repo actually
    // contributed to the first two — a report of all-defaults would not be a
    // successful import.
    await expect(dialog.getByTestId('tally-extracted')).toContainText('Extracted')
    await expect(dialog.getByTestId('tally-inferred')).toContainText('Verify')
    await expect(dialog.getByTestId('tally-defaulted')).toContainText('Review')
    expect(Number(await dialog.getByTestId('tally-extracted').locator('span').first().innerText())).toBeGreaterThan(0)
    expect(Number(await dialog.getByTestId('tally-inferred').locator('span').first().innerText())).toBeGreaterThan(0)

    // …and the Smart Fallback explains itself rather than blocking.
    await expect(dialog.getByTestId('fallback-notice')).toContainText('could not be read without running your build')
    await expect(dialog.getByTestId('fallback-notice')).toContainText('compiled CSS was read instead')

    // The statically safe siblings survived the spread.
    await expect(dialog.getByText(/cannot be evaluated without running the config/).first()).toBeVisible()

    await dialog.getByRole('button', { name: 'Populate workspace' }).click()
    await expect(dialog).toBeHidden()

    // The workspace now carries the repo's palette.
    await expect(page.getByTestId('token-editor-color-brand')).toHaveValue('#C8813D')
    await expect(page.getByTestId('token-editor-color-border')).toHaveValue('#27272A')

    // And says how much still wants a look.
    await expect(page.getByRole('button', { name: /acme\/storefront/ })).toContainText('to check')
  })

  test('an inferred token wears a Verify chip that an edit clears', async ({ page }) => {
    await mockApi(page)
    await seedSession(page)
    const dialog = await scanStorefront(page)
    await dialog.getByRole('button', { name: 'Populate workspace' }).click()

    // `border` was never declared statically — it came from the compiled bundle.
    const chip = page.getByRole('button', { name: /^Verify: / }).first()
    await expect(chip).toBeVisible()

    const before = await page.getByRole('button', { name: /^Verify: / }).count()
    await chip.click()
    await expect(page.getByRole('button', { name: /^Verify: / })).toHaveCount(before - 1)
  })

  test('a spent Free quota is an offer, not a wall', async ({ page }) => {
    await mockApi(page, {
      scanStatus: 403,
      scanBody: {
        error: 'monthly scan limit reached',
        details: { runs_used: '2', runs_limit: '2', plan: 'free' },
      },
    })
    await seedSession(page)
    const dialog = await scanStorefront(page)

    await expect(dialog.getByText("You've used your 2 cloud scans this month.")).toBeVisible()
    await expect(dialog.getByText('npx design-spec init')).toBeVisible()
    // Not framed as a failure.
    await expect(dialog.getByRole('alert')).toHaveCount(0)
  })

  test('the retrofit PR never targets the default branch', async ({ page }) => {
    await mockApi(page, { canPush: true })
    await seedSession(page)

    const requests: { url: string; body: unknown }[] = []
    page.on('request', (req) => {
      if (req.url().includes('/pull-request')) {
        requests.push({ url: req.url(), body: JSON.parse(req.postData() ?? '{}') })
      }
    })

    const dialog = await scanStorefront(page)
    await dialog.getByRole('button', { name: 'Push as pull request' }).click()

    await expect(dialog.getByRole('link', { name: /PR #42 opened/ })).toBeVisible()
    await expect(dialog.getByRole('link', { name: /PR #42 opened/ })).toHaveAttribute(
      'href',
      'https://github.com/acme/storefront/pull/42',
    )

    // The client sends files and a base; it never names the write target.
    expect(requests).toHaveLength(1)
    const body = requests[0].body as Record<string, unknown>
    expect(body.head_branch).toBeUndefined()
    expect(body.base_branch).toBe('main')
    expect(body.base_commit_sha).toBe('abc1234def')
    expect(Array.isArray(body.files)).toBe(true)
  })

  test('without push access the button explains what is missing', async ({ page }) => {
    await mockApi(page, { canPush: false })
    await seedSession(page)
    const dialog = await scanStorefront(page)

    await dialog.getByRole('button', { name: 'Push as pull request' }).click()
    await expect(dialog.getByText(/Needs repository write access/)).toBeVisible()
    // No PR was attempted.
    await expect(dialog.getByRole('link', { name: /PR #/ })).toHaveCount(0)
  })
})

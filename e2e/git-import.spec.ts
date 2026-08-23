import { test, expect } from '@playwright/test'
import { SESSION, mockApi, scanStorefront, seedSession } from './support/github'

// Phase acceptance for the Git Import / Retrofit engine:
//
//   connect GitHub → select a React/Tailwind repo with a config the static
//   reader cannot fully evaluate → the workspace populates with Extracted and
//   Inferred tokens → no dead end → export, or (Pro) a retrofit PR.
//
// The API is mocked at `page.route`, so these are the real SPA and the real
// extraction (which runs in the browser) against a fixed scan payload. The
// harness itself lives in ./support/github so the designer-push spec drives the
// same repository through the same fixtures.


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

    // …→ ZIP. The Free path out of the workspace.
    const download = page.waitForEvent('download')
    await page.getByTestId('export-zip').click()
    expect((await download).suggestedFilename()).toBe('storefront.zip')
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

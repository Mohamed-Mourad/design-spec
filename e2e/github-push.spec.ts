import { test, expect, type Page } from '@playwright/test'
import { PUSH_RESPONSE, mockApi, scanStorefront, seedSession } from './support/github'

// Phase acceptance for the GitHub Designer Loop:
//
//   designer edits a token → Push → a pull request opens on a generated
//   design-spec/token-update-* branch, and the workspace says who has it now.
//
// The two refusals are the feature. The UI has no way to express "push to main"
// — there is no branch input and no head branch in the request — and a workspace
// whose base commit has moved is told to re-import rather than pushed anyway.
// The API enforces both again server-side (design-spec-backend); a UI that
// merely hides the option would not be enough, so these assert on the wire.

/** Capture what the app actually sends to the push endpoint. */
function capturePushes(page: Page) {
  const requests: Record<string, unknown>[] = []
  page.on('request', (req) => {
    if (req.url().includes('/api/v1/github/push')) {
      requests.push(JSON.parse(req.postData() ?? '{}') as Record<string, unknown>)
    }
  })
  return requests
}

/** Import acme/storefront into the workspace and edit one colour token. */
async function importAndEdit(page: Page) {
  const dialog = await scanStorefront(page)
  await dialog.getByRole('button', { name: 'Populate workspace' }).click()
  await expect(dialog).toBeHidden()

  const brand = page.getByTestId('token-editor-color-brand')
  await expect(brand).toHaveValue('#C8813D')
  await brand.fill('#3b6ef5')
  await brand.blur()
  await expect(brand).toHaveValue('#3b6ef5')
}

test.describe('GitHub designer loop', () => {
  test('acceptance: an edit becomes a pull request that cannot target main', async ({ page }) => {
    await mockApi(page, { canPush: true })
    await seedSession(page)
    const pushes = capturePushes(page)

    await importAndEdit(page)
    await page.getByTestId('push-to-github').click()

    // The workspace hands the change over and says who has it now.
    const link = page.getByTestId('push-pr-link')
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', PUSH_RESPONSE.pull_request_url)
    await expect(link).toContainText('PR #43')
    await expect(link).toContainText('awaiting developer review')

    // The write target is never the client's to name — and the session is the
    // whole address, so there is nothing else in the body to aim.
    expect(pushes).toHaveLength(1)
    const body = pushes[0]
    expect(body.head_branch).toBeUndefined()
    expect(body.base_branch).toBeUndefined()
    expect(body.import_session_id).toBe('sess-e2e')
    expect(JSON.stringify(body)).not.toContain('"main"')

    // What it does send is the compiled bundle, schema first.
    const files = body.files as { path: string; content: string }[]
    expect(files[0].path).toBe('design-spec.schema.json')
    expect(files.map((f) => f.path)).toContain('DESIGN.md')
    expect(JSON.parse(files[0].content).colors.brand).toBe('#3b6ef5')
  })

  test('a workspace behind the branch is told to re-import, not pushed anyway', async ({ page }) => {
    await mockApi(page, { canPush: true, pushStatus: 409, pushBody: { error: 'branch has moved' } })
    await seedSession(page)

    await importAndEdit(page)
    await page.getByTestId('push-to-github').click()

    await expect(page.getByText(/Re-import it to push these edits/)).toBeVisible()
    await expect(page.getByTestId('push-pr-link')).toHaveCount(0)
  })

  test('a rejected write target surfaces rather than silently succeeding', async ({ page }) => {
    await mockApi(page, {
      canPush: true,
      pushStatus: 403,
      pushBody: { error: 'writes to the default branch are not allowed' },
    })
    await seedSession(page)

    await importAndEdit(page)
    await page.getByTestId('push-to-github').click()

    await expect(page.getByText('writes to the default branch are not allowed')).toBeVisible()
    await expect(page.getByTestId('push-pr-link')).toHaveCount(0)
  })

  test('a Free plan is told what the push needs', async ({ page }) => {
    await mockApi(page, { canPush: true, pushStatus: 403, pushBody: { error: 'pro plan required' } })
    await seedSession(page)

    await importAndEdit(page)
    await page.getByTestId('push-to-github').click()

    await expect(page.getByText(/Pro Team plan/)).toBeVisible()
  })

  test('without write access the push goes to GitHub for the grant, not to the API', async ({ page }) => {
    await mockApi(page, { canPush: false })
    await seedSession(page)
    const pushes = capturePushes(page)

    await importAndEdit(page)
    // The escalation navigates away from the SPA; stop at the redirect and read
    // where it was going.
    await page.route('**/api/v1/auth/github/start**', (route) =>
      route.fulfill({ status: 200, body: 'oauth' }),
    )
    await page.getByTestId('push-to-github').click()
    await page.waitForURL(/auth\/github\/start/)

    expect(page.url()).toContain('scope=write')
    expect(pushes).toHaveLength(0)
  })

  test('a workspace that was never imported has nothing to push to', async ({ page }) => {
    await mockApi(page, { canPush: true })
    await seedSession(page)
    await page.goto('/workspace')

    await expect(page.getByTestId('export-zip')).toBeVisible()
    await expect(page.getByTestId('push-to-github')).toHaveCount(0)
  })
})

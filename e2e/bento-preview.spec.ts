import { test, expect, type Page } from '@playwright/test'

// Phase acceptance for the bento preview and the portfolio layer:
//
//   open /preview → generate a hash link → reload from #<hash> with no account
//   → (Pro) publish /p/{slug} with branding → the Notion embed renders.
//
// The API is mocked at `page.route`, so the free half runs against no backend
// at all — which is the point of it — and the Pro half is deterministic.

const PUBLISHED = {
  slug: 'acme-system',
  url: 'http://localhost/p/acme-system',
  embed_url: 'http://localhost/embed/acme-system',
  og_image_url: null,
  og_image_status: 'pending',
  created_at: '2026-08-23T10:00:00Z',
  updated_at: '2026-08-23T10:00:00Z',
}

/** Read the clipboard the app just wrote to. */
async function clipboard(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText())
}

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
})

test('a hash link carries the whole system to someone with no account', async ({ page }) => {
  // Give the workspace a name the shared link can be recognised by.
  await page.goto('/workspace')
  await page.getByRole('button', { name: 'My Design System' }).click()
  await page.locator('.header__name-input').fill('Acme System')
  await page.locator('.header__name-input').press('Enter')

  await page.getByTestId('open-preview').click()
  await expect(page).toHaveURL(/\/preview$/)

  const bento = page.getByTestId('bento-preview')
  await expect(bento).toContainText('Acme System')
  // Every default cell renders, not just a title card.
  await expect(page.locator('[data-bento-cell]')).toHaveCount(11)

  await page.getByTestId('share-link').click()
  await expect(page.getByTestId('share-link')).toContainText('Link copied')

  const link = await clipboard(page)
  expect(link).toContain('/preview#')

  // A fresh context: no localStorage, no session, nothing but the URL.
  const reader = await page.context().browser()!.newContext()
  const readerPage = await reader.newPage()
  // Any call to the API would be a bug — the fragment never reaches a server.
  await readerPage.route('**/api/v1/**', (route) => route.abort())
  await readerPage.goto(link.replace(/^https?:\/\/[^/]+/, ''))

  await expect(readerPage.getByTestId('bento-preview')).toContainText('Acme System')
  await expect(readerPage.getByTestId('open-in-workspace')).toBeVisible()
  // A reader is looking at someone else's system; it is not theirs to rearrange.
  await expect(readerPage.getByTestId('customize-bento')).toHaveCount(0)
  await reader.close()
})

test('layout edits survive into the shared link', async ({ page }) => {
  await page.goto('/preview')

  await page.getByTestId('customize-bento').click()
  await page.getByRole('button', { name: 'Hide the Colors cell' }).click()
  await expect(page.locator('[data-bento-cell="colors"]')).toHaveCount(0)

  await page.getByRole('button', { name: 'Move Motion up' }).click()
  await page.getByTestId('share-link').click()
  const link = await clipboard(page)

  const reader = await page.context().browser()!.newContext()
  const readerPage = await reader.newPage()
  await readerPage.goto(link.replace(/^https?:\/\/[^/]+/, ''))

  // The layout travelled with the schema, because it lives on it.
  await expect(readerPage.locator('[data-bento-cell="colors"]')).toHaveCount(0)
  await reader.close()
})

test('a damaged link shows the viewer their own workspace, not an error page', async ({ page }) => {
  await page.goto('/preview#this-is-not-a-real-hash')

  await expect(page.getByTestId('bad-share-link')).toBeVisible()
  await expect(page.getByTestId('bento-preview')).toBeVisible()
})

test.describe('the portfolio layer', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('publishing gives a branded /p/{slug} that a stranger can read', async ({ page }) => {
    await page.route('**/api/v1/proposals/availability**', (route) =>
      route.fulfill({ json: { slug: 'acme-system', available: true, reason: null } }),
    )
    await page.route('**/api/v1/proposals', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 201, json: PUBLISHED })
        : route.continue(),
    )

    await page.goto('/preview')

    // Brand it first — the branding is what a proposal adds over a hash link.
    await page.getByTestId('customize-bento').click()
    await page.getByRole('tab', { name: 'Branding' }).click()
    await page.getByLabel('Company name').fill('Acme Inc.')
    await page.getByLabel('Company name').blur()
    // Rendered in caps by the stylesheet; the text itself is what was typed.
    await expect(page.getByTestId('bento-preview')).toContainText('Acme Inc.')

    await page.getByTestId('open-publish').click()
    await page.getByTestId('slug-input').fill('acme-system')
    await expect(page.getByTestId('slug-status')).toHaveText('Available')
    await page.getByTestId('publish-submit').click()
    await expect(page.getByTestId('published-url')).toContainText('/p/acme-system')

    // What a reader of that address sees, with no session of their own.
    const brandedSchema = await page.evaluate(() => {
      const id = localStorage.getItem('dsa-active-workspace-v1')
      return JSON.parse(localStorage.getItem(`dsa-ws-${id}`) ?? '{}')
    })
    const reader = await page.context().browser()!.newContext()
    const readerPage = await reader.newPage()
    await readerPage.route('**/api/v1/proposals/acme-system', (route) =>
      route.fulfill({ json: { ...PUBLISHED, schema_json: brandedSchema } }),
    )
    await readerPage.goto('/p/acme-system')

    await expect(readerPage.getByTestId('bento-preview')).toContainText('Acme Inc.')
    await reader.close()
  })

  test('the embed renders inside an iframe on an allowed site', async ({ page }) => {
    const schema = await page.evaluate(() => null)
    void schema

    // Seed a schema whose author allowed this very origin to frame it.
    await page.goto('/preview')
    const embeddable = await page.evaluate(() => {
      const id = localStorage.getItem('dsa-active-workspace-v1')
      const stored = JSON.parse(localStorage.getItem(`dsa-ws-${id}`) ?? '{}')
      stored.presentation = {
        ogImageStrategy: 'client-canvas',
        embedOptions: {
          allowIframe: true,
          showTokenValues: true,
          allowedOrigins: [location.origin],
        },
      }
      return stored
    })

    await page.route('**/api/v1/proposals/acme-system', (route) =>
      route.fulfill({ json: { ...PUBLISHED, schema_json: embeddable } }),
    )

    // A host page framing the embed, exactly as Notion would.
    await page.setContent(
      `<iframe src="/embed/acme-system" width="900" height="600" style="border:0"></iframe>`,
    )
    const frame = page.frameLocator('iframe')

    await expect(frame.getByTestId('bento-preview')).toBeVisible()
    await expect(frame.getByTestId('embed-blocked')).toHaveCount(0)
    // The renderer's cue that the page has settled enough to screenshot.
    await expect(frame.locator('[data-og-ready="true"]')).toBeVisible()
  })

  // Refusing a *foreign* origin needs a second origin to frame from, which this
  // runner has no honest way to provide; that path is covered against a faked
  // ancestor in src/utils/framing.test.ts. What is worth proving in a real
  // browser is the switch an author actually toggles: embedding turned off
  // refuses even a frame on the site's own origin, where framing is otherwise
  // always allowed.
  test('the embed refuses to render at all when the author turned embedding off', async ({ page }) => {
    await page.goto('/preview')
    const restricted = await page.evaluate(() => {
      const id = localStorage.getItem('dsa-active-workspace-v1')
      const stored = JSON.parse(localStorage.getItem(`dsa-ws-${id}`) ?? '{}')
      stored.presentation = {
        ogImageStrategy: 'client-canvas',
        embedOptions: { allowIframe: false, showTokenValues: true, allowedOrigins: [location.origin] },
      }
      return stored
    })

    await page.route('**/api/v1/proposals/acme-system', (route) =>
      route.fulfill({ json: { ...PUBLISHED, schema_json: restricted } }),
    )

    await page.setContent(
      `<iframe src="/embed/acme-system" width="900" height="600" style="border:0"></iframe>`,
    )
    const frame = page.frameLocator('iframe')

    await expect(frame.getByTestId('embed-blocked')).toBeVisible()
    await expect(frame.getByTestId('bento-preview')).toHaveCount(0)
  })
})

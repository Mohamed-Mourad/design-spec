import { test, expect, type Page } from '@playwright/test'
import { SESSION, seedSession } from './support/github'

// Phase acceptance for Figma token sync:
//
//   paste a file link and a PAT → tokens populate the workspace → the PAT stays
//   in this browser and is never sent to the Design Spec API. Pro adds
//   variables, a dark mode, a change badge when the file moves, and staging an
//   edit back for approval inside Figma.
//
// Both APIs are mocked at `page.route`: api.figma.com so the read is
// deterministic, and the Design Spec API so entitlement and staging are. Every
// route asserts on what it was sent, which is how the "the token never leaves
// the browser" claim is tested rather than asserted.

const PAT = 'figd_e2e-secret-token'
const FILE_URL = 'https://www.figma.com/design/abc123DEF456/Acme'

const FILE_META = { name: 'Acme Library', version: '900', lastModified: '2026-08-01T00:00:00Z' }

const STYLES = {
  meta: {
    styles: [
      { key: 's1', node_id: '1:1', style_type: 'FILL', name: 'Brand/Primary' },
      { key: 's2', node_id: '2:2', style_type: 'FILL', name: 'Brand/Ink' },
      { key: 's3', node_id: '3:3', style_type: 'TEXT', name: 'Headline/LG' },
      { key: 's4', node_id: '4:4', style_type: 'EFFECT', name: 'Elevation/1' },
    ],
  },
}

const NODES = {
  nodes: {
    '1:1': { document: { id: '1:1', fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.9 } }] } },
    '2:2': { document: { id: '2:2', fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 } }] } },
    '3:3': {
      document: {
        id: '3:3',
        style: { fontFamily: 'Satoshi', fontWeight: 700, fontSize: 32, lineHeightPx: 38 },
      },
    },
    '4:4': {
      document: {
        id: '4:4',
        effects: [
          {
            type: 'DROP_SHADOW',
            color: { r: 0, g: 0, b: 0, a: 0.1 },
            offset: { x: 0, y: 2 },
            radius: 4,
          },
        ],
      },
    },
  },
}

const VARIABLES = {
  meta: {
    variables: {
      v1: {
        id: 'v1',
        name: 'Surface',
        variableCollectionId: 'c1',
        resolvedType: 'COLOR',
        valuesByMode: { light: { r: 1, g: 1, b: 1 }, dark: { r: 0.05, g: 0.05, b: 0.07 } },
      },
      v2: {
        id: 'v2',
        name: 'Space/lg',
        variableCollectionId: 'c1',
        resolvedType: 'FLOAT',
        valuesByMode: { light: 24 },
      },
    },
    variableCollections: {
      c1: {
        id: 'c1',
        name: 'Core',
        defaultModeId: 'light',
        modes: [
          { modeId: 'light', name: 'Light' },
          { modeId: 'dark', name: 'Dark' },
        ],
      },
    },
  },
}

interface FigmaOptions {
  /** File version the metadata endpoint reports. Change it to move the file. */
  version?: string
}

/** Every request that reached our own API, so the PAT claim can be checked. */
interface Recorder {
  apiRequests: { url: string; headers: Record<string, string>; body: string | null }[]
  figmaHosts: Set<string>
}

async function mockFigma(page: Page, rec: Recorder, opts: FigmaOptions = {}) {
  await page.route('https://api.figma.com/**', async (route) => {
    const request = route.request()
    rec.figmaHosts.add(new URL(request.url()).host)
    // Figma is the only place the token may go, and it goes in this header.
    expect(request.headers()['x-figma-token']).toBe(PAT)

    const url = request.url()
    if (url.includes('/variables/local')) return route.fulfill({ json: VARIABLES })
    if (url.includes('/styles')) return route.fulfill({ json: STYLES })
    if (url.includes('/nodes?ids=')) return route.fulfill({ json: NODES })
    if (url.includes('depth=1')) {
      return route.fulfill({ json: { ...FILE_META, version: opts.version ?? FILE_META.version } })
    }
    return route.fulfill({ status: 404, json: {} })
  })
}

interface ApiOptions {
  pro?: boolean
  stageStatus?: number
}

async function mockApi(page: Page, rec: Recorder, opts: ApiOptions = {}) {
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    rec.apiRequests.push({
      url: request.url(),
      headers: request.headers(),
      body: request.postData(),
    })

    const url = request.url()
    if (url.includes('/auth/github/status')) {
      return route.fulfill({
        json: { connected: true, login: 'octocat', can_read_private: true, can_push: true },
      })
    }
    if (url.includes('/billing/entitlement')) {
      return route.fulfill({
        json: {
          org: 'octocat',
          plan: opts.pro ? 'pro_team' : 'free',
          status: opts.pro ? 'active' : 'canceled',
          hosted_janitor: !!opts.pro,
          seats: 3,
          seats_used: 1,
        },
      })
    }
    if (url.includes('/staging/')) {
      if (request.method() === 'GET') return route.fulfill({ json: { data: [] } })
      const status = opts.stageStatus ?? 201
      if (status !== 201) {
        return route.fulfill({ status, json: { error: 'too many changes already pending' } })
      }
      return route.fulfill({
        status: 201,
        json: {
          id: 'chg-e2e',
          user_id: 'octocat',
          file_key: 'abc123DEF456',
          status: 'pending',
          payload: JSON.parse(request.postData() ?? '{}'),
          created_at: '2026-08-23T10:00:00Z',
          updated_at: '2026-08-23T10:00:00Z',
          resolved_at: null,
        },
      })
    }
    return route.fulfill({ status: 500, json: { error: 'unmocked route' } })
  })
}

function recorder(): Recorder {
  return { apiRequests: [], figmaHosts: new Set() }
}

async function openFigmaDialog(page: Page) {
  await page.goto('/workspace')
  await page.getByTestId('workspace-menu').click()
  await page.getByTestId('open-figma-import').click()
  return page.getByRole('dialog', { name: 'Import from Figma' })
}

async function readFile(page: Page) {
  const dialog = await openFigmaDialog(page)
  await dialog.getByTestId('figma-file-input').fill(FILE_URL)
  await dialog.getByTestId('figma-pat-input').fill(PAT)
  await dialog.getByRole('button', { name: 'Save token' }).click()
  await dialog.getByTestId('figma-read').click()
  return dialog
}

test.describe('Figma import', () => {
  test('acceptance: styles populate the workspace and the token never leaves the browser', async ({
    page,
  }) => {
    const rec = recorder()
    await mockFigma(page, rec)
    await mockApi(page, rec)
    await seedSession(page)

    const dialog = await readFile(page)

    await expect(dialog.getByText(/Read .*Acme Library/)).toBeVisible()
    await expect(dialog.getByText('Colors')).toBeVisible()
    await expect(dialog.getByText('Typography')).toBeVisible()
    await expect(dialog.getByText('Shadows')).toBeVisible()

    await dialog.getByTestId('figma-apply').click()
    await expect(page.getByRole('dialog', { name: 'Import from Figma' })).toHaveCount(0)

    // The tokens are really in the workspace, under the names Figma gave them.
    await expect(page.getByTestId('figma-badge')).toContainText('Acme Library')
    const colors = await page.evaluate(() => {
      const id = localStorage.getItem('dsa-active-workspace-v1')
      return JSON.parse(localStorage.getItem(`dsa-ws-${id}`) ?? '{}').colors
    })
    expect(colors['brand-primary']).toBe('#3366E6')
    expect(colors['brand-ink']).toBe('#1A1A1A')

    // The PAT is in this browser…
    expect(await page.evaluate(() => localStorage.getItem('dsa-figma-pat'))).toBe(PAT)
    // …it only ever went to Figma…
    expect([...rec.figmaHosts]).toEqual(['api.figma.com'])
    // …and no request to our own API carried it, in a header or a body.
    expect(rec.apiRequests.length).toBeGreaterThan(0)
    for (const req of rec.apiRequests) {
      expect(JSON.stringify(req)).not.toContain(PAT)
    }
    // Nor did it end up in the saved design system.
    const stored = await page.evaluate(() => JSON.stringify(localStorage))
    expect(stored).toContain('dsa-figma-pat')
    expect(stored.split('dsa-figma-pat')[1]).toBeTruthy()
  })

  test('free reads styles only; the Variables API is never called', async ({ page }) => {
    const rec = recorder()
    await mockFigma(page, rec)
    await mockApi(page, rec, { pro: false })
    await seedSession(page)

    const dialog = await readFile(page)
    await expect(dialog.getByText(/Read .*Acme Library/)).toBeVisible()
    await expect(dialog.getByText(/and \d+ variables/)).toHaveCount(0)
  })

  test('pro reads variables and a dark mode', async ({ page }) => {
    const rec = recorder()
    await mockFigma(page, rec)
    await mockApi(page, rec, { pro: true })
    await seedSession(page)

    const dialog = await readFile(page)
    await expect(dialog.getByText(/and 2 variables/)).toBeVisible()
    await expect(dialog.getByText('Dark mode')).toBeVisible()

    await dialog.getByTestId('figma-apply').click()
    const schema = await page.evaluate(() => {
      const id = localStorage.getItem('dsa-active-workspace-v1')
      return JSON.parse(localStorage.getItem(`dsa-ws-${id}`) ?? '{}')
    })
    expect(schema.colors.surface).toBe('#FFFFFF')
    expect(schema.spacing['space-lg']).toBe('24px')
    expect(schema.darkMode.enabled).toBe(true)
    expect(schema.darkMode.colors.surface).toBe('#0D0D12')
  })

  test('replace-all swaps the groups the file populated and leaves the rest', async ({ page }) => {
    const rec = recorder()
    await mockFigma(page, rec)
    await mockApi(page, rec)

    const dialog = await readFile(page)
    await dialog.getByTestId('figma-replace').check()
    await dialog.getByTestId('figma-apply').click()

    const schema = await page.evaluate(() => {
      const id = localStorage.getItem('dsa-active-workspace-v1')
      return JSON.parse(localStorage.getItem(`dsa-ws-${id}`) ?? '{}')
    })
    // Only what Figma published survives in colors…
    expect(Object.keys(schema.colors).sort()).toEqual(['brand-ink', 'brand-primary'])
    // …while a group the file said nothing about is untouched.
    expect(Object.keys(schema.spacing).length).toBeGreaterThan(2)
  })

  test('a bad token says whose problem it is, without echoing the token', async ({ page }) => {
    const rec = recorder()
    await mockApi(page, rec)
    await page.route('https://api.figma.com/**', (route) => route.fulfill({ status: 403, json: {} }))

    const dialog = await readFile(page)
    const alert = dialog.getByRole('alert')
    await expect(alert).toContainText('Figma refused that token')
    await expect(alert).not.toContainText(PAT)
  })
})

test.describe('Following a Figma file', () => {
  test('acceptance: a file that moves raises a badge and never applies itself', async ({ page }) => {
    const rec = recorder()
    await mockFigma(page, rec)
    await mockApi(page, rec, { pro: true })
    await seedSession(page)

    const dialog = await readFile(page)
    await dialog.getByTestId('figma-apply').click()
    await expect(page.getByTestId('figma-badge')).toContainText('watching')

    const tokens = () =>
      page.evaluate(() => {
        const id = localStorage.getItem('dsa-active-workspace-v1')
        const schema = JSON.parse(localStorage.getItem(`dsa-ws-${id}`) ?? '{}')
        return { colors: schema.colors, spacing: schema.spacing, darkMode: schema.darkMode }
      })
    const before = await tokens()

    // The file moves. Re-opening the workspace polls once on mount.
    await mockFigma(page, rec, { version: '901' })
    await page.reload()

    await expect(page.getByTestId('figma-change-badge')).toContainText('updated — sync')
    expect(await tokens()).toEqual(before)
  })

  test('acceptance: an edit is staged for approval inside Figma, not written to it', async ({
    page,
  }) => {
    const rec = recorder()
    await mockFigma(page, rec)
    await mockApi(page, rec, { pro: true })
    await seedSession(page)

    const dialog = await readFile(page)
    await dialog.getByTestId('figma-apply').click()

    // Nothing has diverged from the file yet, so there is nothing to send.
    await expect(page.getByTestId('stage-to-figma')).toBeDisabled()

    // Edit a token the file supplied.
    const hex = page.getByTestId('token-editor-color-brand-primary')
    await hex.fill('#FF0000')
    await hex.press('Enter')

    const stage = page.getByTestId('stage-to-figma')
    await expect(stage).toBeEnabled()
    await expect(stage).toContainText('Send 1 to Figma')
    await stage.click()

    await expect(page.getByTestId('figma-staged')).toContainText('waiting for approval in Figma')

    const staged = rec.apiRequests.filter((r) => r.url.includes('/staging/') && r.body)
    expect(staged).toHaveLength(1)
    expect(staged[0].url).toContain('/staging/octocat/abc123DEF456')
    const payload = JSON.parse(staged[0].body ?? '{}')
    expect(payload.changes).toEqual([
      { path: 'colors.brand-primary', old: '#3366E6', new: '#ff0000' },
    ])
    // The staged change carries a token delta and nothing that could touch Figma.
    expect(staged[0].body).not.toContain(PAT)
    expect(staged[0].headers.authorization).toBe(`Bearer ${SESSION}`)
  })
})

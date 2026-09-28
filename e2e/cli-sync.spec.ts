import { test, expect, type Page } from '@playwright/test'
import { mockApi, seedSession } from './support/github'

// The dashboard side of CLI sync:
//
//   Settings → Developer: mint a key (shown once), see the project a developer
//   pushed with `design-spec push`, open it as a workspace, save it back — at
//   the revision it was opened at, so a CLI push in between is a conflict.
//
// The API is a stateful in-page stand-in for docs/sync-contract.md.

const PLAINTEXT = 'ds_live_' + 'A1b2C3d4E5'.repeat(4)

interface Captured {
  method: string
  url: string
  body: Record<string, any> | null
}

async function mockSync(page: Page, opts: { conflictOnSave?: boolean } = {}) {
  const calls: Captured[] = []
  const keys: Record<string, unknown>[] = []
  const project = {
    project: 'acme-ui',
    name: 'Acme UI',
    revision: 3,
    updated_by: 'cli' as 'cli' | 'web',
    created_at: '2026-09-28T10:00:00Z',
    updated_at: '2026-09-28T10:00:00Z',
  }
  let schemaJson: Record<string, unknown> | null = null

  await page.route('**/api/v1/api-keys**', async (route) => {
    const req = route.request()
    calls.push({ method: req.method(), url: req.url(), body: req.postDataJSON() })
    if (req.method() === 'POST') {
      const minted = {
        id: '00000000-0000-4000-8000-000000000001',
        environment: 'live',
        prefix: 'ds_live_',
        last4: PLAINTEXT.slice(-4),
        created_at: '2026-09-28T10:00:00Z',
        last_used_at: null,
      }
      keys.splice(0, keys.length, minted)
      return route.fulfill({ status: 201, json: { ...minted, key: PLAINTEXT } })
    }
    return route.fulfill({ json: { data: keys } })
  })

  await page.route('**/api/v1/projects**', async (route) => {
    const req = route.request()
    const body = req.method() === 'PUT' ? req.postDataJSON() : null
    calls.push({ method: req.method(), url: req.url(), body })
    if (req.url().endsWith('/projects')) return route.fulfill({ json: { data: [project] } })
    if (req.method() === 'GET') {
      return route.fulfill({ json: { ...project, schema_json: schemaJson } })
    }
    if (opts.conflictOnSave) {
      return route.fulfill({ status: 409, json: { error: 'project changed since base_revision' } })
    }
    project.revision += 1
    project.updated_by = 'web'
    return route.fulfill({ json: project })
  })

  return {
    calls,
    setSchema(s: Record<string, unknown>) {
      schemaJson = s
    },
  }
}

/** Grab the workspace's own schema to stand in for what the CLI pushed. */
async function seedRemoteSchema(page: Page, api: Awaited<ReturnType<typeof mockSync>>) {
  await page.goto('/workspace')
  const schema = await page.evaluate(() => {
    const active = localStorage.getItem('dsa-active-workspace-v1') ?? ''
    const list = JSON.parse(localStorage.getItem('dsa-workspaces-v1') ?? '[]') as { id: string }[]
    const id = active || list[0]?.id
    return JSON.parse(localStorage.getItem(`dsa-ws-${id}`) ?? 'null') as Record<string, unknown>
  })
  expect(schema).not.toBeNull()
  api.setSchema({
    ...schema,
    name: 'Acme UI',
    presentation: { ogImageStrategy: 'server-render', proposalBranding: { companyName: 'Acme Studio' } },
  })
}

test.describe('CLI sync — dashboard side', () => {
  test('acceptance: mint a key once, open the pushed project, save it back at its revision', async ({ page }) => {
    await mockApi(page)
    const api = await mockSync(page)
    await seedSession(page)
    await seedRemoteSchema(page, api)

    await page.goto('/settings')
    const card = page.getByTestId('developer-card')
    await expect(card.getByTestId('key-live')).toContainText('No key')

    // A key is shown once. The usage line names the variable, never the value.
    await card.getByTestId('generate-live').click()
    await expect(card.getByTestId('revealed-key-value')).toHaveText(PLAINTEXT)
    const usage = card.getByTestId('revealed-key-usage')
    await expect(usage).toHaveText('DESIGN_SPEC_API_KEY=… npx @design-spec/cli sync')
    await expect(card.locator('code', { hasText: PLAINTEXT })).toHaveCount(0)
    await card.getByRole('button', { name: 'Done' }).click()
    await expect(card.getByTestId('revealed-key')).toHaveCount(0)
    await expect(card.getByTestId('key-live')).toContainText(`ds_live_…${PLAINTEXT.slice(-4)}`)
    await expect(page.getByText(PLAINTEXT)).toHaveCount(0)

    // …and is never persisted by the app.
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }))
    expect(stored).not.toContain(PLAINTEXT)

    // The project the developer pushed is listed; open it.
    const projects = card.getByTestId('dashboard-projects')
    await expect(projects).toContainText('acme-ui · rev 3')
    await expect(projects).toContainText('the CLI')
    await card.getByTestId('open-acme-ui').click()
    await expect(page).toHaveURL(/\/workspace$/)

    // Save it back: dashboard only, at the revision it was opened at, and the
    // designer's presentation travels with it.
    await page.getByTestId('save-to-dashboard').click()
    await expect(page.getByTestId('save-to-dashboard')).toContainText('Saved · rev 4')

    const put = api.calls.find((c) => c.method === 'PUT')!
    expect(put.url).toMatch(/\/api\/v1\/projects\/acme-ui$/)
    expect(put.body!.base_revision).toBe(3)
    expect(put.body!.schema_json.name).toBe('Acme UI')
    expect(put.body!.schema_json.presentation.proposalBranding.companyName).toBe('Acme Studio')
    // Never a git write.
    expect(api.calls.every((c) => !c.url.includes('/github/'))).toBe(true)
  })

  test('a CLI push that landed after opening is a conflict, not an overwrite', async ({ page }) => {
    await mockApi(page)
    const api = await mockSync(page, { conflictOnSave: true })
    await seedSession(page)
    await seedRemoteSchema(page, api)

    await page.goto('/settings')
    await page.getByTestId('open-acme-ui').click()
    await expect(page).toHaveURL(/\/workspace$/)
    await page.getByTestId('save-to-dashboard').click()
    await expect(page.getByTestId('save-to-dashboard-error')).toContainText('changed since you opened')
  })
})

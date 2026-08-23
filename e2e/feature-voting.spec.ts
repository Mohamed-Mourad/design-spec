import { test, expect, type Page } from '@playwright/test'
import { seedSession } from './support/github'

// Phase acceptance for the feature board:
//
//   type a duplicate-ish title → the similar list appears → voting there goes to
//   the existing request rather than filing a second one; a Pro vote adds 5×.
//
// The API is mocked at `page.route`, so what runs is the real SPA against a
// fixed board. The two assertions that matter are that the client never invents
// a weight — the count it settles on is the one the response carries — and that
// a dedup outage does not stand between somebody and the submit button.

const EXISTING = {
  id: '6c1f0c34-0000-4000-8000-000000000001',
  title: 'Tailwind v4 @theme output',
  description: 'The compiler should emit @theme blocks, not :root vars.',
  status: 'open',
  vote_count: 12,
  author: 'someone-else',
  viewer_vote: null,
  created_at: '2026-08-23T10:00:00Z',
  updated_at: '2026-08-23T10:00:00Z',
}

interface BoardOptions {
  pro?: boolean
  /** What /similar answers. `null` makes the probe fail outright. */
  similar?: unknown[] | null
  /** The weight the vote endpoint reports back. */
  voteWeight?: number
}

async function mockBoard(page: Page, opts: BoardOptions = {}) {
  const weight = opts.voteWeight ?? 1

  await page.route('**/api/v1/billing/entitlement*', (route) =>
    route.fulfill({
      status: 200,
      json: {
        org: 'octocat',
        plan: opts.pro ? 'pro_team' : 'free',
        status: opts.pro ? 'active' : 'canceled',
        hosted_janitor: !!opts.pro,
        seats: opts.pro ? 3 : 0,
        seats_used: opts.pro ? 1 : 0,
      },
    }),
  )

  await page.route('**/api/v1/feature-requests/similar*', (route) => {
    if (opts.similar === null) {
      return route.fulfill({ status: 500, json: { error: 'internal server error' } })
    }
    return route.fulfill({
      status: 200,
      json: { data: opts.similar ?? [], threshold: 0.78, dedup_available: true },
    })
  })

  await page.route(`**/api/v1/feature-requests/${EXISTING.id}/votes`, (route) =>
    route.fulfill({
      status: 201,
      json: {
        feature_request_id: EXISTING.id,
        weight,
        tier: opts.pro ? 'pro' : 'free',
        vote_count: EXISTING.vote_count + weight,
        created_at: '2026-08-23T11:02:00Z',
      },
    }),
  )

  // Registered last so the two more specific routes above win.
  await page.route('**/api/v1/feature-requests*', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        json: {
          ...EXISTING,
          id: '6c1f0c34-0000-4000-8000-000000000002',
          title: 'A genuinely different ask',
          description: '',
          vote_count: weight,
          author: 'octocat',
          viewer_vote: { weight, created_at: '2026-08-23T12:00:00Z' },
        },
      })
    }
    return route.fulfill({ status: 200, json: { data: [EXISTING], next_cursor: null } })
  })
}

test('a duplicate-ish title surfaces the existing request, and voting there counts', async ({
  page,
}) => {
  await seedSession(page)
  await mockBoard(page, { similar: [{ ...EXISTING, similarity: 0.86 }] })

  await page.goto('/features')
  await expect(page.getByTestId('board')).toContainText(EXISTING.title)

  await page.getByTestId('open-composer').click()
  await page.getByTestId('request-title').fill('tailwind 4 theme block output')

  // The 300 ms debounce, then the suggestion.
  const similar = page.getByTestId('similar')
  await expect(similar).toBeVisible()
  await expect(similar).toContainText(EXISTING.title)

  // Voting on the suggestion is voting on the existing request — no second one
  // is filed, and the composer closes.
  await similar.getByTestId(`vote-similar-${EXISTING.id}`).click()
  await expect(page.getByTestId('similar')).toBeHidden()
  await expect(page.getByTestId(`vote-${EXISTING.id}`)).toContainText('13')
  await expect(page.getByTestId('board')).toContainText('You voted 1×')
})

test('a Pro vote adds five', async ({ page }) => {
  await seedSession(page)
  await mockBoard(page, { pro: true, voteWeight: 5 })

  await page.goto('/features')
  await expect(page.getByTestId(`vote-${EXISTING.id}`)).toContainText('12')

  await page.getByTestId(`vote-${EXISTING.id}`).click()
  await expect(page.getByTestId(`vote-${EXISTING.id}`)).toContainText('17')
  await expect(page.getByTestId('board')).toContainText('You voted 5×')
})

test('a Free voter is shown what Pro would be worth, not a blocked button', async ({ page }) => {
  await seedSession(page)
  await mockBoard(page)

  await page.goto('/features')
  await expect(page.getByText(/count five times/)).toBeVisible()

  // The button still works — Pro is a multiplier here, not a gate.
  await page.getByTestId(`vote-${EXISTING.id}`).click()
  await expect(page.getByTestId(`vote-${EXISTING.id}`)).toContainText('13')
})

test('a dedup outage does not stand between anyone and the submit button', async ({ page }) => {
  await seedSession(page)
  await mockBoard(page, { similar: null })

  await page.goto('/features')
  await page.getByTestId('open-composer').click()
  await page.getByTestId('request-title').fill('a genuinely different ask')

  await expect(page.getByText(/Duplicate checking is off/)).toBeVisible()
  await page.getByTestId('file-request').click()

  await expect(page.getByTestId('board')).toContainText('A genuinely different ask')
})

test('the board reads without an account, and offers no vote button', async ({ page }) => {
  await mockBoard(page)

  await page.goto('/features')
  await expect(page.getByTestId('board')).toContainText(EXISTING.title)
  await expect(page.getByTestId('open-composer')).toHaveCount(0)
  await expect(page.getByTestId(`vote-${EXISTING.id}`)).toBeDisabled()
})

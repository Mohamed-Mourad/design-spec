import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useFeatureStore, DEDUP_DEBOUNCE_MS } from '@/stores/useFeatureStore'
import { clearSession, setSession, type FeatureRequest } from '@/utils/api'

// The board, with the API stubbed at `fetch`.
//
// What is under test is the client half of the two rules the API enforces:
// nothing here computes a vote's weight (it is settled against what the server
// returns), and a dedup probe that fails leaves the submit path untouched.

const API = 'https://api.test'

function feature(overrides: Partial<FeatureRequest> = {}): FeatureRequest {
  return {
    id: '6c1f0c34-0000-4000-8000-000000000001',
    title: 'Tailwind v4 @theme output',
    description: 'The compiler should emit @theme blocks.',
    status: 'open',
    vote_count: 12,
    author: 'someone-else',
    viewer_vote: null,
    created_at: '2026-08-23T10:00:00Z',
    updated_at: '2026-08-23T10:00:00Z',
    ...overrides,
  }
}

interface Route {
  status: number
  body: unknown
}

/** Route stubbed responses by URL suffix, newest registration winning. */
function stubFetch(routes: Record<string, Route>) {
  const calls: string[] = []
  const fn = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input)
    calls.push(url)
    const match = Object.keys(routes)
      .sort((a, b) => b.length - a.length)
      .find((suffix) => url.includes(suffix))
    if (!match) return new Response('{"error":"unrouted"}', { status: 404 })
    const route = routes[match]
    return new Response(JSON.stringify(route.body), {
      status: route.status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fn)
  return { fn, calls }
}

const ENTITLEMENT = {
  '/billing/entitlement': {
    status: 200,
    body: { org: 'octocat', plan: 'free', status: 'canceled', hosted_janitor: false, seats: 0, seats_used: 0 },
  },
}

describe('useFeatureStore', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', API)
    setSession('jwt-test', 'octocat')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  it('loads the board and keeps the cursor for the next page', async () => {
    stubFetch({
      ...ENTITLEMENT,
      '/feature-requests': { status: 200, body: { data: [feature()], next_cursor: 'cur-2' } },
    })
    const store = useFeatureStore()
    await store.init()

    expect(store.requests).toHaveLength(1)
    expect(store.hasMore).toBe(true)
  })

  it('reads the board without a session', async () => {
    clearSession()
    const { calls } = stubFetch({
      '/feature-requests': { status: 200, body: { data: [feature()], next_cursor: null } },
    })
    const store = useFeatureStore()
    await store.load()

    expect(store.requests).toHaveLength(1)
    expect(store.signedIn).toBe(false)
    // No Authorization header to send, and no entitlement call to make.
    expect(calls.some((u) => u.includes('/billing/entitlement'))).toBe(false)
  })

  it('settles a vote against the count the server returns, not its own guess', async () => {
    stubFetch({
      ...ENTITLEMENT,
      '/feature-requests/6c1f0c34-0000-4000-8000-000000000001/votes': {
        status: 201,
        body: {
          feature_request_id: '6c1f0c34-0000-4000-8000-000000000001',
          weight: 5,
          tier: 'pro',
          vote_count: 99,
          created_at: '2026-08-23T11:00:00Z',
        },
      },
      '/feature-requests': { status: 200, body: { data: [feature()], next_cursor: null } },
    })
    const store = useFeatureStore()
    await store.load()
    // The hint says Free; the server says the vote was worth 5. The server wins.
    await store.vote('6c1f0c34-0000-4000-8000-000000000001')

    expect(store.requests[0].vote_count).toBe(99)
    expect(store.requests[0].viewer_vote?.weight).toBe(5)
  })

  it('keeps a request marked as voted when the API says it already was', async () => {
    stubFetch({
      ...ENTITLEMENT,
      '/feature-requests/6c1f0c34-0000-4000-8000-000000000001/votes': {
        status: 409,
        body: { error: 'already voted' },
      },
      '/feature-requests': { status: 200, body: { data: [feature()], next_cursor: null } },
    })
    const store = useFeatureStore()
    await store.load()
    await store.vote('6c1f0c34-0000-4000-8000-000000000001')

    expect(store.requests[0].viewer_vote).not.toBeNull()
    expect(store.requests[0].vote_count).toBe(12)
    expect(store.error).toBe('')
  })

  it('rolls an optimistic vote back when the vote actually fails', async () => {
    stubFetch({
      ...ENTITLEMENT,
      '/feature-requests/6c1f0c34-0000-4000-8000-000000000001/votes': {
        status: 500,
        body: { error: 'internal server error' },
      },
      '/feature-requests': { status: 200, body: { data: [feature()], next_cursor: null } },
    })
    const store = useFeatureStore()
    await store.load()
    await store.vote('6c1f0c34-0000-4000-8000-000000000001')

    expect(store.requests[0].vote_count).toBe(12)
    expect(store.requests[0].viewer_vote).toBeNull()
    expect(store.error).not.toBe('')
  })

  it('will not vote twice on a request it already shows as voted', async () => {
    const { fn } = stubFetch({
      ...ENTITLEMENT,
      '/feature-requests': {
        status: 200,
        body: {
          data: [feature({ viewer_vote: { weight: 1, created_at: '2026-08-23T10:30:00Z' } })],
          next_cursor: null,
        },
      },
    })
    const store = useFeatureStore()
    await store.load()
    const before = fn.mock.calls.length
    await store.vote('6c1f0c34-0000-4000-8000-000000000001')

    expect(fn.mock.calls.length).toBe(before)
  })

  it('debounces the dedup probe and only asks once for a burst of typing', async () => {
    vi.useFakeTimers()
    const { calls } = stubFetch({
      '/feature-requests/similar': {
        status: 200,
        body: { data: [feature()], threshold: 0.78, dedup_available: true },
      },
    })
    const store = useFeatureStore()
    for (const q of ['tailwind t', 'tailwind th', 'tailwind theme']) store.probeSimilar(q)

    expect(calls.filter((u) => u.includes('/similar'))).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(DEDUP_DEBOUNCE_MS + 10)

    const probes = calls.filter((u) => u.includes('/similar'))
    expect(probes).toHaveLength(1)
    expect(probes[0]).toContain('tailwind%20theme')
    expect(store.similar).toHaveLength(1)
  })

  it('does not probe for a title too short to mean anything', async () => {
    vi.useFakeTimers()
    const { calls } = stubFetch({
      '/feature-requests/similar': { status: 200, body: { data: [], threshold: 0.78, dedup_available: true } },
    })
    const store = useFeatureStore()
    store.probeSimilar('dark')
    await vi.advanceTimersByTimeAsync(DEDUP_DEBOUNCE_MS + 10)

    expect(calls.filter((u) => u.includes('/similar'))).toHaveLength(0)
    expect(store.similar).toHaveLength(0)
  })

  it('treats a failed probe as no suggestions, never as a form error', async () => {
    vi.useFakeTimers()
    stubFetch({
      '/feature-requests/similar': { status: 500, body: { error: 'internal server error' } },
    })
    const store = useFeatureStore()
    store.probeSimilar('tailwind theme output')
    await vi.advanceTimersByTimeAsync(DEDUP_DEBOUNCE_MS + 10)

    expect(store.similar).toHaveLength(0)
    expect(store.dedupAvailable).toBe(false)
    expect(store.error).toBe('')
  })

  it('reports dedup as unavailable when the deployment has no provider', async () => {
    vi.useFakeTimers()
    stubFetch({
      '/feature-requests/similar': {
        status: 200,
        body: { data: [], threshold: 0.78, dedup_available: false },
      },
    })
    const store = useFeatureStore()
    store.probeSimilar('tailwind theme output')
    await vi.advanceTimersByTimeAsync(DEDUP_DEBOUNCE_MS + 10)

    expect(store.dedupAvailable).toBe(false)
    expect(store.error).toBe('')
  })

  it('files a request, puts it on the board, and clears the draft', async () => {
    const filed = feature({
      id: '6c1f0c34-0000-4000-8000-000000000002',
      title: 'A brand new ask entirely',
      vote_count: 1,
      author: 'octocat',
      viewer_vote: { weight: 1, created_at: '2026-08-23T12:00:00Z' },
    })
    stubFetch({
      ...ENTITLEMENT,
      '/feature-requests': { status: 201, body: filed },
    })
    const store = useFeatureStore()
    store.draftTitle = 'A brand new ask entirely'
    store.draftDescription = 'because'
    const created = await store.submit()

    expect(created?.id).toBe(filed.id)
    expect(store.requests[0].id).toBe(filed.id)
    expect(store.requests[0].viewer_vote?.weight).toBe(1)
    expect(store.draftTitle).toBe('')
    expect(store.similar).toHaveLength(0)
  })

  it('surfaces a rate limit on filing without losing the draft', async () => {
    stubFetch({
      '/feature-requests': { status: 429, body: { error: 'rate limit exceeded' } },
    })
    const store = useFeatureStore()
    store.draftTitle = 'A brand new ask entirely'
    const created = await store.submit()

    expect(created).toBeNull()
    expect(store.error).toContain('rate limit')
    expect(store.draftTitle).toBe('A brand new ask entirely')
  })

  it('shows the Pro upsell to a signed-in Free account only', async () => {
    stubFetch({
      ...ENTITLEMENT,
      '/feature-requests': { status: 200, body: { data: [], next_cursor: null } },
    })
    const store = useFeatureStore()
    await store.init()

    expect(store.tier).toBe('free')
    expect(store.voteWeight).toBe(1)
    expect(store.showUpsell).toBe(true)
  })

  it('reads a Pro entitlement as a 5x vote hint and hides the upsell', async () => {
    stubFetch({
      '/billing/entitlement': {
        status: 200,
        body: {
          org: 'octocat',
          plan: 'pro_team',
          status: 'active',
          hosted_janitor: true,
          seats: 3,
          seats_used: 1,
        },
      },
      '/feature-requests': { status: 200, body: { data: [], next_cursor: null } },
    })
    const store = useFeatureStore()
    await store.init()

    expect(store.tier).toBe('pro')
    expect(store.voteWeight).toBe(5)
    expect(store.showUpsell).toBe(false)
  })
})

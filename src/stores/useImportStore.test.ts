import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useImportStore } from '@/stores/useImportStore'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import { setSession } from '@/utils/api'
import type { DesignSystemSchema } from '@/types/schema'

// The import flow, with the API stubbed at `fetch`.
//
// The behaviour under test is the split: the server hands back files, the
// browser extracts. So the assertions are that a scan response containing an
// unparseable config still produces a populated schema with provenance — and
// that the Free cap surfaces as an offer, not an error.

const API = 'https://api.test'

const TAILWIND_CONFIG = `import base from '@acme/preset'
export default {
  theme: { extend: { colors: { ...base.colors, brand: '#C8813D', ink: '#1F1D1A' } } },
}
`

const COMPILED_CSS =
  ':root{--color-primary:#4F46E5;--color-surface:#FFFFFF;--color-border:#E2E8F0;' +
  '--spacing-md:16px;--radius-md:8px}'

function scanResponse(overrides: Record<string, unknown> = {}) {
  return {
    import_session_id: 'sess-1',
    repo_full_name: 'octocat/hello-world',
    branch: 'main',
    commit_sha: 'abc1234',
    files: [
      {
        path: 'package.json',
        kind: 'package_json',
        content: JSON.stringify({ name: 'hello-world', dependencies: { react: '^18', tailwindcss: '^3' } }),
      },
      { path: 'tailwind.config.ts', kind: 'tailwind_config', content: TAILWIND_CONFIG },
      { path: 'dist/app.css', kind: 'compiled_css', content: COMPILED_CSS },
    ],
    paths: ['package.json', 'tailwind.config.ts', 'dist/app.css'],
    scan: {
      tree_entries: 3,
      tree_truncated: false,
      files_fetched: 3,
      bytes: 900,
      duration_ms: 1200,
      skipped: [],
    },
    quota: { runs_used: 1, runs_limit: 2, period_end: '2026-09-01T00:00:00Z', unlimited: false },
    created_at: '2026-08-23T10:00:00Z',
    ...overrides,
  }
}

/** Route stubbed responses by URL suffix. */
function stubFetch(routes: Record<string, { status: number; body: unknown }>) {
  const fn = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input)
    const match = Object.keys(routes).find((suffix) => url.includes(suffix))
    if (!match) return new Response('{"error":"unrouted"}', { status: 404 })
    const route = routes[match]
    return new Response(JSON.stringify(route.body), {
      status: route.status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('useImportStore', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', API)
    setSession('jwt-test', 'octocat')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('reads the connection status and moves to the repo picker', async () => {
    stubFetch({
      '/auth/github/status': {
        status: 200,
        body: { connected: true, login: 'octocat', scopes: ['read:user'], can_push: false, can_read_private: false },
      },
    })
    const imports = useImportStore()
    await imports.init()

    expect(imports.connected).toBe(true)
    expect(imports.canPush).toBe(false)
    expect(imports.step).toBe('pick-repo')
  })

  it('extracts a schema in the browser from the files the scan returned', async () => {
    stubFetch({
      '/github/import/sess-1': { status: 200, body: { import_session_id: 'sess-1', status: 'complete', updated_at: 'x' } },
      '/github/import': { status: 201, body: scanResponse() },
    })
    const imports = useImportStore()
    imports.selectedRepo = {
      full_name: 'octocat/hello-world',
      private: false,
      default_branch: 'main',
      pushed_at: '2026-08-01T00:00:00Z',
    }
    imports.selectedBranch = 'main'

    const result = await imports.scan()
    expect(result).not.toBeNull()
    expect(imports.step).toBe('review')

    // The statically safe siblings survived the unparseable spread…
    expect(result!.extraction.schema.colors.brand).toBe('#C8813D')
    expect(result!.extraction.states.colors.brand).toBe('extracted')
    // …and the spread's gap was filled from the compiled bundle.
    expect(result!.extraction.usedFallback).toBe(true)
    expect(result!.extraction.schema.colors.border).toBe('#E2E8F0')
    expect(result!.extraction.states.colors.border).toBe('inferred')
    // Never a dead end: the schema is complete and every semantic slot exists.
    expect(result!.extraction.schema.colors.primary).toBeDefined()
    expect(result!.extraction.summary.extracted).toBeGreaterThan(0)
  })

  it('stores the synthesized schema, never the harvested files', async () => {
    const fetchMock = stubFetch({
      '/github/import/sess-1': { status: 200, body: { import_session_id: 'sess-1', status: 'complete', updated_at: 'x' } },
      '/github/import': { status: 201, body: scanResponse() },
    })
    const imports = useImportStore()
    imports.selectedRepo = {
      full_name: 'octocat/hello-world',
      private: false,
      default_branch: 'main',
      pushed_at: '',
    }
    await imports.scan()

    const patch = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PATCH')
    expect(patch).toBeDefined()
    const body = JSON.parse(String((patch![1] as RequestInit).body))
    expect(body.schema_json.colors.brand).toBe('#C8813D')
    expect(body.token_states.colors.brand).toBe('extracted')
    expect(JSON.stringify(body)).not.toContain('@acme/preset') // no file content
  })

  it('surfaces the Free monthly cap as an offer, not an error', async () => {
    stubFetch({
      '/github/import': {
        status: 403,
        body: {
          error: 'monthly scan limit reached',
          details: { runs_used: '2', runs_limit: '2', plan: 'free' },
        },
      },
    })
    const imports = useImportStore()
    imports.selectedRepo = { full_name: 'octocat/hello-world', private: false, default_branch: 'main', pushed_at: '' }

    const result = await imports.scan()
    expect(result).toBeNull()
    expect(imports.capReached).toBe(true)
    expect(imports.error).toBeNull() // an upgrade prompt renders, not a failure
  })

  it('reports a rate limit as a plain error the user can act on', async () => {
    stubFetch({ '/github/import': { status: 429, body: { error: 'rate limit exceeded' } } })
    const imports = useImportStore()
    imports.selectedRepo = { full_name: 'octocat/hello-world', private: false, default_branch: 'main', pushed_at: '' }

    await imports.scan()
    expect(imports.capReached).toBe(false)
    expect(imports.error).toBe('rate limit exceeded')
  })

  it('opens a retrofit pull request against the scanned branch', async () => {
    const fetchMock = stubFetch({
      '/pull-request': {
        status: 201,
        body: {
          pull_request_url: 'https://github.com/octocat/hello-world/pull/42',
          pull_request_number: 42,
          branch: 'design-spec/retrofit-1787654321',
          commit_sha: 'def5678',
        },
      },
      '/github/import/sess-1': { status: 200, body: { import_session_id: 'sess-1', status: 'complete', updated_at: 'x' } },
      '/github/import': { status: 201, body: scanResponse() },
    })
    const imports = useImportStore()
    imports.selectedRepo = { full_name: 'octocat/hello-world', private: false, default_branch: 'main', pushed_at: '' }
    await imports.scan()

    const pr = await imports.pushRetrofit([{ path: 'DESIGN.md', content: '# x' }])
    expect(pr?.branch).toMatch(/^design-spec\/retrofit-/)

    // The client never names a head branch — that is the server's decision.
    const push = fetchMock.mock.calls.find(([url]) => String(url).includes('/pull-request'))
    const body = JSON.parse(String((push![1] as RequestInit).body))
    expect(body.head_branch).toBeUndefined()
    expect(body.base_branch).toBe('main')
    expect(body.base_commit_sha).toBe('abc1234')
  })

  it('applies a scan to the workspace with its provenance', async () => {
    stubFetch({
      '/github/import/sess-1': { status: 200, body: { import_session_id: 'sess-1', status: 'complete', updated_at: 'x' } },
      '/github/import': { status: 201, body: scanResponse() },
    })
    const imports = useImportStore()
    const design = useDesignSystemStore()
    imports.selectedRepo = { full_name: 'octocat/hello-world', private: false, default_branch: 'main', pushed_at: '' }
    const scanned = await imports.scan()

    design.applyImport(scanned!.extraction.schema as DesignSystemSchema, {
      repoFullName: scanned!.repoFullName,
      branch: scanned!.branch,
      commitSha: scanned!.commitSha,
      importSessionId: scanned!.sessionId,
      signals: scanned!.extraction.signals,
      usedFallback: scanned!.extraction.usedFallback,
      unparseableLayers: scanned!.extraction.unparseableLayers,
      states: scanned!.extraction.states,
      scannedAt: 0,
    })

    expect(design.schema.colors.brand).toBe('#C8813D')
    expect(design.tokenStateFor('colors', 'brand')).toBe('extracted')
    expect(design.tokenStateFor('colors', 'border')).toBe('inferred')
    expect(design.pendingReview.total).toBeGreaterThan(0)
  })

  it('stays inert when no backend is configured', async () => {
    vi.stubEnv('VITE_API_URL', '')
    const fetchMock = stubFetch({})
    const imports = useImportStore()

    expect(imports.available).toBe(false)
    await imports.init() // must not throw, and must not reach the network
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

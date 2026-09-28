import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useSyncStore } from '@/stores/useSyncStore'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import { clearSession, setSession, type DashboardProject, type DeveloperKey } from '@/utils/api'
import { defaultSchema } from '@design-spec/compiler'

// Developer keys and the dashboard copy of a workspace, with the API stubbed at
// `fetch`. The rules under test: a minted key is shown once and never persisted
// by this app, a save carries the revision the workspace last saw, and a stale
// save is a conflict the designer is told about — never an overwrite.

const API = 'https://api.test'
const PLAINTEXT = 'ds_live_' + 'A1b2C3d4E5'.repeat(4)

function key(overrides: Partial<DeveloperKey> = {}): DeveloperKey {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    environment: 'live',
    prefix: 'ds_live_',
    last4: PLAINTEXT.slice(-4),
    created_at: '2026-09-28T10:00:00Z',
    last_used_at: null,
    ...overrides,
  }
}

function project(overrides: Partial<DashboardProject> = {}): DashboardProject {
  return {
    project: 'acme-ui',
    name: 'Acme UI',
    revision: 3,
    updated_by: 'cli',
    created_at: '2026-09-28T10:00:00Z',
    updated_at: '2026-09-28T10:00:00Z',
    ...overrides,
  }
}

interface Call {
  url: string
  method: string
  body?: any
}

type Handler = (call: Call) => { status: number; body?: unknown }

function stubApi(handler: Handler) {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const call: Call = {
        url: String(input),
        method: init?.method ?? 'GET',
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      }
      calls.push(call)
      const r = handler(call)
      return new Response(r.body === undefined ? null : JSON.stringify(r.body), {
        status: r.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )
  return calls
}

describe('useSyncStore', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubEnv('VITE_API_URL', API)
    setSession('jwt-test', 'octocat')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('is unavailable without a session and makes no calls', async () => {
    clearSession()
    const calls = stubApi(() => ({ status: 500 }))
    const sync = useSyncStore()
    await sync.init()
    expect(sync.available).toBe(false)
    expect(calls).toHaveLength(0)
  })

  it('shows a minted key once and never persists the plaintext', async () => {
    stubApi((c) => {
      if (c.url.endsWith('/api-keys') && c.method === 'POST') {
        return { status: 201, body: { ...key(), key: PLAINTEXT } }
      }
      if (c.url.endsWith('/api-keys')) return { status: 200, body: { data: [] } }
      return { status: 200, body: { data: [] } }
    })
    const sync = useSyncStore()
    await sync.init()
    await sync.generateKey('live')

    expect(sync.revealedKey?.key).toBe(PLAINTEXT)
    expect(sync.keys).toHaveLength(1)
    expect(sync.keys[0].key).toBeUndefined()

    for (let i = 0; i < localStorage.length; i++) {
      expect(localStorage.getItem(localStorage.key(i)!)).not.toContain(PLAINTEXT)
    }

    sync.dismissRevealedKey()
    expect(sync.revealedKey).toBeNull()
  })

  it('regenerating replaces the key for that label only', async () => {
    const test = key({ id: '00000000-0000-4000-8000-000000000002', environment: 'test', prefix: 'ds_test_' })
    stubApi((c) => {
      if (c.method === 'POST') return { status: 201, body: { ...key({ id: '00000000-0000-4000-8000-000000000003', last4: 'NEW1' }), key: PLAINTEXT } }
      if (c.url.endsWith('/api-keys')) return { status: 200, body: { data: [key(), test] } }
      return { status: 200, body: { data: [] } }
    })
    const sync = useSyncStore()
    await sync.init()
    await sync.generateKey('live')
    expect(sync.keys.map((k) => `${k.environment}:${k.last4}`).sort()).toEqual(['live:NEW1', `test:${test.last4}`])
  })

  it('revokes a key', async () => {
    const calls = stubApi((c) => {
      if (c.method === 'DELETE') return { status: 204 }
      if (c.url.endsWith('/api-keys')) return { status: 200, body: { data: [key()] } }
      return { status: 200, body: { data: [] } }
    })
    const sync = useSyncStore()
    await sync.init()
    await sync.revokeKey(key().id)
    expect(sync.keys).toHaveLength(0)
    expect(calls.some((c) => c.method === 'DELETE' && c.url.endsWith(`/api-keys/${key().id}`))).toBe(true)
  })

  it('opens a dashboard project as a linked workspace and saves at its revision', async () => {
    const remoteSchema = { ...structuredClone(defaultSchema), name: 'Acme UI' }
    const calls = stubApi((c) => {
      if (c.url.endsWith('/projects/acme-ui') && c.method === 'GET') {
        return { status: 200, body: { ...project(), schema_json: remoteSchema } }
      }
      if (c.url.endsWith('/projects/acme-ui') && c.method === 'PUT') {
        return { status: 200, body: project({ revision: 4, updated_by: 'web' }) }
      }
      return { status: 200, body: { data: [] } }
    })
    const sync = useSyncStore()
    const ds = useDesignSystemStore()
    await sync.init()
    await sync.openProject('acme-ui')

    expect(ds.activeWorkspaceName).toBe('Acme UI')
    expect(ds.schema.name).toBe('Acme UI')
    expect(sync.activeLink).toEqual({ project: 'acme-ui', revision: 3 })

    ds.updatePresentation({ ogImageStrategy: 'server-render' })
    await sync.saveActive()

    const put = calls.find((c) => c.method === 'PUT')!
    expect(put.body.base_revision).toBe(3)
    expect(put.body.schema_json.presentation.ogImageStrategy).toBe('server-render')
    expect(sync.activeLink).toEqual({ project: 'acme-ui', revision: 4 })
    expect(sync.saveError).toBeNull()
  })

  it('a stale save is a conflict the designer is told about', async () => {
    stubApi((c) => {
      if (c.method === 'GET' && c.url.endsWith('/projects/acme-ui')) {
        return { status: 200, body: { ...project(), schema_json: { ...structuredClone(defaultSchema), name: 'Acme UI' } } }
      }
      if (c.method === 'PUT') return { status: 409, body: { error: 'project changed since base_revision' } }
      return { status: 200, body: { data: [] } }
    })
    const sync = useSyncStore()
    await sync.init()
    await sync.openProject('acme-ui')
    await sync.saveActive()
    expect(sync.saveError).toMatch(/changed since you opened/)
    expect(sync.activeLink?.revision).toBe(3) // unchanged
  })

  it('an unlinked workspace creates its project from the schema name, expecting it new', async () => {
    const calls = stubApi((c) => {
      if (c.method === 'PUT') return { status: 201, body: project({ project: 'my-system', revision: 1, updated_by: 'web' }) }
      return { status: 200, body: { data: [] } }
    })
    const ds = useDesignSystemStore()
    ds.updateMeta({ name: 'My System' })
    const sync = useSyncStore()
    await sync.init()
    await sync.saveActive()
    const put = calls.find((c) => c.method === 'PUT')!
    expect(put.url).toMatch(/\/projects\/my-system$/)
    expect(put.body.base_revision).toBe(0)
    expect(sync.activeLink).toEqual({ project: 'my-system', revision: 1 })
  })

  it('explains the Free project limit', async () => {
    stubApi((c) =>
      c.method === 'PUT'
        ? { status: 403, body: { error: 'pro plan required for more than one synced project' } }
        : { status: 200, body: { data: [] } },
    )
    const sync = useSyncStore()
    await sync.init()
    await sync.saveActive()
    expect(sync.saveError).toMatch(/Free accounts sync one project/)
  })

  it('never sends the Figma PAT', async () => {
    localStorage.setItem('dsa-figma-pat', 'figd_secret_pat')
    const calls = stubApi((c) => (c.method === 'PUT' ? { status: 201, body: project({ revision: 1 }) } : { status: 200, body: { data: [] } }))
    const sync = useSyncStore()
    await sync.init()
    await sync.saveActive()
    expect(JSON.stringify(calls)).not.toContain('figd_secret_pat')
  })
})

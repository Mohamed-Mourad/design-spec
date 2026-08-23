import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PushTokensButton from '@/components/import/PushTokensButton.vue'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import { useImportStore } from '@/stores/useImportStore'
import { SCHEMA_FILENAME } from '@/utils/exportBundle'
import { setSession } from '@/utils/api'

// The designer loop's button. The behaviour worth pinning is what it refuses to
// do — appear without a repository to push to, and send anything the workspace
// did not compile.

const API = 'https://api.test'

const PR = {
  pull_request_url: 'https://github.com/octocat/hello-world/pull/43',
  pull_request_number: 43,
  branch: 'design-spec/token-update-1787654321',
  commit_sha: 'd4e5f67',
  changed_tokens: 2,
}

function stubFetch(response: { status: number; body: unknown }) {
  const fn = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(response.body), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      }),
  )
  vi.stubGlobal('fetch', fn)
  return fn
}

/** A workspace that was imported from a repository, as persisted provenance. */
function seedProvenance() {
  const design = useDesignSystemStore()
  design.applyImport(design.schema, {
    repoFullName: 'octocat/hello-world',
    branch: 'main',
    commitSha: 'abc1234',
    importSessionId: 'sess-1',
    signals: [],
    usedFallback: false,
    unparseableLayers: [],
    states: {},
    scannedAt: 0,
  })
  return design
}

/** A connection that holds the escalated grant. */
function seedConnection(canPush: boolean) {
  const imports = useImportStore()
  imports.status = {
    connected: true,
    login: 'octocat',
    can_push: canPush,
    can_read_private: canPush,
  }
  return imports
}

describe('PushTokensButton', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', API)
    setSession('jwt-test', 'octocat')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('stays hidden for a workspace that was never imported', () => {
    seedConnection(true)
    const w = mount(PushTokensButton)

    expect(w.find('[data-testid="push-to-github"]').exists()).toBe(false)
  })

  it('stays hidden when no backend is configured', () => {
    vi.stubEnv('VITE_API_URL', '')
    seedProvenance()
    seedConnection(true)
    const w = mount(PushTokensButton)

    expect(w.find('[data-testid="push-to-github"]').exists()).toBe(false)
  })

  it('pushes the same bundle Export downloads, against the imported session', async () => {
    const fetchMock = stubFetch({ status: 201, body: PR })
    const design = seedProvenance()
    seedConnection(true)
    const w = mount(PushTokensButton)

    await w.find('[data-testid="push-to-github"]').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))

    const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/github/push'))
    expect(call).toBeDefined()
    const body = JSON.parse(String((call![1] as RequestInit).body))
    expect(body.import_session_id).toBe('sess-1')
    expect(body.head_branch).toBeUndefined()

    const paths = body.files.map((f: { path: string }) => f.path)
    expect(paths[0]).toBe(SCHEMA_FILENAME)
    for (const output of design.outputFiles) {
      expect(paths).toContain(output.filename)
    }
    // Every file must carry a real path — an undefined one is dropped by
    // JSON.stringify and rejected by the API.
    expect(paths.every((p: unknown) => typeof p === 'string' && p.length > 0)).toBe(true)
  })

  it('shows the pull request and says who has it now', async () => {
    stubFetch({ status: 201, body: PR })
    seedProvenance()
    seedConnection(true)
    const w = mount(PushTokensButton)

    await w.find('[data-testid="push-to-github"]').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await w.vm.$nextTick()

    const link = w.find('[data-testid="push-pr-link"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe(PR.pull_request_url)
    expect(link.text()).toContain('awaiting developer review')
  })

  it('sends the user to GitHub for write access instead of pushing without it', async () => {
    const fetchMock = stubFetch({ status: 201, body: PR })
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, origin: 'http://localhost:5173', assign })
    seedProvenance()
    seedConnection(false)
    const w = mount(PushTokensButton)

    await w.find('[data-testid="push-to-github"]').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(assign).toHaveBeenCalledOnce()
    expect(String(assign.mock.calls[0][0])).toContain('scope=write')
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/github/push'))).toBe(false)
  })

  it('surfaces a stale workspace as something to do, not a status code', async () => {
    stubFetch({ status: 409, body: { error: 'branch has moved' } })
    seedProvenance()
    seedConnection(true)
    const w = mount(PushTokensButton)

    await w.find('[data-testid="push-to-github"]').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await w.vm.$nextTick()

    expect(w.text()).toContain('Re-import it')
    expect(w.find('[data-testid="push-pr-link"]').exists()).toBe(false)
  })
})

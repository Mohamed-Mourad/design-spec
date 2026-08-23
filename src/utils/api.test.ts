import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  api,
  ApiError,
  apiConfigured,
  captureSessionFromUrl,
  clearSession,
  githubAuthorizeUrl,
  sessionToken,
  setSession,
} from '@/utils/api'

// The session handling and the error envelope. Both are single points of truth
// for the whole app, so both are worth pinning: a session that survives in the
// URL is a token in someone's browser history, and an error shape that varies
// forces callers into string matching.

const API = 'https://api.test'

function stub(status: number, body: unknown) {
  const fn = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  )
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('session handling', () => {
  beforeEach(() => {
    clearSession()
    history.replaceState(null, '', '/settings')
  })

  it('captures a session from the URL fragment and scrubs it from the address bar', () => {
    history.replaceState(null, '', '/settings#ds_token=jwt-abc&login=octocat')

    expect(captureSessionFromUrl()).toBe(true)
    expect(sessionToken()).toBe('jwt-abc')
    // The token must not survive in the URL — that is browser history.
    expect(location.hash).toBe('')
    expect(location.href).not.toContain('jwt-abc')
  })

  it('ignores a fragment that carries no session', () => {
    history.replaceState(null, '', '/settings#something-else')
    expect(captureSessionFromUrl()).toBe(false)
    expect(sessionToken()).toBeNull()
  })

  it('ignores a partial fragment', () => {
    history.replaceState(null, '', '/settings#ds_token=jwt-abc')
    expect(captureSessionFromUrl()).toBe(false)
    expect(sessionToken()).toBeNull()
  })
})

describe('apiConfigured', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('is false with no VITE_API_URL — the app stays fully client-only', () => {
    vi.stubEnv('VITE_API_URL', '')
    expect(apiConfigured()).toBe(false)
  })

  it('is true once a backend is configured', () => {
    vi.stubEnv('VITE_API_URL', API)
    expect(apiConfigured()).toBe(true)
  })
})

describe('request', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', API)
    setSession('jwt-abc', 'octocat')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    clearSession()
  })

  it('attaches the session as a Bearer token', async () => {
    const fetchMock = stub(200, { connected: false, can_push: false, can_read_private: false })
    await api.githubStatus()

    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer jwt-abc')
  })

  it('raises an ApiError carrying the status and the envelope message', async () => {
    stub(403, { error: 'github not connected' })
    await expect(api.githubStatus()).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      message: 'github not connected',
    })
  })

  it('carries a validation details map through', async () => {
    stub(422, { error: 'validation failed', details: { seats: 'minimum 3' } })
    try {
      await api.scan('octocat/hello-world')
      expect.unreachable('should have thrown')
    } catch (e) {
      expect((e as ApiError).details).toEqual({ seats: 'minimum 3' })
    }
  })

  it('drops the session on a 401 so the UI falls back to connecting', async () => {
    stub(401, { error: 'authentication required' })
    await expect(api.githubStatus()).rejects.toThrow()
    expect(sessionToken()).toBeNull()
  })

  it('treats a 204 as an empty success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
    await expect(api.githubDisconnect()).resolves.toBeUndefined()
  })

  it('reports an unreachable API rather than throwing a raw network error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }))
    await expect(api.githubStatus()).rejects.toMatchObject({ status: 0 })
  })

  it('refuses to call out at all when no backend is configured', async () => {
    vi.stubEnv('VITE_API_URL', '')
    const fetchMock = stub(200, {})
    await expect(api.githubStatus()).rejects.toMatchObject({ status: 0 })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('githubAuthorizeUrl', () => {
  beforeEach(() => vi.stubEnv('VITE_API_URL', API))
  afterEach(() => vi.unstubAllEnvs())

  it('asks for the narrow scope by default', () => {
    const url = githubAuthorizeUrl('http://localhost:5173/settings')
    expect(url).toContain('scope=import')
    expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A5173%2Fsettings')
  })

  it('asks for the escalated scope only when told to', () => {
    expect(githubAuthorizeUrl('http://localhost:5173/settings', 'write')).toContain('scope=write')
  })
})

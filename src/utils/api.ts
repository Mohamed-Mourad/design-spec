// api.ts — the typed client for the Design Spec API.
//
// Two rules the rest of the app relies on:
//
//  1. The session JWT lives in localStorage and is attached here, in one place.
//     The Figma PAT is a different secret with a different rule (browser only,
//     never sent anywhere) and must never travel through this module.
//  2. Every failure surfaces as an `ApiError` carrying the HTTP status and the
//     server's `{"error": "..."}` message. Callers branch on `status`, not on
//     string matching, so the contract in
//     design-spec-backend/docs/github-import-contract.md is the only agreement
//     needed between the two repos.

/**
 * Read lazily, not at module load: the value is build-time config in
 * production but must be observable per-call so tests can drive both the
 * configured and the client-only paths.
 */
function apiUrl(): string {
  return (import.meta.env.VITE_API_URL as string | undefined) ?? ''
}

const SESSION_KEY = 'dsa-session-jwt'
const LOGIN_KEY = 'dsa-github-login'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: Record<string, string>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** True when no backend is configured — the app runs fully client-only. */
export function apiConfigured(): boolean {
  return apiUrl() !== ''
}

export function sessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

export function githubLogin(): string | null {
  try {
    return localStorage.getItem(LOGIN_KEY)
  } catch {
    return null
  }
}

export function setSession(token: string, login: string): void {
  try {
    localStorage.setItem(SESSION_KEY, token)
    localStorage.setItem(LOGIN_KEY, login)
  } catch {
    /* private mode — the session just won't survive a reload */
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(LOGIN_KEY)
  } catch {
    /* nothing to clear */
  }
}

/**
 * Capture a session handed back by the OAuth callback in the URL fragment, then
 * scrub it from the address bar so it does not sit in history or get pasted into
 * a bug report.
 */
export function captureSessionFromUrl(): boolean {
  const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash
  if (!hash.includes('ds_token=')) return false
  const params = new URLSearchParams(hash)
  const token = params.get('ds_token')
  const login = params.get('login')
  if (!token || !login) return false
  setSession(token, login)
  history.replaceState(null, '', location.pathname + location.search)
  return true
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  /** Send without the Authorization header (the public OAuth endpoints). */
  anonymous?: boolean
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (!apiConfigured()) {
    throw new ApiError(0, 'This feature needs a Design Spec account. Set VITE_API_URL to enable it.')
  }
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  if (!opts.anonymous) {
    const token = sessionToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let res: Response
  try {
    res = await fetch(`${apiUrl()}/api/v1${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    })
  } catch {
    throw new ApiError(0, 'Could not reach the Design Spec API.')
  }

  if (res.status === 204) return undefined as T

  let payload: unknown = null
  const text = await res.text()
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  if (!res.ok) {
    const envelope = (payload ?? {}) as { error?: string; details?: Record<string, string> }
    if (res.status === 401) clearSession()
    throw new ApiError(res.status, envelope.error ?? `Request failed (${res.status})`, envelope.details)
  }
  return payload as T
}

// ── contract types (mirror docs/github-import-contract.md) ───────────────────

export interface ConnectionStatus {
  connected: boolean
  login?: string
  scopes?: string[]
  can_read_private: boolean
  can_push: boolean
  connected_at?: string
}

export interface GitHubRepo {
  full_name: string
  private: boolean
  default_branch: string
  pushed_at: string
}

export interface GitHubBranch {
  name: string
  commit_sha: string
}

export interface HarvestedFile {
  path: string
  kind:
    | 'package_json'
    | 'pubspec'
    | 'tailwind_config'
    | 'source_css'
    | 'compiled_css'
    | 'dart_theme'
  content: string
  truncated?: boolean
}

export interface ScanStats {
  tree_entries: number
  tree_truncated: boolean
  files_fetched: number
  bytes: number
  duration_ms: number
  skipped: string[]
}

export interface ScanQuota {
  runs_used: number
  runs_limit: number
  period_end: string
  unlimited: boolean
}

export interface ImportScan {
  import_session_id: string
  repo_full_name: string
  branch: string
  commit_sha: string
  files: HarvestedFile[]
  paths: string[]
  scan: ScanStats
  quota: ScanQuota
  created_at: string
}

export interface PullRequestResult {
  pull_request_url: string
  pull_request_number: number
  branch: string
  commit_sha: string
}

/** A designer push also reports how much the pull request actually changes. */
export interface PushResult extends PullRequestResult {
  changed_tokens: number
}

interface Collection<T> {
  data: T[]
  next_cursor: string | null
}

// ── endpoints ────────────────────────────────────────────────────────────────

/**
 * Where to send the browser to start the OAuth dance. `scope: 'write'` asks for
 * the escalated grant (private repos + push); leave it off for the narrow one.
 */
export function githubAuthorizeUrl(redirectUri: string, scope: 'import' | 'write' = 'import'): string {
  const q = new URLSearchParams({ redirect_uri: redirectUri, scope })
  return `${apiUrl()}/api/v1/auth/github/start?${q.toString()}`
}

export const api = {
  githubStatus: () => request<ConnectionStatus>('/auth/github/status'),
  githubDisconnect: () => request<void>('/auth/github', { method: 'DELETE' }),

  repos: (cursor?: string, q?: string) => {
    const params = new URLSearchParams()
    if (cursor) params.set('cursor', cursor)
    if (q) params.set('q', q)
    const qs = params.toString()
    return request<Collection<GitHubRepo>>(`/github/repos${qs ? `?${qs}` : ''}`)
  },

  branches: (fullName: string, cursor?: string) => {
    const params = new URLSearchParams()
    if (cursor) params.set('cursor', cursor)
    const qs = params.toString()
    return request<Collection<GitHubBranch>>(`/github/repos/${fullName}/branches${qs ? `?${qs}` : ''}`)
  },

  scan: (repoFullName: string, branch?: string) =>
    request<ImportScan>('/github/import', {
      method: 'POST',
      body: branch ? { repo_full_name: repoFullName, branch } : { repo_full_name: repoFullName },
    }),

  completeImport: (id: string, schemaJson: unknown, tokenStates: unknown) =>
    request<{ import_session_id: string; status: string; updated_at: string }>(`/github/import/${id}`, {
      method: 'PATCH',
      body: { schema_json: schemaJson, token_states: tokenStates },
    }),

  retrofitPullRequest: (
    id: string,
    body: {
      base_branch: string
      base_commit_sha?: string
      files: { path: string; content: string }[]
      commit_message?: string
    },
  ) => request<PullRequestResult>(`/github/import/${id}/pull-request`, { method: 'POST', body }),

  /**
   * The designer loop: push edited tokens back to the imported repository.
   *
   * The bundle is all this sends. The branch, the base commit, the diff table
   * and the commit message are all the server's — see the backend's
   * docs/github-push-contract.md — so there is deliberately no way to express
   * "push to main" from here.
   */
  pushTokens: (importSessionId: string, files: { path: string; content: string }[]) =>
    request<PushResult>('/github/push', {
      method: 'POST',
      body: { import_session_id: importSessionId, files },
    }),
}

// ── the portfolio layer (mirrors docs/proposals-contract.md) ─────────────────

export interface Proposal {
  slug: string
  url: string
  embed_url: string
  og_image_url: string | null
  og_image_status: 'pending' | 'ready' | 'failed'
  schema_json?: unknown
  created_at: string
  updated_at: string
}

export interface SlugAvailability {
  slug: string
  available: boolean
  reason: 'taken' | 'reserved' | 'invalid' | null
}

export interface SnapshotLink {
  id: string
  url: string
  schema_json?: unknown
  created_at: string
}

/**
 * Read a published proposal or snapshot without a session.
 *
 * The authenticated `request` helper attaches the session JWT and clears it on
 * a 401; neither is right here. A stranger opening `/p/{slug}` has no session
 * to attach, and a stale one must not be destroyed just because they followed
 * a link.
 */
async function publicRequest<T>(path: string): Promise<T> {
  if (!apiConfigured()) {
    throw new ApiError(0, 'This link needs a Design Spec backend to resolve.')
  }
  let res: Response
  try {
    res = await fetch(`${apiUrl()}/api/v1${path}`)
  } catch {
    throw new ApiError(0, 'Could not reach the Design Spec API.')
  }
  const text = await res.text()
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }
  if (!res.ok) {
    const envelope = (payload ?? {}) as { error?: string }
    throw new ApiError(res.status, envelope.error ?? `Request failed (${res.status})`)
  }
  return payload as T
}

export const portfolio = {
  slugAvailability: (slug: string) =>
    request<SlugAvailability>(`/proposals/availability?slug=${encodeURIComponent(slug)}`),

  listProposals: () => request<{ data: Proposal[] }>('/proposals'),

  publish: (slug: string, schema: unknown) =>
    request<Proposal>('/proposals', { method: 'POST', body: { slug, schema_json: schema } }),

  updateProposal: (slug: string, body: { slug?: string; schema_json?: unknown }) =>
    request<Proposal>(`/proposals/${encodeURIComponent(slug)}`, { method: 'PATCH', body }),

  unpublish: (slug: string) =>
    request<void>(`/proposals/${encodeURIComponent(slug)}`, { method: 'DELETE' }),

  /** Public — a reader of `/p/{slug}` has no account. */
  getProposal: (slug: string) => publicRequest<Proposal>(`/proposals/${encodeURIComponent(slug)}`),

  createSnapshot: (schema: unknown) =>
    request<SnapshotLink>('/snapshots', { method: 'POST', body: { schema_json: schema } }),

  /** Public — a reader of `/preview/{id}` has no account either. */
  getSnapshot: (id: string) => publicRequest<SnapshotLink>(`/snapshots/${encodeURIComponent(id)}`),
}

// useImportStore — the Git Import / Retrofit flow.
//
// The division of labour that makes this safe: the backend harvests files and
// never interprets them; this store runs `extractDesignSystem` from
// `@design-spec/compiler` in the browser. The same function the CLI uses, on the
// same file set, so a repo imports identically through either door — and no
// repository code is ever evaluated on a server.
//
// The flow is designed to have no dead end. Extraction always returns a complete
// schema, so `scan()` either produces something applyable or fails at the
// network boundary with a message. There is no "we found your config but can't
// read it, sorry" state.

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { extractDesignSystem } from '@design-spec/compiler'
import type { ImportExtraction, ImportFile } from '@design-spec/compiler'
import type { DesignSystemSchema } from '@/types/schema'
import {
  api,
  ApiError,
  apiConfigured,
  captureSessionFromUrl,
  clearSession,
  githubAuthorizeUrl,
  githubLogin,
  sessionToken,
  type ConnectionStatus,
  type GitHubBranch,
  type GitHubRepo,
  type ImportScan,
  type PullRequestResult,
  type PushResult,
  type ScanQuota,
} from '@/utils/api'
import { trackEvent } from '@/utils/telemetry'

export type ImportStep = 'connect' | 'pick-repo' | 'pick-branch' | 'scanning' | 'review'

/** The result of a scan, ready to apply to a workspace. */
export interface ScanResult {
  extraction: ImportExtraction
  sessionId: string
  repoFullName: string
  branch: string
  commitSha: string
  quota: ScanQuota
  filesFetched: number
  skipped: string[]
  durationMs: number
}

/** Where the OAuth callback sends the browser back to. */
function redirectTarget(): string {
  return `${location.origin}/settings`
}

export const useImportStore = defineStore('gitImport', () => {
  const step = ref<ImportStep>('connect')
  const busy = ref(false)
  const error = ref<string | null>(null)
  /** Set when the Free monthly cap is spent — an upgrade prompt, not a failure. */
  const capReached = ref(false)

  const status = ref<ConnectionStatus | null>(null)
  const repos = ref<GitHubRepo[]>([])
  const reposCursor = ref<string | null>(null)
  const repoQuery = ref('')
  const selectedRepo = ref<GitHubRepo | null>(null)
  const branches = ref<GitHubBranch[]>([])
  const selectedBranch = ref<string | null>(null)
  const result = ref<ScanResult | null>(null)
  const pullRequest = ref<PullRequestResult | null>(null)
  const tokenPushResult = ref<PushResult | null>(null)
  const tokenPushError = ref<string | null>(null)
  const pushingTokens = ref(false)

  const available = computed(() => apiConfigured())
  const connected = computed(() => status.value?.connected === true)
  const canPush = computed(() => status.value?.can_push === true)
  const login = computed(() => status.value?.login ?? githubLogin() ?? '')

  function reset() {
    error.value = null
    capReached.value = false
    selectedRepo.value = null
    selectedBranch.value = null
    branches.value = []
    result.value = null
    pullRequest.value = null
    step.value = connected.value ? 'pick-repo' : 'connect'
  }

  /** Turn any failure into a message the user can act on. */
  function fail(e: unknown): void {
    if (e instanceof ApiError) {
      if (e.status === 403 && e.message === 'monthly scan limit reached') {
        capReached.value = true
        error.value = null
        return
      }
      error.value = e.details
        ? `${e.message} (${Object.entries(e.details).map(([k, v]) => `${k}: ${v}`).join(', ')})`
        : e.message
      return
    }
    error.value = e instanceof Error ? e.message : 'Something went wrong.'
  }

  /**
   * Pick up a session from the OAuth redirect, then read the connection status.
   * Safe to call on every mount.
   */
  async function init(): Promise<void> {
    if (!available.value) return
    captureSessionFromUrl()
    if (!sessionToken()) {
      status.value = { connected: false, can_push: false, can_read_private: false }
      step.value = 'connect'
      return
    }
    busy.value = true
    try {
      status.value = await api.githubStatus()
      if (status.value.connected && step.value === 'connect') step.value = 'pick-repo'
    } catch (e) {
      fail(e)
    } finally {
      busy.value = false
    }
  }

  /** Leave the app for GitHub. `escalate` asks for private-repo read + push. */
  function connect(escalate = false): void {
    trackEvent('github_connect_start', { escalate })
    location.assign(githubAuthorizeUrl(redirectTarget(), escalate ? 'write' : 'import'))
  }

  async function disconnect(): Promise<void> {
    busy.value = true
    try {
      await api.githubDisconnect()
    } catch (e) {
      fail(e)
    } finally {
      clearSession()
      status.value = { connected: false, can_push: false, can_read_private: false }
      repos.value = []
      reset()
      busy.value = false
    }
  }

  async function loadRepos(append = false): Promise<void> {
    busy.value = true
    error.value = null
    try {
      const page = await api.repos(append ? (reposCursor.value ?? undefined) : undefined, repoQuery.value || undefined)
      repos.value = append ? [...repos.value, ...page.data] : page.data
      reposCursor.value = page.next_cursor
      step.value = 'pick-repo'
    } catch (e) {
      fail(e)
    } finally {
      busy.value = false
    }
  }

  async function selectRepo(repo: GitHubRepo): Promise<void> {
    selectedRepo.value = repo
    selectedBranch.value = repo.default_branch
    busy.value = true
    error.value = null
    try {
      const page = await api.branches(repo.full_name)
      branches.value = page.data
      step.value = 'pick-branch'
    } catch (e) {
      fail(e)
    } finally {
      busy.value = false
    }
  }

  /**
   * Scan the selected repo and extract a schema from it.
   *
   * The extraction runs here, in the browser, against the shared compiler. The
   * synthesized schema is sent back for storage; the harvested files are not —
   * they were never persisted server-side and are dropped from memory when this
   * function returns.
   */
  async function scan(): Promise<ScanResult | null> {
    const repo = selectedRepo.value
    if (!repo) return null

    step.value = 'scanning'
    busy.value = true
    error.value = null
    capReached.value = false
    try {
      const harvest: ImportScan = await api.scan(repo.full_name, selectedBranch.value ?? undefined)
      const extraction = extractDesignSystem({
        repo: harvest.repo_full_name,
        files: harvest.files as ImportFile[],
        paths: harvest.paths,
      })

      const scanned: ScanResult = {
        extraction,
        sessionId: harvest.import_session_id,
        repoFullName: harvest.repo_full_name,
        branch: harvest.branch,
        commitSha: harvest.commit_sha,
        quota: harvest.quota,
        filesFetched: harvest.scan.files_fetched,
        skipped: harvest.scan.skipped,
        durationMs: harvest.scan.duration_ms,
      }
      result.value = scanned
      step.value = 'review'

      trackEvent('github_import_scan', {
        files: scanned.filesFetched,
        used_fallback: extraction.usedFallback,
        unparseable_layers: extraction.unparseableLayers.length,
        extracted: extraction.summary.extracted,
        inferred: extraction.summary.inferred,
        defaulted: extraction.summary.defaulted,
      })

      // Persist the synthesized schema against the session. Best-effort: the
      // user already has a usable workspace either way.
      try {
        await api.completeImport(scanned.sessionId, extraction.schema, extraction.states)
      } catch {
        /* the workspace is local-first; a failed sync is not a failed import */
      }
      return scanned
    } catch (e) {
      fail(e)
      step.value = selectedRepo.value ? 'pick-branch' : 'pick-repo'
      return null
    } finally {
      busy.value = false
    }
  }

  /** Open a retrofit PR against the scanned branch. Pro only. */
  async function pushRetrofit(files: { path: string; content: string }[]): Promise<PullRequestResult | null> {
    const scanned = result.value
    if (!scanned) return null
    busy.value = true
    error.value = null
    try {
      const pr = await api.retrofitPullRequest(scanned.sessionId, {
        base_branch: scanned.branch,
        base_commit_sha: scanned.commitSha,
        files,
      })
      pullRequest.value = pr
      trackEvent('github_retrofit_pr', { files: files.length })
      return pr
    } catch (e) {
      fail(e)
      return null
    } finally {
      busy.value = false
    }
  }

  /**
   * The designer loop: push the workspace's compiled bundle back to the
   * repository it was imported from, as a pull request.
   *
   * Kept on its own state rather than sharing the retrofit's, because the two
   * run from different places — the retrofit from the import dialog, this from
   * the workspace header, potentially long after — and one must never clear the
   * other's result out from under the user.
   *
   * The session id comes from the caller because the workspace outlives this
   * store's in-memory scan: provenance is persisted per workspace, so a designer
   * can reload, edit for an hour, and still push to the repo they imported.
   */
  async function pushTokenUpdate(
    sessionId: string,
    files: { path: string; content: string }[],
  ): Promise<PushResult | null> {
    pushingTokens.value = true
    tokenPushError.value = null
    try {
      const pushed = await api.pushTokens(sessionId, files)
      tokenPushResult.value = pushed
      trackEvent('github_token_push', { files: files.length, changed_tokens: pushed.changed_tokens })
      return pushed
    } catch (e) {
      tokenPushError.value = pushFailure(e)
      return null
    } finally {
      pushingTokens.value = false
    }
  }

  /**
   * Push failures are the one place where the raw contract message is not the
   * best thing to show: each one has an obvious next move, and saying it is more
   * useful than restating the status.
   */
  function pushFailure(e: unknown): string {
    if (!(e instanceof ApiError)) {
      return e instanceof Error ? e.message : 'Something went wrong.'
    }
    switch (e.status) {
      case 409:
        return 'The branch moved since this workspace was imported. Re-import it to push these edits.'
      case 422:
        return 'No token changes to push — the repository already has these values.'
      case 403:
        if (e.message === 'pro plan required') return 'Pushing a pull request needs a Pro Team plan.'
        if (e.message === 'push access not granted') return 'Grant repository write access to push.'
        return e.message
      default:
        return e.message
    }
  }

  /** The schema a completed scan produced, for the caller to apply. */
  const scannedSchema = computed<DesignSystemSchema | null>(
    () => (result.value?.extraction.schema as DesignSystemSchema | undefined) ?? null,
  )

  return {
    step,
    busy,
    error,
    capReached,
    status,
    repos,
    reposCursor,
    repoQuery,
    selectedRepo,
    branches,
    selectedBranch,
    result,
    pullRequest,
    tokenPushResult,
    tokenPushError,
    pushingTokens,
    available,
    connected,
    canPush,
    login,
    scannedSchema,
    init,
    connect,
    disconnect,
    loadRepos,
    selectRepo,
    scan,
    pushRetrofit,
    pushTokenUpdate,
    reset,
  }
})

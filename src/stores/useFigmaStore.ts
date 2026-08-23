// useFigmaStore — importing a design system out of Figma.
//
// The whole flow runs in the browser. The PAT is read from localStorage and
// handed to `client.ts`, which calls api.figma.com directly; the Design Spec API
// is involved only to answer whether this account is on Pro, and it is never
// told the token, the file key, or anything the file contains
// (architecture-plan.md §15).
//
// Styles are the Free baseline. Variables — and the dark mode a second variable
// mode produces — are the Pro half, gated here and, independently, by whatever
// Figma plan the file lives on.

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { diffTokens, isEmptyDelta, type TokenDelta } from '@design-spec/compiler'
import {
  api,
  ApiError,
  apiConfigured,
  githubLogin,
  sessionToken,
  staging,
  type StagedChange,
} from '@/utils/api'
import { clearFigmaPat, figmaPat, setFigmaPat } from '@/utils/figma/pat'
import { fetchFileMeta, FigmaError, importFromFigma } from '@/utils/figma/client'
import { figmaFileKey, type FigmaImport, type FigmaMergeMode } from '@/utils/figma/map'
import type { FigmaFileMeta } from '@/utils/figma/types'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import { trackEvent } from '@/utils/telemetry'

/** The Figma file a workspace was last imported from. */
export interface FigmaLink {
  fileKey: string
  fileName: string
  /** The file version at import — what change detection compares against. */
  version: string
  importedAt: number
}

const linkKey = (workspaceId: string) => `dsa-ws-figma-${workspaceId}`

/**
 * The workspace as it stood the moment Figma's tokens landed in it.
 *
 * Staging a change means answering "what have I changed since I took these
 * tokens from the file", and that needs the before. Keeping it beside the link
 * rather than inside it means the link stays a small record that is read on
 * every badge render, while this is read only when something is staged.
 */
const baselineKey = (workspaceId: string) => `dsa-ws-figma-base-${workspaceId}`

export const useFigmaStore = defineStore('figma', () => {
  const design = useDesignSystemStore()

  const pat = ref(figmaPat() ?? '')
  const fileInput = ref('')
  const mergeMode = ref<FigmaMergeMode>('merge')

  const busy = ref(false)
  const error = ref<string | null>(null)
  const file = ref<FigmaFileMeta | null>(null)
  const imported = ref<FigmaImport | null>(null)

  /** Pro unlocks variables, modes and change detection. */
  const isPro = ref(false)
  const entitlementChecked = ref(false)

  const link = ref<FigmaLink | null>(readLink(design.activeWorkspaceId))

  /** The linked file moved since the tokens were taken. Never applied on its own. */
  const changeAvailable = ref(false)
  const remoteVersion = ref<string | null>(null)
  let pollTimer: ReturnType<typeof setInterval> | undefined

  /** The workspace as Figma left it — the "before" of anything staged back. */
  const baseline = ref<unknown>(readBaseline(design.activeWorkspaceId))
  const staging_ = ref(false)
  const stageError = ref<string | null>(null)
  const staged = ref<StagedChange | null>(null)
  const queue = ref<StagedChange[]>([])

  const hasPat = computed(() => pat.value.trim().length > 0)
  const fileKey = computed(() => figmaFileKey(fileInput.value))
  const canImport = computed(() => hasPat.value && fileKey.value !== null && !busy.value)

  function readLink(workspaceId: string): FigmaLink | null {
    try {
      const raw = localStorage.getItem(linkKey(workspaceId))
      return raw ? (JSON.parse(raw) as FigmaLink) : null
    } catch {
      return null
    }
  }

  function writeLink(next: FigmaLink | null): void {
    link.value = next
    try {
      const key = linkKey(design.activeWorkspaceId)
      if (next) localStorage.setItem(key, JSON.stringify(next))
      else localStorage.removeItem(key)
    } catch {
      /* private mode — the link just won't survive a reload */
    }
  }

  function readBaseline(workspaceId: string): unknown {
    try {
      const raw = localStorage.getItem(baselineKey(workspaceId))
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  function writeBaseline(schema: unknown): void {
    baseline.value = schema
    try {
      const key = baselineKey(design.activeWorkspaceId)
      if (schema) localStorage.setItem(key, JSON.stringify(schema))
      else localStorage.removeItem(key)
    } catch {
      /* private mode — staging will simply have nothing to diff against */
    }
  }

  /** Re-read the link after a workspace switch; each workspace has its own file. */
  function syncWorkspace(): void {
    link.value = readLink(design.activeWorkspaceId)
    baseline.value = readBaseline(design.activeWorkspaceId)
    changeAvailable.value = false
    remoteVersion.value = null
    staged.value = null
    stageError.value = null
  }

  // ── the token ──────────────────────────────────────────────────────────────

  function rememberPat(token: string): void {
    pat.value = token.trim()
    setFigmaPat(pat.value)
  }

  function forgetPat(): void {
    pat.value = ''
    clearFigmaPat()
  }

  // ── entitlement ────────────────────────────────────────────────────────────

  /**
   * Ask the API whether this account is on Pro. A build with no API configured
   * is client-only and therefore Free — the same answer Phase 5 gives for cloud
   * scans, and the honest one: there is nobody to have subscribed.
   */
  async function checkEntitlement(): Promise<void> {
    entitlementChecked.value = true
    isPro.value = false
    const org = githubLogin()
    if (!apiConfigured() || !sessionToken() || !org) return
    try {
      isPro.value = (await api.entitlement(org)).hosted_janitor
    } catch (e) {
      // A billing outage must not present as "your import is broken".
      if (!(e instanceof ApiError)) throw e
    }
  }

  async function init(): Promise<void> {
    syncWorkspace()
    if (!entitlementChecked.value) await checkEntitlement()
  }

  // ── the import ─────────────────────────────────────────────────────────────

  function fail(e: unknown): void {
    if (e instanceof FigmaError) {
      error.value = e.message
      return
    }
    error.value = e instanceof Error ? e.message : 'Something went wrong reading that file.'
  }

  /** Read the file and produce tokens, without touching the workspace yet. */
  async function runImport(): Promise<FigmaImport | null> {
    const key = fileKey.value
    if (!key || !hasPat.value) return null
    busy.value = true
    error.value = null
    imported.value = null
    try {
      const result = await importFromFigma(key, pat.value, { includeVariables: isPro.value })
      file.value = result.file
      imported.value = result.imported
      trackEvent('figma_import_read', {
        styles: result.imported.counts.styles,
        variables: result.imported.counts.variables,
        tokens: result.imported.counts.tokens,
        skipped: result.imported.notes.length,
        pro: isPro.value,
      })
      return result.imported
    } catch (e) {
      fail(e)
      return null
    } finally {
      busy.value = false
    }
  }

  /**
   * Fold the read tokens into the active workspace and remember the file.
   *
   * Remembering happens here rather than in `runImport` on purpose: a designer
   * who reads a file and then backs out has not linked anything, and a workspace
   * that claimed a Figma link it never took tokens from would raise change
   * badges about a file it does not follow.
   */
  function applyToWorkspace(): boolean {
    const result = imported.value
    const meta = file.value
    const key = fileKey.value
    if (!result || !meta || !key) return false

    design.applyFigmaImport(result, mergeMode.value)
    writeLink({
      fileKey: key,
      fileName: meta.name,
      version: meta.version,
      importedAt: Date.now(),
    })
    changeAvailable.value = false
    remoteVersion.value = meta.version
    // The workspace now agrees with the file; that agreement is the "before"
    // any future staged change is measured against.
    writeBaseline(JSON.parse(JSON.stringify(design.schema)))
    staged.value = null
    trackEvent('figma_import_apply', { mode: mergeMode.value, tokens: result.counts.tokens })
    return true
  }

  /** Stop following the linked file, keeping the tokens it produced. */
  function unlink(): void {
    stopWatching()
    changeAvailable.value = false
    remoteVersion.value = null
    staged.value = null
    queue.value = []
    writeBaseline(null)
    writeLink(null)
  }

  // ── staging back to Figma ──────────────────────────────────────────────────

  /**
   * What this workspace has changed since it took its tokens from the file.
   *
   * The diff runs against the shared `diffTokens` from @design-spec/compiler —
   * the same function the plugin reads the result with and the backend mirrors
   * for pull-request bodies. One definition of "changed", three readers.
   */
  const pendingDelta = computed<TokenDelta>(() => diffTokens(baseline.value, design.schema))

  const canStage = computed(
    () => isPro.value && link.value !== null && !isEmptyDelta(pendingDelta.value),
  )

  /**
   * Queue the delta for a designer to approve inside Figma.
   *
   * Nothing here touches the file. The API stores an intent; the plugin renders
   * it, a person decides, and the plugin — inside Figma's own context — is what
   * writes to the canvas (architecture-plan.md §19.1).
   */
  async function stageChanges(): Promise<StagedChange | null> {
    const current = link.value
    const user = githubLogin()
    if (!current || !user || isEmptyDelta(pendingDelta.value)) return null

    staging_.value = true
    stageError.value = null
    try {
      const change = await staging.stage(user, current.fileKey, {
        schema_name: design.schema.name,
        ...pendingDelta.value,
      })
      staged.value = change
      // Move the baseline forward so a second click does not queue the same
      // change again while the first is still waiting for a designer.
      writeBaseline(JSON.parse(JSON.stringify(design.schema)))
      trackEvent('figma_stage_change', { changes: pendingDelta.value.changes.length })
      return change
    } catch (e) {
      stageError.value = stageFailure(e)
      return null
    } finally {
      staging_.value = false
    }
  }

  /** Read what is still waiting on a designer, for the button's own status. */
  async function loadQueue(): Promise<void> {
    const current = link.value
    const user = githubLogin()
    if (!current || !user || !apiConfigured() || !sessionToken()) return
    try {
      queue.value = (await staging.list(user, current.fileKey)).data
    } catch {
      /* the queue is a status line, not a feature — a failed read stays quiet */
    }
  }

  function stageFailure(e: unknown): string {
    if (!(e instanceof ApiError)) {
      return e instanceof Error ? e.message : 'Something went wrong.'
    }
    switch (e.status) {
      case 403:
        return 'Staging a change for Figma approval needs a Pro Team plan.'
      case 409:
        return 'Too many changes are already waiting for approval in that file.'
      case 413:
      case 422:
        return 'That is too big a change to stage in one go. Push part of it first.'
      default:
        return e.message
    }
  }

  // ── change detection ───────────────────────────────────────────────────────

  /**
   * How often the linked file's version is checked while the workspace is open.
   *
   * Sixty seconds is the number in the plan and it is a deliberate ceiling on
   * how much of a designer's Figma rate limit this costs: `?depth=1` is the
   * cheapest read the API offers, and one a minute is well inside the budget of
   * a token that is also being used interactively.
   */
  const POLL_INTERVAL_MS = 60_000

  const canWatch = computed(() => isPro.value && hasPat.value && link.value !== null)

  /**
   * Check the linked file's version once.
   *
   * Deliberately silent about failures: this runs in the background on a timer,
   * and a red banner appearing because Figma rate-limited a poll would be
   * alarming out of all proportion. An unusable token is different — it will
   * never succeed, so watching stops rather than retrying every minute forever.
   */
  async function checkForChange(): Promise<boolean> {
    const current = link.value
    if (!current || !hasPat.value) return false
    try {
      const meta = await fetchFileMeta(current.fileKey, pat.value)
      remoteVersion.value = meta.version
      changeAvailable.value = meta.version !== current.version
      if (changeAvailable.value) {
        trackEvent('figma_change_detected', { file_key: current.fileKey })
      }
      return changeAvailable.value
    } catch (e) {
      if (e instanceof FigmaError && (e.status === 401 || e.status === 403 || e.status === 404)) {
        stopWatching()
      }
      return false
    }
  }

  /**
   * Poll the linked file while the workspace is open. Nothing is ever applied
   * from here — the badge offers a sync, a person decides (§15).
   */
  function startWatching(): void {
    stopWatching()
    if (!canWatch.value) return
    void checkForChange()
    pollTimer = setInterval(() => {
      // A hidden tab is a tab nobody is looking at; skipping the tick keeps a
      // workspace left open overnight from spending a rate limit on nothing.
      if (typeof document !== 'undefined' && document.hidden) return
      void checkForChange()
    }, POLL_INTERVAL_MS)
  }

  function stopWatching(): void {
    if (pollTimer !== undefined) {
      clearInterval(pollTimer)
      pollTimer = undefined
    }
  }

  /**
   * Accept the new version without importing it — "I know, and I don't want
   * those changes". Follows the file from here, so the badge stays quiet until
   * it moves again.
   */
  function acknowledgeChange(): void {
    const current = link.value
    if (!current || !remoteVersion.value) return
    writeLink({ ...current, version: remoteVersion.value })
    changeAvailable.value = false
  }

  function reset(): void {
    error.value = null
    imported.value = null
    file.value = null
    fileInput.value = link.value?.fileKey ?? ''
  }

  return {
    pat,
    fileInput,
    mergeMode,
    busy,
    error,
    file,
    imported,
    isPro,
    entitlementChecked,
    link,
    changeAvailable,
    remoteVersion,
    pendingDelta,
    canStage,
    staging: staging_,
    stageError,
    staged,
    queue,
    hasPat,
    fileKey,
    canImport,
    canWatch,
    init,
    syncWorkspace,
    checkEntitlement,
    rememberPat,
    forgetPat,
    runImport,
    applyToWorkspace,
    unlink,
    stageChanges,
    loadQueue,
    checkForChange,
    startWatching,
    stopWatching,
    acknowledgeChange,
    reset,
  }
})

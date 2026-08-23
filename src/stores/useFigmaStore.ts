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
import { api, ApiError, apiConfigured, githubLogin, sessionToken } from '@/utils/api'
import { clearFigmaPat, figmaPat, setFigmaPat } from '@/utils/figma/pat'
import { FigmaError, importFromFigma } from '@/utils/figma/client'
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

  /** Re-read the link after a workspace switch; each workspace has its own file. */
  function syncWorkspace(): void {
    link.value = readLink(design.activeWorkspaceId)
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
    trackEvent('figma_import_apply', { mode: mergeMode.value, tokens: result.counts.tokens })
    return true
  }

  /** Stop following the linked file, keeping the tokens it produced. */
  function unlink(): void {
    writeLink(null)
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
    hasPat,
    fileKey,
    canImport,
    init,
    syncWorkspace,
    checkEntitlement,
    rememberPat,
    forgetPat,
    runImport,
    applyToWorkspace,
    unlink,
    reset,
  }
})

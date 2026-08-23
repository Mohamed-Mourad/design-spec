import { ref, computed, watch, watchEffect } from 'vue'
import { defineStore } from 'pinia'
import { compileDesignMd, compileSkillMd, compileAll } from '@design-spec/compiler'
import type { ExtractionSignal, TokenState, TokenStateMap } from '@design-spec/compiler'
import type { BentoLayoutConfig, DesignSystemSchema, WebPresentationConfig } from '@/types/schema'
import type { FileOutput, Framework } from '@/types/compiler'
import { defaultSchema } from '@/defaults/schema'
import { applyFigmaImport as foldFigmaImport, type FigmaImport, type FigmaMergeMode } from '@/utils/figma/map'

const LEGACY_KEY = 'dsa-schema-v1' // single-schema storage, pre-workspaces
const WS_LIST_KEY = 'dsa-workspaces-v1'
const WS_ACTIVE_KEY = 'dsa-active-workspace-v1'
const wsSchemaKey = (id: string) => `dsa-ws-${id}`
const wsImportKey = (id: string) => `dsa-ws-import-${id}`
const HISTORY_LIMIT = 50
const TRACE_LIMIT = 100

/**
 * Where a workspace's tokens came from, when it was populated by scanning a
 * repository. Provenance is workspace state, not schema state: the exported
 * schema is identical whether it was hand-authored or imported.
 */
export interface ImportProvenance {
  repoFullName: string
  branch: string
  commitSha: string
  importSessionId: string
  /** What the scan found, skipped, and inferred — shown in the import report. */
  signals: ExtractionSignal[]
  usedFallback: boolean
  unparseableLayers: string[]
  states: TokenStateMap
  scannedAt: number
}

export interface ActionEntry {
  ts: number
  action: string
  args: unknown[]
}

export interface WorkspaceMeta {
  id: string
  name: string
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Recursively fill keys present in `defaults` but missing from `target`, at any
 * depth, without overwriting existing values (scalars and arrays the user has
 * are kept as-is). Lets new default tokens land inside existing blueprints —
 * e.g. a surface background added to an Alert variant the user already has.
 */
function deepFillMissing(target: Record<string, unknown>, defaults: Record<string, unknown>): void {
  for (const [key, dv] of Object.entries(defaults)) {
    if (target[key] === undefined) {
      target[key] = structuredClone(dv)
    } else if (isPlainObject(dv) && isPlainObject(target[key])) {
      deepFillMissing(target[key] as Record<string, unknown>, dv)
    }
  }
}

function fillMissingDefaults(stored: Record<string, unknown>): DesignSystemSchema {
  deepFillMissing(stored, defaultSchema as unknown as Record<string, unknown>)
  return stored as unknown as DesignSystemSchema
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function loadSchemaFor(id: string): DesignSystemSchema {
  const raw = readJson<Record<string, unknown>>(wsSchemaKey(id))
  return raw ? fillMissingDefaults(raw) : structuredClone(defaultSchema)
}

/** Load the workspace list + active id, migrating the legacy single schema once. */
function initWorkspaces(): { list: WorkspaceMeta[]; activeId: string } {
  let list = readJson<WorkspaceMeta[]>(WS_LIST_KEY)
  if (!list || list.length === 0) {
    const id = newId()
    list = [{ id, name: 'My workspace' }]
    const legacy = readJson<Record<string, unknown>>(LEGACY_KEY)
    const schema = legacy ? fillMissingDefaults(legacy) : structuredClone(defaultSchema)
    localStorage.setItem(wsSchemaKey(id), JSON.stringify(schema))
    localStorage.setItem(WS_LIST_KEY, JSON.stringify(list))
    localStorage.setItem(WS_ACTIVE_KEY, id)
  }
  let activeId = localStorage.getItem(WS_ACTIVE_KEY) ?? list[0].id
  if (!list.some((w) => w.id === activeId)) activeId = list[0].id
  return { list, activeId }
}

export const useDesignSystemStore = defineStore('designSystem', () => {
  // ── Workspaces ──
  const wsInit = initWorkspaces()
  const workspaces = ref<WorkspaceMeta[]>(wsInit.list)
  const activeWorkspaceId = ref<string>(wsInit.activeId)

  // ── Core state ──
  const schema = ref<DesignSystemSchema>(loadSchemaFor(wsInit.activeId))
  const importProvenance = ref<ImportProvenance | null>(
    readJson<ImportProvenance>(wsImportKey(wsInit.activeId)),
  )
  const activeEditorTab = ref<string>('colors')
  // The component selected for editing (from the preview or the Components tab).
  const selectedComponent = ref<string | null>(null)
  function selectComponent(name: string | null) {
    selectedComponent.value = name
    if (name) activeEditorTab.value = 'components'
  }
  const activePreviewFile = ref<string>('DESIGN.md')
  const activeViewport = ref<'mobile' | 'tablet' | 'desktop' | 'fit'>('desktop')
  // Pixel width each viewport constrains the preview to (fit = fluid).
  const VIEWPORT_WIDTHS: Record<string, number> = { mobile: 375, tablet: 768, desktop: 1280, fit: Infinity }
  const viewportWidth = computed(() => VIEWPORT_WIDTHS[activeViewport.value])
  function setViewport(v: 'mobile' | 'tablet' | 'desktop' | 'fit') {
    activeViewport.value = v
  }

  // Preview-only dark mode (applies schema.darkMode.colors); independent of the
  // exported darkMode.enabled flag.
  const previewDark = ref(false)
  function togglePreviewDark() {
    previewDark.value = !previewDark.value
  }

  // ── Action trace (rolling 100 entries — attached to error reports) ──
  const actionTrace = ref<ActionEntry[]>([])

  function logAction(action: string, args: unknown[]) {
    actionTrace.value.push({ ts: Date.now(), action, args })
    if (actionTrace.value.length > TRACE_LIMIT) actionTrace.value.shift()
  }

  // ── Undo/redo ──
  const historyStack = ref<string[]>([JSON.stringify(schema.value)])
  const historyIndex = ref(0)
  const canUndo = computed(() => historyIndex.value > 0)
  const canRedo = computed(() => historyIndex.value < historyStack.value.length - 1)

  // History batching: while a batch is open (e.g. dragging the color picker),
  // mutations apply live but don't push undo steps; one step is pushed on close.
  const batchDepth = ref(0)
  let batchDirty = false

  function pushSnapshot() {
    const snap = JSON.stringify(schema.value)
    historyStack.value = historyStack.value.slice(0, historyIndex.value + 1)
    historyStack.value.push(snap)
    if (historyStack.value.length > HISTORY_LIMIT) {
      historyStack.value.shift()
    } else {
      historyIndex.value++
    }
  }

  function snapshot() {
    if (batchDepth.value > 0) {
      batchDirty = true
      return
    }
    pushSnapshot()
  }

  /** Open a history batch — subsequent mutations coalesce into one undo step. */
  function beginBatch() {
    if (batchDepth.value === 0) batchDirty = false
    batchDepth.value++
  }

  /** Close a history batch; pushes a single snapshot if anything changed. */
  function endBatch() {
    if (batchDepth.value === 0) return
    batchDepth.value--
    if (batchDepth.value === 0 && batchDirty) {
      batchDirty = false
      pushSnapshot()
    }
  }

  function undo() {
    if (!canUndo.value) return
    logAction('undo', [])
    historyIndex.value--
    schema.value = JSON.parse(historyStack.value[historyIndex.value]) as DesignSystemSchema
  }

  function redo() {
    if (!canRedo.value) return
    logAction('redo', [])
    historyIndex.value++
    schema.value = JSON.parse(historyStack.value[historyIndex.value]) as DesignSystemSchema
  }

  // ── Compiled outputs (pure (schema) => string from @design-spec/compiler) ──
  const designMd = computed<string>(() => compileDesignMd(schema.value))
  const skillMd = computed<string>(() => compileSkillMd(schema.value))
  const outputFiles = computed<FileOutput[]>(() => compileAll(schema.value))

  // ── Import provenance (Extracted / Verify / Review chips) ──

  /**
   * Groups are dotted so one flat map covers nested schema groups. Longest match
   * wins, so `darkMode.colors` is never mistaken for `darkMode`.
   */
  function groupAndKeyFor(path: (string | number)[]): { group: string; key: string } | null {
    const states = importProvenance.value?.states
    if (!states || path.length < 2) return null
    for (let depth = Math.min(path.length - 1, 3); depth >= 1; depth--) {
      const group = path.slice(0, depth).join('.')
      if (states[group]) return { group, key: String(path[depth]) }
    }
    return null
  }

  /** The provenance of one token, or null when this workspace was not imported. */
  function tokenStateFor(group: string, key: string): TokenState | null {
    return importProvenance.value?.states[group]?.[key] ?? null
  }

  /**
   * Drop a token's flag. Called when the user edits or explicitly confirms it —
   * a human has now looked at the value, which is exactly what Verify/Review
   * were asking for. Never reintroduces a flag.
   */
  function clearTokenState(group: string, key: string) {
    const states = importProvenance.value?.states
    if (!states?.[group]?.[key]) return
    delete states[group][key]
    if (Object.keys(states[group]).length === 0) delete states[group]
    persistImport()
  }

  /** Tokens still asking for a look: inferred (Verify) plus defaulted (Review). */
  const pendingReview = computed(() => {
    let inferred = 0
    let defaulted = 0
    for (const tokens of Object.values(importProvenance.value?.states ?? {})) {
      for (const state of Object.values(tokens)) {
        if (state === 'inferred') inferred++
        else if (state === 'defaulted') defaulted++
      }
    }
    return { inferred, defaulted, total: inferred + defaulted }
  })

  function persistImport() {
    const key = wsImportKey(activeWorkspaceId.value)
    if (importProvenance.value) localStorage.setItem(key, JSON.stringify(importProvenance.value))
    else localStorage.removeItem(key)
    // Reassign so computed consumers see the mutation.
    importProvenance.value = importProvenance.value ? { ...importProvenance.value } : null
  }

  /**
   * Replace the active workspace with a scanned schema and its provenance.
   *
   * This is the end of the import flow, and it never partially applies: the
   * extractor always returns a complete schema, so there is no state where the
   * workspace is left half-populated waiting for the user to fix something.
   */
  function applyImport(imported: DesignSystemSchema, provenance: ImportProvenance) {
    logAction('applyImport', [provenance.repoFullName, provenance.branch])
    // A JSON round-trip, not structuredClone: callers reasonably hand us values
    // read out of a ref, and structuredClone throws DataCloneError on a Vue
    // reactive proxy. Both shapes are plain JSON by contract.
    schema.value = JSON.parse(JSON.stringify(imported)) as DesignSystemSchema
    importProvenance.value = JSON.parse(JSON.stringify(provenance)) as ImportProvenance
    persistImport()
    selectedComponent.value = null
    resetHistory()
  }

  /**
   * Fold tokens read out of a Figma file into this workspace.
   *
   * Unlike a repository import this never replaces the workspace: a Figma file
   * carries colors, type, effects and — on Pro — variables, but nothing about
   * components, blueprints or prose. Merging is the honest operation, and
   * `replace` still only swaps the groups the file actually populated.
   *
   * It is one undo step, so a designer who dislikes what a file did can take it
   * straight back.
   */
  function applyFigmaImport(imported: FigmaImport, mode: FigmaMergeMode) {
    // Counts, never values: token values can carry a client's unreleased brand.
    logAction('applyFigmaImport', [mode, imported.counts.tokens])
    schema.value = foldFigmaImport(schema.value, imported, mode)
    snapshot()
  }

  /** Forget an import's provenance, keeping the schema it produced. */
  function dismissImport() {
    importProvenance.value = null
    persistImport()
  }

  // ── Persistence (per active workspace) ──
  watchEffect(() => {
    localStorage.setItem(wsSchemaKey(activeWorkspaceId.value), JSON.stringify(schema.value))
  })
  watch(workspaces, (list) => localStorage.setItem(WS_LIST_KEY, JSON.stringify(list)), { deep: true })
  watch(activeWorkspaceId, (id) => localStorage.setItem(WS_ACTIVE_KEY, id))

  function resetHistory() {
    historyStack.value = [JSON.stringify(schema.value)]
    historyIndex.value = 0
  }

  // ── Workspace actions ──
  const activeWorkspaceName = computed(
    () => workspaces.value.find((w) => w.id === activeWorkspaceId.value)?.name ?? '',
  )

  function persistActive() {
    localStorage.setItem(wsSchemaKey(activeWorkspaceId.value), JSON.stringify(schema.value))
  }

  function switchWorkspace(id: string) {
    if (id === activeWorkspaceId.value || !workspaces.value.some((w) => w.id === id)) return
    logAction('switchWorkspace', [id])
    persistActive() // flush current edits before loading another
    activeWorkspaceId.value = id
    schema.value = loadSchemaFor(id)
    importProvenance.value = readJson<ImportProvenance>(wsImportKey(id))
    selectedComponent.value = null
    resetHistory()
  }

  /** Ensure a name is unique among workspaces; on collision append " 2", " 3"… */
  function uniqueName(base: string, excludeId?: string): string {
    const taken = new Set(workspaces.value.filter((w) => w.id !== excludeId).map((w) => w.name))
    if (!taken.has(base)) return base
    let i = 2
    while (taken.has(`${base} ${i}`)) i++
    return `${base} ${i}`
  }

  function createWorkspace(name?: string): string {
    const id = newId()
    workspaces.value = [...workspaces.value, { id, name: uniqueName(name?.trim() || 'New workspace') }]
    localStorage.setItem(wsSchemaKey(id), JSON.stringify(defaultSchema))
    switchWorkspace(id)
    return id
  }

  /** Clone a workspace (its schema) into a new one and switch to it. */
  function duplicateWorkspace(id: string): string | undefined {
    const src = workspaces.value.find((w) => w.id === id)
    if (!src) return
    persistActive() // capture in-memory edits if duplicating the active one
    const copySchema = loadSchemaFor(id)
    const newWsId = newId()
    workspaces.value = [...workspaces.value, { id: newWsId, name: uniqueName(`${src.name} copy`) }]
    localStorage.setItem(wsSchemaKey(newWsId), JSON.stringify(copySchema))
    switchWorkspace(newWsId)
    return newWsId
  }

  function renameWorkspace(id: string, name: string) {
    const n = name.trim()
    if (!n) return
    const unique = uniqueName(n, id)
    workspaces.value = workspaces.value.map((w) => (w.id === id ? { ...w, name: unique } : w))
  }

  function deleteWorkspace(id: string) {
    localStorage.removeItem(wsSchemaKey(id))
    localStorage.removeItem(wsImportKey(id))
    const remaining = workspaces.value.filter((w) => w.id !== id)
    if (remaining.length === 0) {
      // Never leave zero workspaces — recreate a fresh default.
      const nid = newId()
      workspaces.value = [{ id: nid, name: 'My workspace' }]
      localStorage.setItem(wsSchemaKey(nid), JSON.stringify(defaultSchema))
      activeWorkspaceId.value = nid
      schema.value = structuredClone(defaultSchema)
      importProvenance.value = null
      selectedComponent.value = null
      resetHistory()
      return
    }
    workspaces.value = remaining
    if (activeWorkspaceId.value === id) {
      activeWorkspaceId.value = remaining[0].id
      schema.value = loadSchemaFor(remaining[0].id)
      importProvenance.value = readJson<ImportProvenance>(wsImportKey(remaining[0].id))
      selectedComponent.value = null
      resetHistory()
    }
  }

  /** Reset the active workspace to all default values. */
  function resetWorkspace() {
    logAction('resetWorkspace', [])
    schema.value = structuredClone(defaultSchema)
    importProvenance.value = null
    persistImport()
    selectedComponent.value = null
    resetHistory()
  }

  // ── Actions ──
  // Every write clears the edited token's import flag: a human has now seen the
  // value, which is precisely what Verify/Review were asking for.
  function updateToken(group: keyof DesignSystemSchema, key: string, value: unknown) {
    logAction('updateToken', [group, key])
    const target = schema.value[group]
    if (target !== null && typeof target === 'object' && !Array.isArray(target)) {
      ;(target as Record<string, unknown>)[key] = value
      clearTokenState(String(group), key)
      snapshot()
    }
  }

  function addToken(group: keyof DesignSystemSchema, key: string, value: unknown) {
    logAction('addToken', [group, key])
    const target = schema.value[group]
    if (target !== null && typeof target === 'object' && !Array.isArray(target)) {
      ;(target as Record<string, unknown>)[key] = value
      snapshot()
    }
  }

  function removeToken(group: keyof DesignSystemSchema, key: string) {
    logAction('removeToken', [group, key])
    const target = schema.value[group]
    if (target !== null && typeof target === 'object' && !Array.isArray(target)) {
      delete (target as Record<string, unknown>)[key]
      clearTokenState(String(group), key)
      snapshot()
    }
  }

  // ── Generic nested-path mutations (editors emit a path + value) ──
  type PathKey = string | number

  function resolveParent(path: PathKey[], create = false): Record<PathKey, unknown> | null {
    let node: unknown = schema.value
    for (let i = 0; i < path.length - 1; i++) {
      if (node === null || typeof node !== 'object') return null
      const obj = node as Record<PathKey, unknown>
      if (create && (obj[path[i]] === undefined || obj[path[i]] === null)) obj[path[i]] = {}
      node = obj[path[i]]
    }
    return node !== null && typeof node === 'object' ? (node as Record<PathKey, unknown>) : null
  }

  /**
   * Set a value at a nested path, creating intermediate objects as needed.
   * e.g. setPath(['componentBlueprints', 'Button', 'responsive', 'md', 'tokens', 'paddingX'], '{spacing.lg}').
   */
  function setPath(path: PathKey[], value: unknown) {
    if (path.length === 0) return
    logAction('setPath', [path.join('.')])
    const parent = resolveParent(path, true)
    if (!parent) return
    parent[path[path.length - 1]] = value
    const target = groupAndKeyFor(path)
    if (target) clearTokenState(target.group, target.key)
    snapshot()
  }

  /** Remove the key at a nested path. */
  function removePath(path: PathKey[]) {
    if (path.length === 0) return
    logAction('removePath', [path.join('.')])
    const parent = resolveParent(path)
    if (!parent) return
    delete parent[path[path.length - 1]]
    const target = groupAndKeyFor(path)
    if (target) clearTokenState(target.group, target.key)
    snapshot()
  }

  function updateMeta(updates: Partial<Pick<DesignSystemSchema, 'name' | 'description'>>) {
    logAction('updateMeta', [Object.keys(updates)])
    Object.assign(schema.value, updates)
    snapshot()
  }

  /**
   * Write the bento layout into `schema.presentation`. That whole layer is
   * remote-wins on sync (§20) — it is a designer's concern, unlike
   * `schema.export`, which the developer owns — and it is optional locally, so
   * the first write has to establish the layer rather than assume it.
   */
  function updateBentoLayout(layout: BentoLayoutConfig) {
    logAction('updateBentoLayout', [layout.cells.length, layout.gridColumns, layout.theme])
    schema.value.presentation = {
      ogImageStrategy: 'client-canvas',
      ...schema.value.presentation,
      bentoLayout: layout,
    }
    snapshot()
  }

  /**
   * Patch the proposal branding and embed options — the rest of the
   * presentation layer. Same remote-wins layer as the bento layout, same
   * establish-on-first-write rule.
   */
  function updatePresentation(patch: Partial<WebPresentationConfig>) {
    logAction('updatePresentation', [Object.keys(patch)])
    const current = schema.value.presentation ?? { ogImageStrategy: 'client-canvas' as const }
    schema.value.presentation = { ...current, ...patch }
    snapshot()
  }

  function updateFrameworks(frameworks: Framework[]) {
    logAction('updateFrameworks', [frameworks])
    schema.value.export.frameworks = frameworks
    snapshot()
  }

  function loadPreset(preset: DesignSystemSchema) {
    logAction('loadPreset', [preset.name])
    // A JSON round-trip rather than structuredClone, for the same reason
    // applyImport does it: callers hand us values read out of a ref, and
    // structuredClone throws DataCloneError on a Vue reactive proxy.
    schema.value = JSON.parse(JSON.stringify(preset)) as DesignSystemSchema
    historyStack.value = [JSON.stringify(schema.value)]
    historyIndex.value = 0
  }

  function importFromJson(raw: string) {
    logAction('importFromJson', [])
    const parsed = JSON.parse(raw) as DesignSystemSchema
    schema.value = parsed
    snapshot()
  }

  function reset() {
    resetWorkspace()
  }

  return {
    schema,
    workspaces,
    activeWorkspaceId,
    activeWorkspaceName,
    switchWorkspace,
    createWorkspace,
    duplicateWorkspace,
    renameWorkspace,
    deleteWorkspace,
    resetWorkspace,
    importProvenance,
    pendingReview,
    tokenStateFor,
    clearTokenState,
    applyImport,
    applyFigmaImport,
    dismissImport,
    activeEditorTab,
    selectedComponent,
    selectComponent,
    activePreviewFile,
    activeViewport,
    viewportWidth,
    setViewport,
    previewDark,
    togglePreviewDark,
    actionTrace,
    canUndo,
    canRedo,
    designMd,
    skillMd,
    outputFiles,
    updateToken,
    addToken,
    removeToken,
    setPath,
    removePath,
    beginBatch,
    endBatch,
    updateMeta,
    updateBentoLayout,
    updatePresentation,
    updateFrameworks,
    loadPreset,
    importFromJson,
    reset,
    undo,
    redo,
  }
})

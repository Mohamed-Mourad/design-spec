import { ref, computed, watchEffect } from 'vue'
import { defineStore } from 'pinia'
import { compileDesignMd, compileSkillMd, compileAll } from '@design-spec/compiler'
import type { DesignSystemSchema } from '@/types/schema'
import type { FileOutput, Framework } from '@/types/compiler'
import { defaultSchema } from '@/defaults/schema'

const STORAGE_KEY = 'dsa-schema-v1'
const HISTORY_LIMIT = 50
const TRACE_LIMIT = 100

export interface ActionEntry {
  ts: number
  action: string
  args: unknown[]
}

function loadFromStorage(): DesignSystemSchema {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as DesignSystemSchema
  } catch {
    // ignore corrupt storage
  }
  return structuredClone(defaultSchema)
}

export const useDesignSystemStore = defineStore('designSystem', () => {
  // ── Core state ──
  const schema = ref<DesignSystemSchema>(loadFromStorage())
  const activeEditorTab = ref<string>('colors')
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

  function snapshot() {
    const snap = JSON.stringify(schema.value)
    historyStack.value = historyStack.value.slice(0, historyIndex.value + 1)
    historyStack.value.push(snap)
    if (historyStack.value.length > HISTORY_LIMIT) {
      historyStack.value.shift()
    } else {
      historyIndex.value++
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

  // ── Persistence ──
  watchEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schema.value))
  })

  // ── Actions ──
  function updateToken(group: keyof DesignSystemSchema, key: string, value: unknown) {
    logAction('updateToken', [group, key])
    const target = schema.value[group]
    if (target !== null && typeof target === 'object' && !Array.isArray(target)) {
      ;(target as Record<string, unknown>)[key] = value
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
    snapshot()
  }

  /** Remove the key at a nested path. */
  function removePath(path: PathKey[]) {
    if (path.length === 0) return
    logAction('removePath', [path.join('.')])
    const parent = resolveParent(path)
    if (!parent) return
    delete parent[path[path.length - 1]]
    snapshot()
  }

  function updateMeta(updates: Partial<Pick<DesignSystemSchema, 'name' | 'description'>>) {
    logAction('updateMeta', [Object.keys(updates)])
    Object.assign(schema.value, updates)
    snapshot()
  }

  function updateFrameworks(frameworks: Framework[]) {
    logAction('updateFrameworks', [frameworks])
    schema.value.export.frameworks = frameworks
  }

  function loadPreset(preset: DesignSystemSchema) {
    logAction('loadPreset', [preset.name])
    schema.value = structuredClone(preset)
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
    logAction('reset', [])
    loadPreset(defaultSchema)
  }

  return {
    schema,
    activeEditorTab,
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
    updateMeta,
    updateFrameworks,
    loadPreset,
    importFromJson,
    reset,
    undo,
    redo,
  }
})

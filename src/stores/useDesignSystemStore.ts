import { ref, computed, watchEffect } from 'vue'
import { defineStore } from 'pinia'
import type { DesignSystemSchema } from '@/types/schema'
import type { FileOutput, Framework } from '@/types/compiler'
import { defaultSchema } from '@/defaults/schema'

const STORAGE_KEY = 'dsa-schema-v1'
const HISTORY_LIMIT = 50

function loadFromStorage(): DesignSystemSchema {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as DesignSystemSchema
  } catch {
    // ignore
  }
  return structuredClone(defaultSchema)
}

export const useDesignSystemStore = defineStore('designSystem', () => {
  // ── Core state ──
  const schema = ref<DesignSystemSchema>(loadFromStorage())
  const activeEditorTab = ref<string>('colors')
  const activePreviewFile = ref<string>('DESIGN.md')
  // Viewport for responsive preview + blueprint editor — kept in sync
  const activeViewport = ref<'mobile' | 'tablet' | 'desktop' | 'fit'>('desktop')

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
    historyIndex.value--
    schema.value = JSON.parse(historyStack.value[historyIndex.value]) as DesignSystemSchema
  }

  function redo() {
    if (!canRedo.value) return
    historyIndex.value++
    schema.value = JSON.parse(historyStack.value[historyIndex.value]) as DesignSystemSchema
  }

  // ── Compiled outputs (stubs — compilers implemented in later phases) ──
  const designMd = computed<string>(() => {
    // Phase 1: real DESIGN.md compiler
    return `<!-- DESIGN.md for ${schema.value.name} — compiler coming in Phase 1 -->`
  })

  const skillMd = computed<string>(() => {
    // Phase 3: real SKILL.md compiler
    return `<!-- SKILL.md for ${schema.value.name} — compiler coming in Phase 3 -->`
  })

  const outputFiles = computed<FileOutput[]>(() => [
    { filename: 'DESIGN.md', content: designMd.value, language: 'markdown' },
    { filename: 'SKILL.md', content: skillMd.value, language: 'markdown' },
  ])

  // ── Persistence ──
  watchEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schema.value))
  })

  // ── Actions ──
  function updateToken(group: keyof DesignSystemSchema, key: string, value: unknown) {
    const target = schema.value[group]
    if (target !== null && typeof target === 'object' && !Array.isArray(target)) {
      ;(target as Record<string, unknown>)[key] = value
      snapshot()
    }
  }

  function addToken(group: keyof DesignSystemSchema, key: string, value: unknown) {
    const target = schema.value[group]
    if (target !== null && typeof target === 'object' && !Array.isArray(target)) {
      ;(target as Record<string, unknown>)[key] = value
      snapshot()
    }
  }

  function removeToken(group: keyof DesignSystemSchema, key: string) {
    const target = schema.value[group]
    if (target !== null && typeof target === 'object' && !Array.isArray(target)) {
      delete (target as Record<string, unknown>)[key]
      snapshot()
    }
  }

  function updateMeta(updates: Partial<Pick<DesignSystemSchema, 'name' | 'description'>>) {
    Object.assign(schema.value, updates)
    snapshot()
  }

  function updateFrameworks(frameworks: Framework[]) {
    schema.value.export.frameworks = frameworks
  }

  function loadPreset(preset: DesignSystemSchema) {
    schema.value = structuredClone(preset)
    historyStack.value = [JSON.stringify(schema.value)]
    historyIndex.value = 0
  }

  function importFromJson(raw: string) {
    const parsed = JSON.parse(raw) as DesignSystemSchema
    schema.value = parsed
    snapshot()
  }

  function reset() {
    loadPreset(defaultSchema)
  }

  return {
    // state
    schema,
    activeEditorTab,
    activePreviewFile,
    activeViewport,
    canUndo,
    canRedo,
    // compiled
    designMd,
    skillMd,
    outputFiles,
    // actions
    updateToken,
    addToken,
    removeToken,
    updateMeta,
    updateFrameworks,
    loadPreset,
    importFromJson,
    reset,
    undo,
    redo,
  }
})

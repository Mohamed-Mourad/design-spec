import { describe, it, expect } from 'vitest'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import { defaultSchema } from '@/defaults/schema'

describe('useDesignSystemStore — compiler wiring', () => {
  it('emits real DESIGN.md/SKILL.md, not placeholders', () => {
    const store = useDesignSystemStore()
    expect(store.designMd).toContain(store.schema.name)
    expect(store.skillMd).toContain('Design System Skill')
    expect(store.skillMd).not.toContain('compiler coming')
  })

  it('recompiles the output set when frameworks change', () => {
    const store = useDesignSystemStore()
    store.updateFrameworks(['react-tailwind'])
    expect(store.outputFiles.some((f) => f.filename === 'tailwind.config.js')).toBe(true)
    store.updateFrameworks(['vue-css'])
    expect(store.outputFiles.some((f) => f.filename === 'tailwind.config.js')).toBe(false)
    expect(store.outputFiles.some((f) => f.filename === 'tokens.css')).toBe(true)
  })

  it('setPath creates intermediate objects for a responsive override', () => {
    const store = useDesignSystemStore()
    store.setPath(['componentBlueprints', 'Button', 'responsive', 'md', 'tokens', 'paddingX'], '{spacing.lg}')
    expect(store.schema.componentBlueprints.Button.responsive?.md.tokens?.paddingX).toBe('{spacing.lg}')
  })

  it('acceptance: a Button tablet override surfaces in SKILL.md', () => {
    const store = useDesignSystemStore()
    store.setPath(['componentBlueprints', 'Button', 'responsive', 'md', 'tokens', 'paddingX'], '{spacing.lg}')
    expect(store.skillMd).toContain('Responsive (mobile-first')
    expect(store.skillMd).toContain('(md)')
    expect(store.skillMd).toContain('{spacing.lg}')
  })

  it('fills new default components into an older stored schema, keeping edits', () => {
    // Simulate a schema saved before Sidebar existed, with a customized color.
    const stored = structuredClone(defaultSchema) as unknown as {
      colors: Record<string, string>
      componentBlueprints: Record<string, unknown>
    }
    stored.colors.primary = '#abcdef'
    delete stored.componentBlueprints.Sidebar
    localStorage.setItem('dsa-schema-v1', JSON.stringify(stored))

    const store = useDesignSystemStore()
    expect(store.schema.componentBlueprints.Sidebar).toBeTruthy() // filled from defaults
    expect(store.schema.colors.primary).toBe('#abcdef') // user edit preserved
  })

  it('deep-fills new default tokens inside an existing blueprint variant', () => {
    // Older saved Alert: an info variant with only a border, customized.
    const stored = structuredClone(defaultSchema) as unknown as {
      componentBlueprints: { Alert: { tokens: Record<string, Record<string, string>> } }
    }
    stored.componentBlueprints.Alert.tokens.info = { borderColor: '#0000ff' }
    localStorage.setItem('dsa-schema-v1', JSON.stringify(stored))

    const store = useDesignSystemStore()
    const info = store.schema.componentBlueprints.Alert.tokens.info
    expect(info.borderColor).toBe('#0000ff') // user value kept
    expect(info.backgroundColor).toBe('{colors.status-info-surface}') // new default filled in
  })

  it('starts with a single workspace', () => {
    const store = useDesignSystemStore()
    expect(store.workspaces.length).toBe(1)
    expect(store.activeWorkspaceId).toBeTruthy()
  })

  it('keeps each workspace schema isolated across create + switch', () => {
    const store = useDesignSystemStore()
    const first = store.activeWorkspaceId
    store.setPath(['colors', 'primary'], '#111111')

    const second = store.createWorkspace('Second') // switches; fresh defaults
    expect(store.activeWorkspaceId).toBe(second)
    expect(store.schema.colors.primary).not.toBe('#111111')
    store.setPath(['colors', 'primary'], '#222222')

    store.switchWorkspace(first)
    expect(store.schema.colors.primary).toBe('#111111') // isolated per workspace
    store.switchWorkspace(second)
    expect(store.schema.colors.primary).toBe('#222222')
  })

  it('duplicates a workspace with its schema and a unique name', () => {
    const store = useDesignSystemStore()
    store.renameWorkspace(store.activeWorkspaceId, 'Brand')
    store.setPath(['colors', 'primary'], '#abcdef')

    const dupId = store.duplicateWorkspace(store.activeWorkspaceId)!
    expect(store.activeWorkspaceId).toBe(dupId)
    expect(store.workspaces.find((w) => w.id === dupId)?.name).toBe('Brand copy')
    expect(store.schema.colors.primary).toBe('#abcdef') // schema cloned
  })

  it('disambiguates duplicate names with a counter', () => {
    const store = useDesignSystemStore()
    store.renameWorkspace(store.activeWorkspaceId, 'Theme')
    const a = store.createWorkspace('Theme')
    const b = store.createWorkspace('Theme')
    const names = store.workspaces.map((w) => w.name)
    expect(names).toContain('Theme')
    expect(store.workspaces.find((w) => w.id === a)?.name).toBe('Theme 2')
    expect(store.workspaces.find((w) => w.id === b)?.name).toBe('Theme 3')
  })

  it('renames and deletes workspaces', () => {
    const store = useDesignSystemStore()
    const id = store.createWorkspace('Temp')
    store.renameWorkspace(id, 'Renamed')
    expect(store.workspaces.find((w) => w.id === id)?.name).toBe('Renamed')
    store.deleteWorkspace(id)
    expect(store.workspaces.some((w) => w.id === id)).toBe(false)
  })

  it('deleting the last workspace recreates a fresh one', () => {
    const store = useDesignSystemStore()
    store.deleteWorkspace(store.workspaces[0].id)
    expect(store.workspaces.length).toBe(1)
    expect(store.schema.colors.primary).toBe(defaultSchema.colors.primary)
  })

  it('resetWorkspace restores all defaults', () => {
    const store = useDesignSystemStore()
    store.setPath(['colors', 'primary'], '#abcabc')
    store.resetWorkspace()
    expect(store.schema.colors.primary).toBe(defaultSchema.colors.primary)
  })

  it('batches mutations into a single undo step', () => {
    const store = useDesignSystemStore()
    const before = store.schema.colors.primary
    store.beginBatch()
    store.setPath(['colors', 'primary'], '#111111')
    store.setPath(['colors', 'primary'], '#222222')
    store.setPath(['colors', 'primary'], '#333333')
    store.endBatch()
    expect(store.schema.colors.primary).toBe('#333333')
    store.undo()
    expect(store.schema.colors.primary).toBe(before) // one undo reverts the whole session
  })

  it('an empty batch adds no undo step', () => {
    const store = useDesignSystemStore()
    store.setPath(['colors', 'primary'], '#abcabc')
    store.beginBatch()
    store.endBatch() // no changes
    store.undo()
    expect(store.schema.colors.primary).not.toBe('#abcabc') // undo reverts the real edit, not a no-op
  })

  it('undo restores the pre-edit schema', () => {
    const store = useDesignSystemStore()
    store.setPath(['colors', 'primary'], '#123456')
    expect(store.schema.colors.primary).toBe('#123456')
    store.undo()
    expect(store.schema.colors.primary).not.toBe('#123456')
  })
})

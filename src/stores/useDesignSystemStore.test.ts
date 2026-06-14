import { describe, it, expect } from 'vitest'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'

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

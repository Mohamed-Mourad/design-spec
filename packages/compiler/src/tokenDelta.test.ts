import { describe, expect, it } from 'vitest'
import { defaultSchema } from './defaultSchema.js'
import {
  changesByGroup,
  diffTokens,
  isEmptyDelta,
  tokenGroupOf,
  TOKEN_GROUPS,
} from './tokenDelta.js'
import type { DesignSystemSchema } from './types/schema.js'

function clone(): DesignSystemSchema {
  return JSON.parse(JSON.stringify(defaultSchema)) as DesignSystemSchema
}

describe('diffTokens', () => {
  it('reports nothing when the two schemas are token-for-token identical', () => {
    expect(isEmptyDelta(diffTokens(clone(), clone()))).toBe(true)
  })

  it('reports an updated token with both sides', () => {
    const next = clone()
    next.colors.primary = '#FF0000'
    expect(diffTokens(clone(), next).changes).toEqual([
      { path: 'colors.primary', old: '#2563EB', new: '#FF0000' },
    ])
  })

  it('omits the old side of an added token and the new side of a removed one', () => {
    const next = clone()
    next.colors.accent = '#00FF00'
    delete next.colors.success
    const delta = diffTokens(clone(), next)
    expect(delta.changes).toEqual([
      { path: 'colors.accent', new: '#00FF00' },
      { path: 'colors.success', old: '#16A34A' },
    ])
  })

  it('ignores metadata, prose and config — a renamed system is not a design change', () => {
    const next = clone()
    next.name = 'Something Else'
    next.description = 'rewritten'
    next.prose.overview = 'new prose'
    next.export.cssVariablePrefix = 'ds'
    next.overview.moodKeywords = ['loud']
    expect(diffTokens(clone(), next).changes).toEqual([])
  })

  it('walks nested groups down to their leaves', () => {
    const next = clone()
    next.borders.width.thin = '2px'
    next.darkMode.colors.primary = '#111111'
    const delta = diffTokens(clone(), next)
    expect(delta.changes.map((c) => c.path)).toEqual([
      'borders.width.thin',
      'darkMode.colors.primary',
    ])
  })

  it('indexes array leaves so a multi-layer shadow diffs layer by layer', () => {
    const previous = clone()
    previous.shadows.md = { value: ['0 1px 2px #000', '0 2px 4px #111'] }
    const next = clone()
    next.shadows.md = { value: ['0 1px 2px #000', '0 8px 16px #222'] }
    expect(diffTokens(previous, next).changes).toEqual([
      { path: 'shadows.md.value[1]', old: '0 2px 4px #111', new: '0 8px 16px #222' },
    ])
  })

  it('reads a re-nested value as a removal plus an addition, not an object diff', () => {
    const previous = clone()
    const next = clone()
    ;(next.shadows as Record<string, unknown>).sm = { value: { base: '0 1px 2px #000' } }
    const delta = diffTokens(previous, next)
    expect(delta.changes).toEqual([
      { path: 'shadows.sm.value', old: '0 1px 2px 0 rgba(15, 23, 42, 0.05)' },
      { path: 'shadows.sm.value.base', new: '0 1px 2px #000' },
    ])
  })

  it('orders changes by schema group, then by path inside a group', () => {
    const next = clone()
    next.darkMode.colors.primary = '#000000'
    next.spacing.md = '20px'
    next.colors.secondary = '#000000'
    next.colors.border = '#000000'
    const delta = diffTokens(clone(), next)
    expect(delta.changes.map((c) => c.path)).toEqual([
      'colors.border',
      'colors.secondary',
      'spacing.md',
      'darkMode.colors.primary',
    ])
    expect(delta.groups).toEqual(['colors', 'spacing', 'darkMode'])
  })

  it('is deterministic — the same pair of schemas always yields the same delta', () => {
    const next = clone()
    next.colors.primary = '#FF0000'
    next.rounded.sm = '6px'
    expect(JSON.stringify(diffTokens(clone(), next))).toBe(JSON.stringify(diffTokens(clone(), next)))
  })

  it('diffs a schema that predates a token group without a migration', () => {
    const previous = clone() as unknown as Record<string, unknown>
    delete previous.opacity
    const next = clone()
    expect(diffTokens(previous, next).groups).toEqual(['opacity'])
  })

  it('survives a non-object on either side', () => {
    expect(diffTokens(null, undefined).changes).toEqual([])
    expect(diffTokens('nonsense', clone()).groups.length).toBeGreaterThan(0)
  })

  it('renders numeric and boolean leaves as literals', () => {
    const next = clone()
    next.opacity.disabled = 0.5
    next.transitions.reducedMotion = !defaultSchema.transitions.reducedMotion
    const paths = Object.fromEntries(diffTokens(clone(), next).changes.map((c) => [c.path, c.new]))
    expect(paths['opacity.disabled']).toBe('0.5')
    expect(paths['transitions.reducedMotion']).toBe(String(!defaultSchema.transitions.reducedMotion))
  })
})

describe('tokenGroupOf', () => {
  it('reads the group off a flattened path', () => {
    expect(tokenGroupOf('darkMode.colors.primary')).toBe('darkMode')
    expect(tokenGroupOf('colors')).toBe('colors')
  })
})

describe('changesByGroup', () => {
  it('buckets changes in schema order', () => {
    const next = clone()
    next.spacing.md = '20px'
    next.colors.primary = '#000000'
    expect(changesByGroup(diffTokens(clone(), next))).toEqual([
      { group: 'colors', changes: [{ path: 'colors.primary', old: '#2563EB', new: '#000000' }] },
      { group: 'spacing', changes: [{ path: 'spacing.md', old: '16px', new: '20px' }] },
    ])
  })
})

describe('TOKEN_GROUPS', () => {
  it('names only groups the default schema actually has', () => {
    for (const group of TOKEN_GROUPS) {
      expect(defaultSchema).toHaveProperty(group)
    }
  })
})

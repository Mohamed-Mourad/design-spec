// mcp.test.ts — the semantic firewall: each resolver returns ONLY its slice and
// leaks nothing about other components or unrelated token groups.

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { defaultSchema } from './defaultSchema.js'
import { get_component_tokens, get_layout_system, get_semantic_colors } from './mcp/route.js'

const schema = defaultSchema
const componentNames = Object.keys(schema.componentBlueprints)

describe('get_component_tokens — slice isolation', () => {
  it('returns the requested component and never names another', () => {
    fc.assert(
      fc.property(fc.constantFrom(...componentNames), (name) => {
        const slice = get_component_tokens(schema, name)!
        expect(slice.component).toBe(name)
        const json = JSON.stringify(slice)
        for (const other of componentNames) {
          if (other !== name) expect(json).not.toContain(`"${other}"`)
        }
      }),
    )
  })

  it('resolves token refs to concrete values (no {ref} leaks through)', () => {
    const slice = get_component_tokens(schema, 'Button')!
    expect(slice.tokens.base.backgroundColor).toBe('#2563EB')
    expect(JSON.stringify(slice)).not.toMatch(/"\{[^}]+\}"/)
  })

  it('returns null for an unknown component', () => {
    expect(get_component_tokens(schema, 'Nope')).toBeNull()
  })
})

describe('get_layout_system — slice isolation', () => {
  it('exposes grid/spacing/breakpoints and no component or color palette', () => {
    const layout = get_layout_system(schema)
    const json = JSON.stringify(layout)
    expect(layout.grid.columns).toBe(12)
    for (const name of componentNames) expect(json).not.toContain(`"${name}"`)
    // no raw color hex bleeds into the layout slice
    expect(json).not.toMatch(/#[0-9a-fA-F]{6}/)
  })
})

describe('get_semantic_colors — role-only slice', () => {
  it('returns semantic roles and drops numeric scale steps', () => {
    const scaled = {
      ...schema,
      colors: { ...schema.colors, 'primary-60': '#3B6EF5', 'primary-70': '#1D4ED8' },
    }
    const roles = get_semantic_colors(scaled)
    expect(roles.primary).toBe('#2563EB')
    expect(roles['primary-60']).toBeUndefined()
    expect(roles['primary-70']).toBeUndefined()
  })
})

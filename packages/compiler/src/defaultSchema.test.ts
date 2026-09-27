// defaultSchema.test.ts — the one product default. Every surface (web
// workspace, `design-spec init`, Git Import, goldens) starts here, so its
// shape and self-consistency are pinned.

import { describe, it, expect } from 'vitest'
import { defaultSchema } from './defaultSchema.js'
import { tier1Blueprints } from './blueprints/tier1.js'
import { tier2Blueprints } from './blueprints/tier2.js'
import { getPath, refPath } from './tokenResolver.js'

const TIER1 = ['Button', 'Input', 'Card', 'Badge', 'Alert', 'Checkbox', 'Tooltip', 'Dropdown', 'Radio']
const TIER2 = ['Navbar', 'Sidebar', 'Tabs', 'Breadcrumbs', 'Pagination', 'Accordion', 'Progress', 'EmptyState', 'ErrorState', 'Table', 'Drawer']

/** Every `{group.token}` ref under `v` that does not resolve in the default itself. */
function danglingRefs(v: unknown, at: string, out: string[] = []): string[] {
  if (v && typeof v === 'object') {
    for (const [k, c] of Object.entries(v)) danglingRefs(c, `${at}.${k}`, out)
    return out
  }
  const path = refPath(v)
  if (path !== null && getPath(defaultSchema, path) === undefined) out.push(`${at} → {${path}}`)
  return out
}

describe('defaultSchema', () => {
  it('loads Tier 1 then Tier 2 — twenty blueprints, one Navbar and one Sidebar', () => {
    const keys = Object.keys(defaultSchema.componentBlueprints)
    expect(keys).toEqual([...TIER1, ...TIER2])
    expect(Object.keys(tier1Blueprints)).toEqual(TIER1)
    expect(defaultSchema.componentBlueprints.Button).toBe(tier1Blueprints.Button)
    expect(defaultSchema.componentBlueprints.Navbar).toBe(tier2Blueprints.Navbar)
    for (const [key, bp] of Object.entries(defaultSchema.componentBlueprints)) expect(bp.name).toBe(key)
  })

  it('every token ref in every blueprint resolves against the default itself', () => {
    const dangling: string[] = []
    for (const bp of Object.values(defaultSchema.componentBlueprints)) {
      danglingRefs(bp.tokens, `${bp.name}.tokens`, dangling)
      danglingRefs(bp.responsive ?? {}, `${bp.name}.responsive`, dangling)
    }
    expect(dangling).toEqual([])
  })

  it('every token ref outside the blueprints resolves too', () => {
    const { componentBlueprints: _bp, ...rest } = defaultSchema
    expect(danglingRefs(rest, 'defaultSchema')).toEqual([])
  })

  it('blueprint colors, spacing, radii, shadows and type are refs, never literals', () => {
    const tokenOnly = ['backgroundColor', 'textColor', 'borderColor', 'rounded', 'shadow', 'typography', 'padding', 'paddingX', 'paddingY', 'gap']
    const literals: string[] = []
    const walk = (v: unknown, at: string, key: string): void => {
      if (v && typeof v === 'object') {
        for (const [k, c] of Object.entries(v)) walk(c, `${at}.${k}`, k)
        return
      }
      if (tokenOnly.includes(key) && refPath(v) === null) literals.push(`${at} = ${String(v)}`)
    }
    for (const bp of Object.values(defaultSchema.componentBlueprints)) walk(bp.tokens, `${bp.name}.tokens`, '')
    expect(literals).toEqual([])
  })

  it('carries the product palette the blueprints reference', () => {
    expect(defaultSchema.colors.primary).toBe('#3B6EF5')
    for (const slot of ['surface-default', 'surface-border', 'on-surface', 'on-surface-muted', 'on-primary', 'status-error', 'status-success']) {
      expect(defaultSchema.colors[slot], slot).toBeDefined()
    }
  })

  it('ships dark mode on, overriding only colors the palette defines', () => {
    expect(defaultSchema.darkMode.enabled).toBe(true)
    const overrides = Object.keys(defaultSchema.darkMode.colors)
    expect(overrides).toHaveLength(14)
    for (const key of overrides) expect(defaultSchema.colors[key], key).toBeDefined()
  })

  it('declares a mobile-first layout where the Tier 2 inventory calls for one', () => {
    for (const n of ['Navbar', 'Sidebar', 'Tabs', 'Table', 'Drawer']) {
      expect(defaultSchema.componentBlueprints[n].responsive?.md?.layout, n).toBeTruthy()
    }
  })
})

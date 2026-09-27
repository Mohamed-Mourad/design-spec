import { describe, it, expect } from 'vitest'
import { getPath, refPath, tier2Blueprints } from '@design-spec/compiler'
import { defaultSchema } from '@/defaults/schema'

const TIER2 = ['Navbar', 'Sidebar', 'Tabs', 'Breadcrumbs', 'Pagination', 'Accordion', 'Progress', 'EmptyState', 'ErrorState', 'Table', 'Drawer']

describe('default blueprints', () => {
  it('loads Tier 1 then Tier 2, with one Navbar and one Sidebar', () => {
    const keys = Object.keys(defaultSchema.componentBlueprints)
    expect(keys.slice(0, 9)).toEqual(['Button', 'Input', 'Card', 'Badge', 'Alert', 'Checkbox', 'Tooltip', 'Dropdown', 'Radio'])
    expect(keys.slice(9)).toEqual(TIER2)
    expect(defaultSchema.componentBlueprints.Navbar).toBe(tier2Blueprints.Navbar)
  })

  it('every Tier 2 token ref resolves against the web default palette', () => {
    const dangling: string[] = []
    const walk = (v: unknown, at: string): void => {
      if (v && typeof v === 'object') {
        for (const [k, c] of Object.entries(v)) walk(c, `${at}.${k}`)
        return
      }
      const path = refPath(v)
      if (path !== null && getPath(defaultSchema, path) === undefined) dangling.push(`${at} → {${path}}`)
    }
    for (const bp of Object.values(tier2Blueprints)) {
      walk(bp.tokens, `${bp.name}.tokens`)
      walk(bp.responsive ?? {}, `${bp.name}.responsive`)
    }
    expect(dangling).toEqual([])
  })

  it('every Tier 2 blueprint declares a mobile-first layout where the inventory calls for one', () => {
    for (const n of ['Navbar', 'Sidebar', 'Tabs', 'Table', 'Drawer']) {
      expect(defaultSchema.componentBlueprints[n].responsive?.md?.layout, n).toBeTruthy()
    }
  })
})

// resolveResponsive.test.ts — cascade merge correctness, mobile-first ordering,
// and validation of invalid cascades. Property-based where it earns its keep.

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { defaultSchema } from './defaultSchema.js'
import {
  resolveResponsive,
  validateResponsiveCascade,
  mergeTokens,
  orderBreakpoints,
  type BreakpointLayer,
} from './resolveResponsive.js'
import { responsiveSchema, invalidResponsiveSchema } from './fixtures/responsive.fixture.js'

const schema = defaultSchema
const bpNames = Object.keys(schema.breakpoints)

describe('mergeTokens', () => {
  it('override wins; base keys survive; refs stay unresolved', () => {
    const merged = mergeTokens({ paddingX: '{spacing.md}', textColor: '{colors.primary}' }, { paddingX: '{spacing.lg}' })
    expect(merged).toEqual({ paddingX: '{spacing.lg}', textColor: '{colors.primary}' })
  })
  it('drops the responsive key', () => {
    expect(mergeTokens({ a: 1, responsive: {} }, undefined)).toEqual({ a: 1 })
  })
})

describe('orderBreakpoints — mobile-first', () => {
  it('sorts any subset ascending by min-width', () => {
    fc.assert(
      fc.property(fc.subarray(bpNames, { minLength: 1 }), (names) => {
        const responsive = Object.fromEntries(names.map((n) => [n, {} as BreakpointLayer]))
        const ordered = orderBreakpoints(schema, responsive)
        const widths = ordered.map((o) => parseFloat(o.minWidth ?? 'NaN'))
        for (let i = 1; i < widths.length; i++) expect(widths[i - 1]).toBeLessThanOrEqual(widths[i])
      }),
    )
  })
})

describe('resolveResponsive', () => {
  it('flattens base + overrides into resolved, mobile-first layers', () => {
    const bp = responsiveSchema.componentBlueprints.Button
    const resolved = resolveResponsive(schema, bp.tokens.base, bp.responsive as Record<string, BreakpointLayer>)
    expect(resolved.breakpoints.map((b) => b.name)).toEqual(['tablet', 'desktop'])
    // base padding is sm (8px); tablet overrides paddingX to lg (24px), keeps paddingY.
    expect(resolved.base.paddingX).toBe('16px')
    const tablet = resolved.breakpoints[0]
    expect(tablet.tokens.paddingX).toBe('24px') // {spacing.lg}
    expect(tablet.tokens.paddingY).toBe('8px') // inherited from base {spacing.sm}
    expect(tablet.layout).toBe('comfortable padding')
  })

  it('resolves every value (no {ref} survives)', () => {
    const bp = responsiveSchema.componentBlueprints.Button
    const resolved = resolveResponsive(schema, bp.tokens.base, bp.responsive as Record<string, BreakpointLayer>)
    expect(JSON.stringify(resolved)).not.toMatch(/"\{[^}]+\}"/)
  })
})

describe('validateResponsiveCascade', () => {
  it('returns no issues for a valid cascade', () => {
    const bp = responsiveSchema.componentBlueprints.Button
    expect(validateResponsiveCascade(schema, bp.tokens.base, bp.responsive as Record<string, BreakpointLayer>)).toEqual([])
  })

  it('flags an unknown breakpoint and a dangling ref', () => {
    const bp = invalidResponsiveSchema.componentBlueprints.Button
    const issues = validateResponsiveCascade(invalidResponsiveSchema, bp.tokens.base, bp.responsive as Record<string, BreakpointLayer>)
    expect(issues.some((i) => i.kind === 'unknown-breakpoint' && i.breakpoint === 'ultrawide')).toBe(true)
    expect(issues.some((i) => i.kind === 'unresolved-ref' && i.token === 'paddingX')).toBe(true)
  })

  it('any subset of real breakpoints with base refs validates clean', () => {
    fc.assert(
      fc.property(fc.subarray(bpNames), (names) => {
        const responsive = Object.fromEntries(
          names.map((n) => [n, { tokens: { paddingX: '{spacing.md}' } } as BreakpointLayer]),
        )
        expect(validateResponsiveCascade(schema, { textColor: '{colors.primary}' }, responsive)).toEqual([])
      }),
    )
  })
})

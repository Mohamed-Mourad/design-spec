// scaleMatch.test.ts — the dimensional half of the best-match engine.
//
// The snap tolerance is gap-relative (a fraction of the local step gap, capped),
// derived from the user's own scale. These pin: exact snaps, in-tolerance snaps,
// midpoint bypass (no equidistant branch needed), cross-scale ambiguity bypass,
// and the headline property — the same raw deviation snaps on a coarse grid but
// is rejected on a fine one.

import { describe, it, expect } from 'vitest'
import type { DesignSystemSchema } from './types/schema.js'
import { defaultSchema } from './defaultSchema.js'
import { nearestScaleToken, SCALE_GAP_FRACTION, SCALE_SNAP_CAP_PX } from './scaleMatch.js'

const schema = defaultSchema
// default spacing: base16 xs4 sm8 md16 lg24 xl40 2xl64 · rounded: none0 sm4 md8 lg12 full9999

/** A schema with custom spacing and no rounded slots (isolates the spacing scale). */
const withSpacing = (spacing: Record<string, string | number>): DesignSystemSchema => ({
  ...defaultSchema,
  spacing,
  rounded: {},
})

describe('nearestScaleToken — exact', () => {
  it('snaps an exact value (first in insertion order on a tie of equal values)', () => {
    expect(nearestScaleToken(schema, 16)).toBe('spacing.base') // base & md both 16 → base
    expect(nearestScaleToken(schema, 24)).toBe('spacing.lg')
    expect(nearestScaleToken(schema, 0)).toBe('rounded.none')
    expect(nearestScaleToken(schema, 12)).toBe('rounded.lg')
    expect(nearestScaleToken(schema, 9999)).toBe('rounded.full')
  })
})

describe('nearestScaleToken — gap-relative tolerance', () => {
  it('snaps within the derived radius (16↔24 gap = 8 → radius 3.2px)', () => {
    expect(nearestScaleToken(schema, 17)).toBe('spacing.base') // Δ1
    expect(nearestScaleToken(schema, 18)).toBe('spacing.base') // Δ2
    expect(nearestScaleToken(schema, 19)).toBe('spacing.base') // Δ3 ≤ 0.4×8
    expect(nearestScaleToken(schema, 21)).toBe('spacing.lg') // Δ3 toward 24
  })

  it('bypasses the midpoint between two slots (no equidistant snap)', () => {
    expect(nearestScaleToken(schema, 20)).toBeNull() // exact midpoint 16↔24
    expect(nearestScaleToken(schema, 6)).toBeNull() // midpoint 4↔8
    expect(nearestScaleToken(schema, 10)).toBeNull() // midpoint 8↔12
  })

  it('caps the radius so a coarse scale cannot snap from afar', () => {
    // spacing {0, 40, 80}: gap 40 → 0.4×40 = 16, capped to 8. 9px off → no snap.
    const coarse = withSpacing({ a: 0, b: 40, c: 80 })
    expect(SCALE_GAP_FRACTION * 40).toBeGreaterThan(SCALE_SNAP_CAP_PX)
    expect(nearestScaleToken(coarse, 49)).toBeNull() // Δ9 from 40 > cap 8
    expect(nearestScaleToken(coarse, 47)).toBe('spacing.b') // Δ7 from 40 ≤ cap 8
  })
})

describe('nearestScaleToken — cross-scale ambiguity', () => {
  it('snaps when equal-distance slots share the same value', () => {
    // 4 matches both spacing.xs and rounded.sm (both 4px) — same value, no risk.
    expect(nearestScaleToken(schema, 4)).toBe('spacing.xs')
  })
})

describe('nearestScaleToken — tolerance adapts to the scale', () => {
  it('the SAME Δ3 deviation snaps on an 8px grid but is rejected on a 4px grid', () => {
    const coarse = withSpacing({ a: 0, b: 8, c: 16 }) // gap 8 → radius 3.2
    const fine = withSpacing({ a: 0, b: 4, c: 8 }) //  gap 4 → radius 1.6
    expect(nearestScaleToken(coarse, 11)).toBe('spacing.b') // Δ3 ≤ 3.2 → snap
    expect(nearestScaleToken(fine, 11)).toBeNull() //          Δ3 >  1.6 → bypass
  })
})

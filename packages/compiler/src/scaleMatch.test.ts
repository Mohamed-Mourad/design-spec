// scaleMatch.test.ts — the dimensional half of the best-match engine.
//
// Pins the ≤ 2px snap boundary, the just-over bypass, and the equidistant
// bypass that protects layout from a silently wrong snap.

import { describe, it, expect } from 'vitest'
import { defaultSchema } from './defaultSchema.js'
import { nearestScaleToken } from './scaleMatch.js'

const schema = defaultSchema
// spacing: base16 xs4 sm8 md16 lg24 xl40 2xl64 · rounded: none0 sm4 md8 lg12 full9999

describe('nearestScaleToken — exact', () => {
  it('snaps an exact spacing value (first in insertion order on a tie of equal values)', () => {
    expect(nearestScaleToken(schema, 16)).toBe('spacing.base') // base & md both 16 → base
    expect(nearestScaleToken(schema, 24)).toBe('spacing.lg')
    expect(nearestScaleToken(schema, 0)).toBe('rounded.none')
  })

  it('snaps an exact rounded value', () => {
    expect(nearestScaleToken(schema, 12)).toBe('rounded.lg')
    expect(nearestScaleToken(schema, 9999)).toBe('rounded.full')
  })
})

describe('nearestScaleToken — 2px boundary', () => {
  it('snaps at exactly Δ2px (inclusive)', () => {
    expect(nearestScaleToken(schema, 18)).toBe('spacing.base') // |18-16| = 2
  })

  it('snaps within Δ2px', () => {
    expect(nearestScaleToken(schema, 17)).toBe('spacing.base') // |17-16| = 1
  })

  it('bypasses just over Δ2px (unfixable)', () => {
    expect(nearestScaleToken(schema, 19)).toBeNull() // nearest 16 → Δ3
  })
})

describe('nearestScaleToken — equidistant bypass', () => {
  it('bypasses a value sitting between two distinct slots, even within 2px', () => {
    // 6 is Δ2 from xs(4) and Δ2 from sm(8) — distinct slots → corruption risk.
    expect(nearestScaleToken(schema, 6)).toBeNull()
    // 10 is Δ2 from sm(8) and Δ2 from rounded.lg(12) — distinct slots.
    expect(nearestScaleToken(schema, 10)).toBeNull()
  })

  it('does NOT bypass when equal-distance slots share the same value', () => {
    // 4 matches both spacing.xs and rounded.sm (both 4px) — same value, no risk.
    expect(nearestScaleToken(schema, 4)).toBe('spacing.xs')
  })
})

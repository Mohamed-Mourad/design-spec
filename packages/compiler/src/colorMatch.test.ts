// colorMatch.test.ts — the perceptual color half of the best-match engine.
//
// Pins the ΔE = 2.5 boundary (inclusive) and just over it, proves the CIELAB
// round-trip is sane, and asserts the engine invariant: a returned token is the
// argmin in CIELAB and within threshold; null means nothing is.

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { defaultSchema } from './defaultSchema.js'
import {
  COLOR_DELTA_E_THRESHOLD,
  hexToLab,
  deltaE76,
  nearestColorToken,
} from './colorMatch.js'

const schema = defaultSchema

describe('CIELAB conversion', () => {
  it('maps the sRGB primaries near their reference L*a*b*', () => {
    const white = hexToLab('#FFFFFF')!
    expect(white.L).toBeCloseTo(100, 4)
    expect(white.a).toBeCloseTo(0, 1)
    expect(white.b).toBeCloseTo(0, 1)
    const black = hexToLab('#000000')!
    expect(black.L).toBeCloseTo(0, 4)
    // Pure red sits at L≈53, strongly +a*.
    const red = hexToLab('#FF0000')!
    expect(red.L).toBeCloseTo(53.24, 1)
    expect(red.a).toBeGreaterThan(60)
  })

  it('returns null for a malformed hex', () => {
    expect(hexToLab('#zzzzzz')).toBeNull()
    expect(hexToLab('nope')).toBeNull()
  })

  it('ΔE of a color with itself is zero', () => {
    const lab = hexToLab('#2563EB')!
    expect(deltaE76(lab, lab)).toBe(0)
  })
})

describe('nearestColorToken — ΔE = 2.5 boundary', () => {
  const primaryLab = hexToLab(schema.colors.primary)!

  it('snaps at exactly ΔE = 2.5 (inclusive)', () => {
    const atBoundary = '#3369F1' // measured ΔE = 2.5000 vs primary
    expect(deltaE76(hexToLab(atBoundary)!, primaryLab)).toBeCloseTo(2.5, 3)
    expect(deltaE76(hexToLab(atBoundary)!, primaryLab)).toBeLessThanOrEqual(COLOR_DELTA_E_THRESHOLD)
    expect(nearestColorToken(schema, atBoundary)).toBe('colors.primary')
  })

  it('bypasses just over ΔE = 2.5 (unfixable)', () => {
    const justOver = '#3069F0' // measured ΔE ≈ 2.61 vs primary
    expect(deltaE76(hexToLab(justOver)!, primaryLab)).toBeGreaterThan(COLOR_DELTA_E_THRESHOLD)
    expect(nearestColorToken(schema, justOver)).toBeNull()
  })

  it('prefers an exact hex match outright', () => {
    expect(nearestColorToken(schema, '#2563EB')).toBe('colors.primary')
    expect(nearestColorToken(schema, '#2563eb')).toBe('colors.primary') // case-insensitive
  })

  it('returns null for a color far from every token', () => {
    expect(nearestColorToken(schema, '#FF00FF')).toBeNull()
    expect(nearestColorToken(schema, '#888888')).toBeNull()
  })
})

describe('nearestColorToken — engine invariant', () => {
  it('a snapped token is the in-threshold argmin; null means none qualifies', () => {
    const hexArb = fc
      .tuple(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }))
      .map(([r, g, b]) => '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join(''))

    fc.assert(
      fc.property(hexArb, (hex) => {
        const got = nearestColorToken(schema, hex)
        const target = hexToLab(hex)!
        // Brute-force the true minimum ΔE across the palette.
        let min = Infinity
        let argmin: string | null = null
        for (const [name, value] of Object.entries(schema.colors)) {
          const d = deltaE76(target, hexToLab(value)!)
          if (d < min) {
            min = d
            argmin = `colors.${name}`
          }
        }
        if (got === null) {
          expect(min).toBeGreaterThan(COLOR_DELTA_E_THRESHOLD)
        } else {
          expect(min).toBeLessThanOrEqual(COLOR_DELTA_E_THRESHOLD)
          expect(got).toBe(argmin)
        }
      }),
      { numRuns: 500 },
    )
  })
})

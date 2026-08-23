// snap.test.ts — the bootstrapper's snapping contract.
//
// What matters here is not that a rough value finds a token. It is what happens
// when it *cannot*: the value must come back unsnapped, with its nearest
// neighbour named, and nothing invented. These pin that boundary from both
// sides, plus the two properties the acceptance criteria rest on — determinism
// (the same input snapped twice is byte-identical) and agreement with the
// Drift-Janitor's own matchers, which is the whole point of sharing the engine.

import { describe, it, expect } from 'vitest'
import type { DesignSystemSchema } from './types/schema.js'
import { defaultSchema } from './defaultSchema.js'
import { snapColor, snapSpatial, snapRef } from './snap.js'
import { nearestColorToken, COLOR_DELTA_E_THRESHOLD } from './colorMatch.js'
import { nearestScaleToken } from './scaleMatch.js'

const schema = defaultSchema
// default colors: primary #2563EB · surface #FFFFFF · error #DC2626 · border #E2E8F0 …
// default spacing: base16 xs4 sm8 md16 lg24 xl40 2xl64 · rounded: none0 sm4 md8 lg12 full9999

const withColors = (colors: Record<string, `#${string}`>): DesignSystemSchema => ({
  ...defaultSchema,
  colors,
})

const withSpacing = (spacing: Record<string, string | number>): DesignSystemSchema => ({
  ...defaultSchema,
  spacing,
  rounded: {},
})

describe('snapColor — inside tolerance', () => {
  it('snaps an exact hex to its token at ΔE 0', () => {
    const snap = snapColor(schema, '#2563EB')
    expect(snap.snapped).toBe(true)
    expect(snap.token).toBe('colors.primary')
    expect(snap.value).toBe('#2563EB')
    expect(snap.distance).toBe(0)
    expect(snap.reason).toBeUndefined()
  })

  it('snaps a near-miss a screenshot would produce', () => {
    // One channel off — the classic lossy-screenshot artefact.
    const snap = snapColor(schema, '#2564EB')
    expect(snap.snapped).toBe(true)
    expect(snap.token).toBe('colors.primary')
    expect(snap.distance).toBeLessThanOrEqual(COLOR_DELTA_E_THRESHOLD)
  })

  it('reports the tolerance it judged against', () => {
    expect(snapColor(schema, '#2563EB').tolerance).toBe(COLOR_DELTA_E_THRESHOLD)
    expect(snapColor(schema, '#2563EB', { maxDeltaE: 1 }).tolerance).toBe(1)
  })
})

describe('snapColor — outside tolerance', () => {
  it('leaves an unmapped color unsnapped and invents nothing', () => {
    const snap = snapColor(schema, '#FA3C19')
    expect(snap.snapped).toBe(false)
    expect(snap.token).toBeNull()
    expect(snap.value).toBeNull()
    expect(snap.reason).toBe('out-of-tolerance')
  })

  it('still names the nearest neighbour, so it can be offered as a new token', () => {
    const snap = snapColor(schema, '#FA3C19')
    expect(snap.nearest).not.toBeNull()
    expect(snap.nearest!.token).toBe('colors.error')
    expect(snap.nearest!.distance).toBeGreaterThan(COLOR_DELTA_E_THRESHOLD)
    expect(snap.distance).toBe(snap.nearest!.distance)
  })

  it('reads an unreadable value as a miss rather than throwing', () => {
    const snap = snapColor(schema, 'rebeccapurple')
    expect(snap.snapped).toBe(false)
    expect(snap.reason).toBe('unreadable')
    expect(snap.nearest).toBeNull()
  })

  it('misses when the schema has no colors at all', () => {
    const snap = snapColor(withColors({}), '#2563EB')
    expect(snap.snapped).toBe(false)
    expect(snap.reason).toBe('no-tokens')
  })
})

describe('snapColor — reading what a parser reports', () => {
  it('accepts 0–255 channels', () => {
    expect(snapColor(schema, { r: 37, g: 99, b: 235 }).token).toBe('colors.primary')
  })

  it('accepts the 0–1 channels Figma and most vision parsers report', () => {
    expect(snapColor(schema, { r: 37 / 255, g: 99 / 255, b: 235 / 255 }).token).toBe('colors.primary')
  })

  it('normalises the input to the uppercase form the schema is written in', () => {
    expect(snapColor(schema, '  #2563eb ').input).toBe('#2563EB')
    expect(snapColor(schema, '#fff').input).toBe('#FFFFFF')
  })

  it('clamps an out-of-range channel instead of emitting a malformed hex', () => {
    expect(snapColor(schema, { r: 300, g: -20, b: 255 }).input).toBe('#FF00FF')
  })
})

describe('snapSpatial — inside tolerance', () => {
  it('snaps an exact step', () => {
    const snap = snapSpatial(schema, 24)
    expect(snap.snapped).toBe(true)
    expect(snap.token).toBe('spacing.lg')
    expect(snap.value).toBe(24)
    expect(snap.distance).toBe(0)
  })

  it('snaps a loose measurement within the gap-relative radius', () => {
    // 16↔24 gap = 8 → radius 3.2px. A 21px gutter is 3 off 24.
    const snap = snapSpatial(schema, 21)
    expect(snap.token).toBe('spacing.lg')
    expect(snap.tolerance).toBeCloseTo(3.2, 5)
  })

  it('reads a px string as well as a number', () => {
    expect(snapSpatial(schema, '24px').token).toBe('spacing.lg')
    expect(snapSpatial(schema, '24').token).toBe('spacing.lg')
  })

  it('narrows to one scale when the caller knows what the measurement is', () => {
    // 12 is rounded.lg exactly; against spacing alone it sits at the 8↔16
    // midpoint and must not snap.
    expect(snapSpatial(schema, 12, { scales: ['rounded'] }).token).toBe('rounded.lg')
    expect(snapSpatial(schema, 12, { scales: ['spacing'] }).snapped).toBe(false)
  })
})

describe('snapSpatial — outside tolerance', () => {
  it('leaves a midpoint value unsnapped rather than picking a side', () => {
    const snap = snapSpatial(withSpacing({ a: 16, b: 24 }), 20)
    expect(snap.snapped).toBe(false)
    expect(snap.reason).toBe('out-of-tolerance')
    expect(snap.token).toBeNull()
  })

  it('names the nearest step on a miss', () => {
    const snap = snapSpatial(withSpacing({ sm: 8, md: 16 }), 30)
    expect(snap.nearest!.token).toBe('spacing.md')
    expect(snap.nearest!.distance).toBe(14)
    expect(snap.snapped).toBe(false)
  })

  it('bypasses when two scales disagree on the value', () => {
    // spacing {a:10} and rounded {b:11}: one slot each, so both fall back to the
    // absolute cap and both match 10.5 — on different values.
    const split: DesignSystemSchema = { ...defaultSchema, spacing: { a: 10 }, rounded: { b: '11px' } }
    const snap = snapSpatial(split, 10.5)
    expect(snap.snapped).toBe(false)
    expect(snap.reason).toBe('ambiguous')
  })

  it('misses when the requested scales are empty', () => {
    const snap = snapSpatial(withSpacing({}), 24, { scales: ['spacing'] })
    expect(snap.reason).toBe('no-tokens')
  })

  it('reads an unreadable measurement as a miss', () => {
    expect(snapSpatial(schema, '1.5rem').reason).toBe('unreadable')
    expect(snapSpatial(schema, Number.NaN).reason).toBe('unreadable')
  })
})

describe('snapRef', () => {
  it('renders a snapped token in the schema reference syntax', () => {
    expect(snapRef(snapSpatial(schema, 24))).toBe('{spacing.lg}')
    expect(snapRef(snapColor(schema, '#2563EB'))).toBe('{colors.primary}')
  })

  it('renders nothing for a miss — there is no ref to write', () => {
    expect(snapRef(snapColor(schema, '#FA3C19'))).toBeNull()
  })
})

describe('snapping is deterministic', () => {
  it('returns a byte-identical result for a repeated input', () => {
    const colors = ['#2563EB', '#2564EB', '#FA3C19', '#0F172B', 'not-a-color']
    const sizes = [0, 4, 6, 17, 20, 21, 63, 9999]
    const once = JSON.stringify([
      colors.map((c) => snapColor(schema, c)),
      sizes.map((n) => snapSpatial(schema, n)),
    ])
    const twice = JSON.stringify([
      colors.map((c) => snapColor(schema, c)),
      sizes.map((n) => snapSpatial(schema, n)),
    ])
    expect(twice).toBe(once)
    expect(once).toMatchSnapshot()
  })

  it('breaks a color tie on schema insertion order, not iteration luck', () => {
    const twins = withColors({ first: '#2563EB', second: '#2563EB' })
    expect(snapColor(twins, '#2563EB').token).toBe('colors.first')
    expect(snapColor(twins, '#2563EC').token).toBe('colors.first')
  })
})

describe('snapping agrees with the Drift-Janitor matchers', () => {
  const colors = ['#2563EB', '#2564EB', '#FA3C19', '#FFFFFF', '#E2E8F1', '#0F172A']
  const sizes = [0, 4, 6, 8, 10, 12, 16, 17, 19, 20, 21, 24, 40, 64, 100]

  it.each(colors)('snapColor(%s) matches nearestColorToken', (hex) => {
    expect(snapColor(schema, hex).token).toBe(nearestColorToken(schema, hex))
  })

  it.each(sizes)('snapSpatial(%i) matches nearestScaleToken', (px) => {
    expect(snapSpatial(schema, px).token).toBe(nearestScaleToken(schema, px))
  })
})

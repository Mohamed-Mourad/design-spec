// color.test.ts — every color notation a scanned repo can write, normalized to
// the one representation the schema stores.

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { normalizeColor, isColorValue } from './color.js'

describe('normalizeColor', () => {
  it.each([
    ['#fff', '#FFFFFF'],
    ['#FFF', '#FFFFFF'],
    ['#c8813d', '#C8813D'],
    ['#C8813DFF', '#C8813D'], // 8-digit hex, alpha dropped
    ['#abcd', '#AABBCC'], // 4-digit hex, alpha dropped
  ])('normalizes hex %s', (input, want) => {
    expect(normalizeColor(input)).toBe(want)
  })

  it.each([
    ['rgb(37, 99, 235)', '#2563EB'],
    ['rgb(37 99 235)', '#2563EB'],
    ['rgba(37, 99, 235, 0.5)', '#2563EB'],
    ['rgb(37 99 235 / <alpha-value>)', '#2563EB'], // the Tailwind v3 convention
    ['rgb(100%, 0%, 0%)', '#FF0000'],
  ])('normalizes %s', (input, want) => {
    expect(normalizeColor(input)).toBe(want)
  })

  it.each([
    ['hsl(0, 100%, 50%)', '#FF0000'],
    ['hsl(120 100% 50%)', '#00FF00'],
    ['hsla(240, 100%, 50%, 0.4)', '#0000FF'],
    ['hsl(0 0% 100%)', '#FFFFFF'],
  ])('normalizes %s', (input, want) => {
    expect(normalizeColor(input)).toBe(want)
  })

  it('normalizes a bare HSL triplet — the shadcn/ui storage convention', () => {
    expect(normalizeColor('0 0% 100%')).toBe('#FFFFFF')
    expect(normalizeColor('222.2 84% 4.9%')).toBe('#020817')
  })

  it('normalizes a bare RGB channel triplet', () => {
    expect(normalizeColor('37 99 235')).toBe('#2563EB')
    expect(normalizeColor('37, 99, 235')).toBe('#2563EB')
  })

  it('normalizes oklch — what Tailwind v4 emits', () => {
    expect(normalizeColor('oklch(1 0 0)')).toBe('#FFFFFF')
    expect(normalizeColor('oklch(0 0 0)')).toBe('#000000')
    expect(normalizeColor('oklch(54.61% 0.2152 262.88)')).toBe('#2563EB')
  })

  it('round-trips oklch against an independent sRGB → oklch conversion', () => {
    // The forward transform is written out here on purpose: it is derived from
    // the Ottosson matrices independently of the implementation, so agreement
    // is evidence the extractor's inverse is right rather than self-consistent.
    const lin = (c: number) => {
      const v = c / 255
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    }
    const toOklch = (hex: string): string => {
      const r = lin(parseInt(hex.slice(1, 3), 16))
      const g = lin(parseInt(hex.slice(3, 5), 16))
      const b = lin(parseInt(hex.slice(5, 7), 16))
      const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
      const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
      const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
      const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
      const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
      const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
      const C = Math.hypot(A, B)
      const H = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360
      return `oklch(${L.toFixed(6)} ${C.toFixed(6)} ${H.toFixed(4)})`
    }

    for (const hex of ['#2563EB', '#C8813D', '#DC2626', '#16A34A', '#0F172A', '#F4F4F5', '#FFFFFF']) {
      expect(normalizeColor(toOklch(hex))).toBe(hex)
    }
  })

  it('clamps an out-of-gamut oklch instead of producing garbage', () => {
    expect(normalizeColor('oklch(0.9 0.4 140)')).toMatch(/^#[0-9A-F]{6}$/)
  })

  it.each([
    'transparent',
    'currentColor',
    'inherit',
    'var(--color-primary)',
    'linear-gradient(#fff, #000)',
    '',
    'not-a-color',
    '#12345', // wrong hex length
  ])('returns null for %s', (input) => {
    expect(normalizeColor(input)).toBeNull()
  })

  it('ignores an !important suffix', () => {
    expect(normalizeColor('#C8813D !important')).toBe('#C8813D')
  })

  it('is idempotent — normalizing its own output is a no-op', () => {
    fc.assert(
      fc.property(fc.nat({ max: 0xffffff }), (n) => {
        const hex = `#${n.toString(16).padStart(6, '0')}`
        const once = normalizeColor(hex)
        expect(once).not.toBeNull()
        expect(normalizeColor(once as string)).toBe(once)
      }),
      { numRuns: 300 },
    )
  })

  it('round-trips rgb() back to the same hex', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 255 }),
        fc.nat({ max: 255 }),
        fc.nat({ max: 255 }),
        (r, g, b) => {
          expect(normalizeColor(`rgb(${r}, ${g}, ${b})`)).toBe(
            normalizeColor(`#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`),
          )
        },
      ),
      { numRuns: 300 },
    )
  })

  it('never throws', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 80 }), (s) => {
        expect(() => normalizeColor(s)).not.toThrow()
      }),
      { numRuns: 500 },
    )
  })
})

describe('isColorValue', () => {
  it('agrees with normalizeColor', () => {
    expect(isColorValue('#fff')).toBe(true)
    expect(isColorValue('16px')).toBe(false)
  })
})

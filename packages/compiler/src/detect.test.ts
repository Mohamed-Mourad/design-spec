// detect.test.ts — drift detection exactness: every reported drift points at the
// exact span it claims (file/line/column round-trips), kinds are classified
// correctly, and arbitrary classes are not double-counted as bare hex.

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { defaultSchema } from './defaultSchema.js'
import { detect, nearestColorToken } from './detect.js'

const schema = defaultSchema

describe('detect — span exactness', () => {
  it('every drift column slices back to its `found` text', () => {
    const fragment = fc.constantFrom(
      '#2563EB',
      'text-[#475569]',
      'Color(0xFF16A34A)',
      '24px',
      'padding: ',
      'const c =',
      ';\n',
      'x',
    )
    fc.assert(
      fc.property(fc.array(fragment, { maxLength: 30 }).map((p) => p.join('')), (src) => {
        const lines = src.split('\n')
        for (const d of detect(src, schema)) {
          const line = lines[d.line - 1]
          expect(line.slice(d.column - 1, d.column - 1 + d.found.length)).toBe(d.found)
          expect(d.fixable).toBe(d.nearestToken !== null)
        }
      }),
      { numRuns: 400 },
    )
  })
})

describe('detect — classification', () => {
  it('classifies an exact inline hex and resolves the token', () => {
    const [d] = detect('color: #2563EB;', schema)
    expect(d.kind).toBe('inline-hex')
    expect(d.nearestToken).toBe('colors.primary')
  })

  it('classifies an arbitrary Tailwind class without double-counting its hex', () => {
    const drifts = detect('<div className="text-[#2563EB]" />', schema)
    expect(drifts).toHaveLength(1)
    expect(drifts[0].kind).toBe('arbitrary-class')
  })

  it('classifies a Flutter color', () => {
    const [d] = detect('Color(0xFF2563EB)', schema)
    expect(d.kind).toBe('flutter-color')
    expect(d.nearestToken).toBe('colors.primary')
  })

  it('classifies a raw px against the spacing scale', () => {
    const [d] = detect('padding: 16px;', schema)
    expect(d.kind).toBe('raw-px')
    // 16px maps to the first exact-match spacing token in insertion order (base, also 16px).
    expect(d.nearestToken).toBe('spacing.base')
  })

  it('reports line numbers across a multi-line source', () => {
    const drifts = detect('a\n#2563EB\nb', schema)
    expect(drifts).toHaveLength(1)
    expect(drifts[0].line).toBe(2)
  })
})

describe('nearestColorToken — perceptual ΔE', () => {
  it('prefers an exact match over a near one', () => {
    expect(nearestColorToken(schema, '#2563EB')).toBe('colors.primary')
  })

  it('snaps a within-ΔE near color to the nearest token', () => {
    // one channel off by a few units — perceptually well inside ΔE 2.5.
    expect(nearestColorToken(schema, '#2563EE')).toBe('colors.primary')
  })

  it('returns null for a color beyond ΔE 2.5', () => {
    expect(nearestColorToken(schema, '#FF00FF')).toBeNull()
  })

  it('returns null for a malformed hex', () => {
    expect(nearestColorToken(schema, '#zzzzzz')).toBeNull()
  })
})

describe('detect — strict fixable flag at the heuristic boundaries', () => {
  it('color: fixable at ΔE = 2.5, unfixable just over', () => {
    const [at] = detect('color: #3369F1;', schema) // ΔE = 2.5000 vs primary
    expect(at.kind).toBe('inline-hex')
    expect(at.nearestToken).toBe('colors.primary')
    expect(at.fixable).toBe(true)

    const [over] = detect('color: #3069F0;', schema) // ΔE ≈ 2.61 vs primary
    expect(over.nearestToken).toBeNull()
    expect(over.fixable).toBe(false)
  })

  it('px: fixable within the gap-relative radius, unfixable at a midpoint', () => {
    const [at] = detect('padding: 19px;', schema) // Δ3 ≤ 0.4×(24-16)
    expect(at.kind).toBe('raw-px')
    expect(at.nearestToken).toBe('spacing.base')
    expect(at.fixable).toBe(true)

    const [over] = detect('padding: 20px;', schema) // midpoint 16↔24
    expect(over.nearestToken).toBeNull()
    expect(over.fixable).toBe(false)

    const [mid] = detect('padding: 6px;', schema) // midpoint 4↔8
    expect(mid.nearestToken).toBeNull()
    expect(mid.fixable).toBe(false)
  })
})

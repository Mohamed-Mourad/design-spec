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

describe('nearestColorToken — tolerance', () => {
  it('prefers an exact match over a near one', () => {
    expect(nearestColorToken(schema, '#2563EB')).toBe('colors.primary')
  })

  it('snaps a within-tolerance near color to the nearest token', () => {
    // one channel off by a few units — inside the default tolerance of 12.
    expect(nearestColorToken(schema, '#2563EE')).toBe('colors.primary')
  })

  it('returns null for a color outside tolerance', () => {
    expect(nearestColorToken(schema, '#FF00FF')).toBeNull()
  })

  it('returns null for a malformed hex', () => {
    expect(nearestColorToken(schema, '#zzzzzz')).toBeNull()
  })
})

// fix.test.ts — the auto-fix engine: idempotence (the headline invariant),
// determinism, and safety on unmapped input. Property-based via fast-check.

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { defaultSchema } from './defaultSchema.js'
import { detect } from './detect.js'
import { fix } from './fix.js'

const schema = defaultSchema
const roundtrip = (src: string, target?: 'web' | 'flutter') =>
  fix(src, detect(src, schema), schema, target ? { target } : {})

/** Token hexes that resolve exactly, plus drift forms and noise. */
const fragment = fc.constantFrom(
  '#2563EB',
  '#475569',
  '#FFFFFF',
  'text-[#2563EB]',
  'bg-[#16A34A]',
  'Color(0xFF2563EB)',
  '16px',
  '#ABCDEF', // far from every token — must be left alone
  'const x = ',
  ' color: ',
  '\n',
  '"',
  ';',
  'hello',
)
const sourceArb = fc.array(fragment, { maxLength: 40 }).map((parts) => parts.join(''))

describe('fix — idempotence', () => {
  it('fix(fix(x)) === fix(x) for any source', () => {
    fc.assert(
      fc.property(sourceArb, (src) => {
        const once = roundtrip(src)
        const twice = roundtrip(once)
        expect(twice).toBe(once)
      }),
      { numRuns: 500 },
    )
  })

  it('is idempotent for the flutter target too', () => {
    fc.assert(
      fc.property(sourceArb, (src) => {
        const once = roundtrip(src, 'flutter')
        expect(roundtrip(once, 'flutter')).toBe(once)
      }),
      { numRuns: 300 },
    )
  })
})

describe('fix — determinism', () => {
  it('same input → same output', () => {
    fc.assert(
      fc.property(sourceArb, (src) => {
        const drifts = detect(src, schema)
        expect(fix(src, drifts, schema)).toBe(fix(src, drifts, schema))
      }),
    )
  })
})

describe('fix — safety', () => {
  it('leaves a source with no fixable drift byte-identical', () => {
    fc.assert(
      fc.property(sourceArb, (src) => {
        const drifts = detect(src, schema)
        if (drifts.some((d) => d.fixable)) return // only the no-fix case
        expect(fix(src, drifts, schema)).toBe(src)
      }),
    )
  })

  it('never leaves a fixable inline-hex token behind (web)', () => {
    const src = 'a:#2563EB; b:#475569; c:#FFFFFF;'
    const out = roundtrip(src)
    expect(out).not.toContain('#2563EB')
    expect(out).toContain('var(--color-primary)')
  })

  it('preserves the utility prefix on arbitrary classes', () => {
    expect(roundtrip('<div className="bg-[#16A34A] text-[#2563EB]" />')).toBe(
      '<div className="bg-success text-primary" />',
    )
  })

  it('rewrites flutter colors to AppColors under the flutter target', () => {
    expect(roundtrip('Color(0xFF2563EB)', 'flutter')).toBe('AppColors.primary')
  })

  it('leaves an unmapped hex untouched', () => {
    expect(roundtrip('color: #ABCDEF;')).toBe('color: #ABCDEF;')
  })
})

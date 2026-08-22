// cssCustomProps.test.ts — the stylesheet reader that serves both the
// hand-written source path (Extracted) and the compiled-bundle Smart Fallback
// path (Inferred).

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  scanCssRules,
  parseDeclarations,
  classifyCssVar,
  tokenKeyFor,
  toDimension,
  extractCssCustomProps,
} from './cssCustomProps.js'

describe('scanCssRules', () => {
  it('returns leaf rules with their enclosing at-rules', () => {
    const rules = scanCssRules(`
      :root { --a: 1 }
      @media (prefers-color-scheme: dark) {
        :root { --a: 2 }
      }
    `)
    expect(rules).toHaveLength(2)
    expect(rules[0]).toMatchObject({ selector: ':root', atRules: [] })
    expect(rules[1].atRules).toEqual(['@media (prefers-color-scheme: dark)'])
  })

  it('treats an at-rule holding declarations as its own leaf', () => {
    const rules = scanCssRules('@theme { --color-primary: #fff }')
    expect(rules).toHaveLength(1)
    expect(rules[0].selector).toBe('@theme')
  })

  it('does not mistake braces inside strings or comments for rules', () => {
    const rules = scanCssRules(`.a { content: "}{" } /* .b { --x: 1 } */`)
    expect(rules.map((r) => r.selector)).toEqual(['.a'])
  })

  it('handles a minified single-line bundle', () => {
    const rules = scanCssRules(':root,:host{--a:1;--b:2}.c{color:red}')
    expect(rules.map((r) => r.selector)).toEqual([':root,:host', '.c'])
  })

  it('never throws on arbitrary input', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 300 }), (s) => {
        expect(() => scanCssRules(s)).not.toThrow()
      }),
      { numRuns: 400 },
    )
  })
})

describe('parseDeclarations', () => {
  it('reads custom properties and drops !important', () => {
    expect(parseDeclarations('--a: 1px; color: red; --b: #fff !important')).toEqual({
      a: '1px',
      b: '#fff',
    })
  })
})

describe('toDimension', () => {
  it.each([
    ['16px', '16px'],
    ['1.5rem', '1.5rem'],
    ['0.5em', '0.5em'],
    ['0', 0],
    ['4', 4],
  ])('accepts %s', (input, want) => {
    expect(toDimension(input)).toEqual(want)
  })

  it.each(['100%', 'calc(1rem + 2px)', '50vw', 'auto', ''])('rejects %s', (input) => {
    expect(toDimension(input)).toBeNull()
  })
})

describe('classifyCssVar', () => {
  it.each([
    ['color-primary', '#2563EB', 'colors'],
    ['primary', '221 83% 53%', 'colors'],
    ['border', '#E2E8F0', 'colors'], // value shape wins over the name hint
    ['radius', '0.5rem', 'rounded'],
    ['radius-md', '8px', 'rounded'],
    ['spacing-lg', '24px', 'spacing'],
    ['shadow-sm', '0 1px 2px 0 rgb(0 0 0 / 0.05)', 'shadows'],
    ['elevation-1', '0 1px 2px #0003', 'shadows'],
    ['text-sm', '14px', 'fontSize'],
    ['font-sans', 'Inter, sans-serif', 'fontFamily'],
    ['breakpoint-md', '768px', 'breakpoints'],
    ['leading-tight', '1.25', 'other'],
  ] as const)('classifies --%s as %s', (name, value, want) => {
    expect(classifyCssVar(name, value)).toBe(want)
  })
})

describe('tokenKeyFor', () => {
  it.each([
    ['colors', 'color-primary', 'primary'],
    ['colors', 'primary', 'primary'],
    ['rounded', 'radius-md', 'md'],
    ['rounded', 'radius', 'base'],
    ['shadows', 'shadow', 'base'],
    ['fontSize', 'text-lg', 'lg'],
    ['fontFamily', 'font-sans', 'sans'],
    ['breakpoints', 'screen-md', 'md'],
  ] as const)('maps --%s (%s) to %s', (group, name, want) => {
    expect(tokenKeyFor(group, name)).toBe(want)
  })
})

describe('extractCssCustomProps', () => {
  it('reads a :root theme into schema groups', () => {
    const out = extractCssCustomProps(`
      :root {
        --color-primary: #2563EB;
        --color-surface: #FFFFFF;
        --spacing-md: 16px;
        --radius-md: 8px;
        --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
        --font-sans: Inter;
        --text-base: 16px;
        --breakpoint-md: 768px;
      }
    `)
    expect(out.colors).toEqual({ primary: '#2563EB', surface: '#FFFFFF' })
    expect(out.spacing).toEqual({ md: '16px' })
    expect(out.rounded).toEqual({ md: '8px' })
    expect(out.shadows).toEqual({ sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)' })
    expect(out.fontFamily).toEqual({ sans: 'Inter' })
    expect(out.fontSize).toEqual({ base: '16px' })
    expect(out.breakpoints).toEqual({ md: '768px' })
    expect(out.declarationCount).toBe(8)
  })

  it('separates dark-scheme colors from the base theme', () => {
    const out = extractCssCustomProps(`
      :root { --color-surface: #FFFFFF }
      .dark { --color-surface: #0B0B0F }
      @media (prefers-color-scheme: dark) { :root { --color-on-surface: #FAFAFA } }
    `)
    expect(out.colors).toEqual({ surface: '#FFFFFF' })
    expect(out.darkColors).toEqual({ surface: '#0B0B0F', 'on-surface': '#FAFAFA' })
  })

  it('reads a Tailwind v4 @theme block', () => {
    const out = extractCssCustomProps('@theme { --color-primary: oklch(1 0 0); --spacing-md: 1rem }')
    expect(out.colors).toEqual({ primary: '#FFFFFF' })
    expect(out.spacing).toEqual({ md: '1rem' })
  })

  it('ignores component-scoped custom properties', () => {
    const out = extractCssCustomProps('.btn { --color-primary: #F00 }')
    expect(out.colors).toEqual({})
    expect(out.declarationCount).toBe(0)
  })

  it('ignores Tailwind runtime internals', () => {
    const out = extractCssCustomProps(':root { --tw-ring-color: #F00; --color-primary: #0F0 }')
    expect(out.colors).toEqual({ primary: '#00FF00' })
  })

  it('keeps the first value for a key across duplicate rules', () => {
    const out = extractCssCustomProps(':root { --color-primary: #111 } html { --color-primary: #222 }')
    expect(out.colors).toEqual({ primary: '#111111' })
  })

  it('is deterministic', () => {
    const css = ':root{--color-a:#111;--color-b:#222;--spacing-x:8px}'
    expect(extractCssCustomProps(css)).toEqual(extractCssCustomProps(css))
  })
})

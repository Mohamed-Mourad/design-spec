// staticJs.test.ts — the no-eval config reader.
//
// The security invariant under test is negative: nothing in a config is ever
// executed. So the assertions are about what happens at the boundary of what
// literal syntax can express — an unevaluable value must be ISOLATED (named in
// `unparseable`) without taking its siblings down with it. That containment is
// what makes Smart Fallback possible.

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { parseStaticConfigObject } from './staticJs.js'

describe('parseStaticConfigObject', () => {
  it('reads a plain CommonJS config', () => {
    const r = parseStaticConfigObject(`module.exports = { darkMode: 'media', theme: { extend: { colors: { brand: '#C8813D' } } } }`)
    expect(r.error).toBeUndefined()
    expect(r.value).toEqual({ darkMode: 'media', theme: { extend: { colors: { brand: '#C8813D' } } } })
    expect(r.unparseable).toEqual([])
  })

  it('follows `export default config` to the local binding', () => {
    const r = parseStaticConfigObject(`
      import type { Config } from 'tailwindcss'
      const config: Config = { prefix: 'tw-' }
      export default config
    `)
    expect(r.value).toEqual({ prefix: 'tw-' })
  })

  it('peels a wrapper call', () => {
    const r = parseStaticConfigObject(`export default defineConfig({ darkMode: 'class' })`)
    expect(r.value).toEqual({ darkMode: 'class' })
  })

  it('isolates a spread but keeps every literal sibling', () => {
    const r = parseStaticConfigObject(`
      module.exports = {
        theme: { colors: { ...base.colors, primary: '#4F46E5', muted: '#9CA3AF' } },
      }
    `)
    expect(r.value).toEqual({ theme: { colors: { primary: '#4F46E5', muted: '#9CA3AF' } } })
    expect(r.unparseable).toEqual(['theme.colors....base.colors'])
  })

  it('isolates process.env, identifiers, calls and computed keys by path', () => {
    const r = parseStaticConfigObject(`
      export default {
        a: process.env.BRAND,
        b: someIdentifier,
        c: definePreset({ base: 4 }),
        [computed]: 'x',
        d: 'kept',
        e: \`interpolated-\${x}\`,
        f: \`plain\`,
      }
    `)
    expect(r.value).toEqual({ d: 'kept', f: 'plain' })
    expect(r.unparseable).toEqual(['a', 'b', 'c', '[computed]', 'e'])
  })

  it('isolates a method shorthand without losing the rest of the object', () => {
    const r = parseStaticConfigObject(`
      module.exports = {
        plugin(api) { api.addUtilities({ '.x': { color: 'red' } }) },
        darkMode: 'class',
      }
    `)
    expect(r.value).toEqual({ darkMode: 'class' })
    expect(r.unparseable).toEqual(['plugin'])
  })

  it('reads arrays, numbers, booleans and null', () => {
    const r = parseStaticConfigObject(
      `export default { content: ['./a.tsx', './b.tsx'], n: -1.5, hex: 0x10, on: true, off: false, nil: null }`,
    )
    expect(r.value).toEqual({
      content: ['./a.tsx', './b.tsx'],
      n: -1.5,
      hex: 16,
      on: true,
      off: false,
      nil: null,
    })
  })

  it('drops only the unevaluable element of an array', () => {
    const r = parseStaticConfigObject(`export default { plugins: ['a', require('b'), 'c'] }`)
    expect(r.value).toEqual({ plugins: ['a', 'c'] })
    expect(r.unparseable).toEqual(['plugins[1]'])
  })

  it('skips comments, including ones holding config-looking text', () => {
    const r = parseStaticConfigObject(`
      /* export default { decoy: true } */
      module.exports = {
        // theme: { decoy: 1 },
        real: 1,
      }
    `)
    expect(r.value).toEqual({ real: 1 })
  })

  it('handles trailing commas and both quote styles', () => {
    const r = parseStaticConfigObject(`export default { "a": 'x', 'b': "y", }`)
    expect(r.value).toEqual({ a: 'x', b: 'y' })
  })

  it('reports an unreachable config instead of throwing', () => {
    expect(parseStaticConfigObject('const x = 1').error).toBe('no statically reachable config object')
    expect(parseStaticConfigObject('export default someImported').error).toBe(
      'no statically reachable config object',
    )
  })

  it('refuses a source over the size budget', () => {
    const huge = `module.exports = { a: '${'x'.repeat(2 * 1024 * 1024)}' }`
    expect(parseStaticConfigObject(huge).error).toBe('config too large to parse statically')
  })

  it('never throws, whatever it is fed', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 400 }), (s) => {
        expect(() => parseStaticConfigObject(`module.exports = ${s}`)).not.toThrow()
        expect(() => parseStaticConfigObject(s)).not.toThrow()
      }),
      { numRuns: 500 },
    )
  })

  it('is deterministic — same source, same result', () => {
    const src = `export default { theme: { colors: { ...x, a: '#fff' } } }`
    expect(parseStaticConfigObject(src)).toEqual(parseStaticConfigObject(src))
  })
})

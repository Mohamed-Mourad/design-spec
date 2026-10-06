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

  // The inputs the fuzz property used to spin on forever: a closing bracket
  // where a key or a value belongs, which no branch of the object loop consumed.
  it.each([
    ['module.exports = {)', "unexpected ')'"],
    ['module.exports = {]', "unexpected ']'"],
    ['module.exports = { a: ) }', "unexpected ')'"],
    ['export default { a: 1, ] }', "unexpected ']'"],
    ['export default { theme: { colors: { primary: "#fff", ) } } }', "unexpected ')'"],
    ['export default { list: [1, ) ] }', "unexpected ')'"],
  ])('fails %j as unparseable instead of hanging', (src, error) => {
    const r = parseStaticConfigObject(src)
    expect(r.value).toBeNull()
    expect(r.error).toBe(error)
  })

  it('stops a stalled array on its first pass, not at the node budget', () => {
    const r = parseStaticConfigObject('export default { list: [) ] }')
    expect(r.error).toBe("unexpected ')'")
    expect(r.unparseable).toEqual(['list[0]'])
  })

  it('still reads a large flat object — the step budget never trips on honest input', () => {
    const keys = Array.from({ length: 20_000 }, (_, i) => `k${i}: ${i}`)
    const r = parseStaticConfigObject(`export default { ${keys.join(',\n')} }`)
    expect(r.error).toBeUndefined()
    expect(Object.keys(r.value ?? {})).toHaveLength(20_000)
  })

  // A parse that stalls is synchronous, so fast-check can only notice between
  // runs: the time limit turns a regression into a failure rather than a
  // suite that never ends.
  const fuzz = { numRuns: 500, interruptAfterTimeLimit: 20_000, markInterruptAsFailure: true }

  it('never throws, whatever it is fed', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 400 }), (s) => {
        expect(() => parseStaticConfigObject(`module.exports = ${s}`)).not.toThrow()
        expect(() => parseStaticConfigObject(s)).not.toThrow()
      }),
      fuzz,
    )
  })

  it('never throws or stalls on bracket soup', () => {
    const unit = fc.constantFrom(...'{}[]()', ',', ':', ';', '.', '"', "'", '`', '\\', '/', '*', '$', 'a', '1', ' ', '\n')
    fc.assert(
      fc.property(fc.string({ unit, maxLength: 200 }), (s) => {
        expect(() => parseStaticConfigObject(`module.exports = {${s}`)).not.toThrow()
        expect(() => parseStaticConfigObject(`export default [${s}`)).not.toThrow()
      }),
      { ...fuzz, numRuns: 2000 },
    )
  })

  it('is deterministic — same source, same result', () => {
    const src = `export default { theme: { colors: { ...x, a: '#fff' } } }`
    expect(parseStaticConfigObject(src)).toEqual(parseStaticConfigObject(src))
  })
})

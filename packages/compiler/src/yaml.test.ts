// yaml.test.ts — the deterministic YAML emitter. Quoting rules and structural
// shapes are pinned because DESIGN.md frontmatter must be byte-stable.

import { describe, it, expect } from 'vitest'
import { toYaml } from './yaml.js'

describe('toYaml — scalars & quoting', () => {
  it('quotes hex colors and token refs (leading indicator chars)', () => {
    expect(toYaml({ c: '#1A1C1E', r: '{colors.primary}' })).toBe('c: "#1A1C1E"\nr: "{colors.primary}"')
  })
  it('quotes empty strings, booleans-as-words, and number-like strings', () => {
    expect(toYaml({ a: '', b: 'true', c: '12', d: 'no' })).toBe('a: ""\nb: "true"\nc: "12"\nd: "no"')
  })
  it('leaves plain identifiers unquoted', () => {
    expect(toYaml({ name: 'Inter', weight: 600, on: false })).toBe('name: Inter\nweight: 600\non: false')
  })
  it('emits null and, when quoting is triggered, escapes quotes/backslashes', () => {
    // leading "#" forces quoting; the interior " and \ are then escaped.
    expect(toYaml({ a: null, b: '#x"y\\z' })).toBe('a: null\nb: "#x\\"y\\\\z"')
  })
})

describe('toYaml — structures', () => {
  it('nests maps with two-space indent', () => {
    expect(toYaml({ outer: { inner: 1 } })).toBe('outer:\n  inner: 1')
  })
  it('renders scalar arrays as dash lists', () => {
    expect(toYaml({ mood: ['a', 'b'] })).toBe('mood:\n  - a\n  - b')
  })
  it('renders arrays of maps', () => {
    expect(toYaml({ items: [{ x: 1 }, { y: 2 }] })).toBe('items:\n  - x: 1\n  - y: 2')
  })
  it('renders empty map and empty array inline', () => {
    expect(toYaml({ m: {}, a: [] })).toBe('m: {}\na: []')
  })
  it('skips undefined values', () => {
    expect(toYaml({ a: 1, b: undefined, c: 3 })).toBe('a: 1\nc: 3')
  })
})

// jsonSchema.test.ts — the authoritative JSON Schema actually validates real
// schemas (round-trip), rejects malformed ones, and the committed repo-root
// design-spec.schema.json stays in lockstep with the canonical TS const.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import { designSpecJsonSchema } from './jsonSchema.js'
import { defaultSchema } from './defaultSchema.js'
import { responsiveSchema } from './fixtures/responsive.fixture.js'
import { SCHEMA_JSON_PATH, serializeSchema } from './schemaFile.js'

const ajv = new Ajv2020({ allErrors: true, strict: false })
const validate = ajv.compile(designSpecJsonSchema)

describe('JSON Schema — round-trip', () => {
  it('validates the default schema', () => {
    expect(validate(defaultSchema)).toBe(true)
  })

  it('validates the responsive fixture', () => {
    expect(validate(responsiveSchema)).toBe(true)
  })

  it('validates the compiler output of a fresh init (defaultSchema is what init writes)', () => {
    // round-trip: serialize → parse → validate, exactly as lint will.
    const onDisk = JSON.parse(JSON.stringify(defaultSchema))
    expect(validate(onDisk)).toBe(true)
  })
})

describe('JSON Schema — rejects malformed input', () => {
  const cases: Array<[string, () => unknown]> = [
    ['missing name', () => ({ ...defaultSchema, name: undefined })],
    ['no primary color', () => ({ ...defaultSchema, colors: { secondary: '#475569' } })],
    ['non-hex color', () => ({ ...defaultSchema, colors: { ...defaultSchema.colors, primary: 'blue' } })],
    ['empty frameworks', () => ({ ...defaultSchema, export: { ...defaultSchema.export, frameworks: [] } })],
    ['unknown framework', () => ({ ...defaultSchema, export: { ...defaultSchema.export, frameworks: ['svelte'] } })],
    ['bad dimension', () => ({ ...defaultSchema, breakpoints: { tablet: '768' } })],
    ['extra top-level key', () => ({ ...defaultSchema, bogus: true })],
  ]
  for (const [label, make] of cases) {
    it(`rejects: ${label}`, () => {
      expect(validate(JSON.parse(JSON.stringify(make())))).toBe(false)
    })
  }
})

describe('JSON Schema — file sync', () => {
  it('committed design-spec.schema.json matches the canonical TS const', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const path = resolve(here, '..', '..', '..', SCHEMA_JSON_PATH)
    const onDisk = readFileSync(path, 'utf8')
    expect(onDisk).toBe(serializeSchema(designSpecJsonSchema))
  })
})

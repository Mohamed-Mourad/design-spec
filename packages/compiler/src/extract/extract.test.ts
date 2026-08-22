// extract.test.ts — the retrofit engine end to end.
//
// The headline assertion is the activation guarantee: whatever a repo looks
// like, `extractDesignSystem` returns a complete, valid schema with per-token
// provenance. There is no input that dead-ends it. The complex-config fixture
// is the one that proves Smart Fallback: its static parse is deliberately full
// of holes, and the compiled bundle has to fill them.

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { extractDesignSystem } from './index.js'
import { designSpecJsonSchema } from '../jsonSchema.js'
import { defaultSchema } from '../defaultSchema.js'
import { compileDesignMd } from '../designMd.js'
import type { ImportFile, TokenStateMap } from './types.js'
import {
  simpleTailwind,
  complexTailwind,
  shadcnCssVars,
  tailwindV4,
  flutterApp,
  emptyRepo,
} from './__fixtures__/repos.js'

/** Every state present in a group, for compact assertions. */
function statesOf(states: TokenStateMap, group: string): Record<string, string> {
  return states[group] ?? {}
}

function run(files: ImportFile[], repo?: string) {
  return extractDesignSystem({ repo, files })
}

describe('extractDesignSystem — the activation guarantee', () => {
  it.each([
    ['simple tailwind', simpleTailwind],
    ['complex tailwind', complexTailwind],
    ['shadcn css vars', shadcnCssVars],
    ['tailwind v4', tailwindV4],
    ['flutter', flutterApp],
    ['nothing recognisable', emptyRepo],
  ])('always returns a populated schema for %s', (_name, files) => {
    const out = run(files, 'acme/repo')
    // Every group the baseline defines is still present and non-empty.
    for (const group of ['colors', 'typography', 'spacing', 'rounded', 'shadows', 'breakpoints'] as const) {
      expect(Object.keys(out.schema[group]).length).toBeGreaterThan(0)
    }
    // The semantic slots the component blueprints reference always exist.
    for (const slot of Object.keys(defaultSchema.colors)) {
      expect(out.schema.colors[slot]).toBeDefined()
    }
    // And it compiles.
    expect(compileDesignMd(out.schema)).toContain('name:')
  })

  it('produces a schema that validates against the published JSON Schema', () => {
    // Structural check against the authoritative contract's required keys and
    // types, without pulling ajv into this suite.
    const out = run(complexTailwind, 'nebula/app')
    for (const key of designSpecJsonSchema.required) {
      expect(out.schema).toHaveProperty(key)
    }
    expect(typeof out.schema.version).toBe('string')
    expect(Array.isArray(out.schema.overview.moodKeywords)).toBe(true)
  })

  it('is deterministic — same files in, same everything out', () => {
    expect(run(complexTailwind, 'nebula/app')).toEqual(run(complexTailwind, 'nebula/app'))
  })

  it('never throws, whatever files it is handed', () => {
    const anyFile = fc.record({
      path: fc.string({ maxLength: 40 }),
      kind: fc.constantFrom(
        'package_json',
        'pubspec',
        'tailwind_config',
        'source_css',
        'compiled_css',
        'dart_theme',
      ),
      content: fc.string({ maxLength: 400 }),
    })
    fc.assert(
      fc.property(fc.array(anyFile, { maxLength: 5 }), (files) => {
        expect(() => extractDesignSystem({ files: files as ImportFile[] })).not.toThrow()
      }),
      { numRuns: 200 },
    )
  })
})

describe('extractDesignSystem — a statically clean config', () => {
  const out = run(simpleTailwind, 'acme/storefront')

  it('detects the framework stack from the manifest', () => {
    expect(out.detection.frameworks).toEqual(['react-tailwind'])
    expect(out.detection.hasTailwind).toBe(true)
    expect(out.schema.export.frameworks).toEqual(['react-tailwind'])
  })

  it('names the system after the project', () => {
    expect(out.schema.name).toBe('Acme Storefront')
  })

  it('marks config-declared tokens Extracted', () => {
    const colors = statesOf(out.states, 'colors')
    expect(out.schema.colors.brand).toBe('#C8813D')
    expect(colors.brand).toBe('extracted')
    expect(out.schema.colors.ink).toBe('#1F1D1A')
    expect(colors.ink).toBe('extracted')
  })

  it('resolves Tailwind DEFAULT onto the parent key', () => {
    expect(out.schema.colors.brand).toBe('#C8813D')
    expect(out.schema.colors['brand-500']).toBe('#C8813D')
  })

  it('infers the semantic slots the repo does not name', () => {
    const colors = statesOf(out.states, 'colors')
    // `brand` is the alias for `primary`; `danger` is the alias for `error`.
    expect(out.schema.colors.primary).toBe('#C8813D')
    expect(colors.primary).toBe('inferred')
    expect(out.schema.colors.error).toBe('#DC2626')
    expect(colors.error).toBe('inferred')
  })

  it('reads the font stack head, not the whole stack', () => {
    expect(out.schema.typography['body-md'].fontFamily).toBe('Inter')
    expect(out.schema.typography['headline-lg'].fontFamily).toBe('DM Serif Display')
  })

  it('does not touch the compiled bundle when the config parsed cleanly', () => {
    expect(out.usedFallback).toBe(false)
    expect(out.unparseableLayers).toEqual([])
  })

  it('leaves untouched groups Defaulted', () => {
    expect(statesOf(out.states, 'shadows').md).toBe('defaulted')
  })
})

describe('extractDesignSystem — Smart Fallback on an unparseable config', () => {
  const out = run(complexTailwind, 'nebula/app')

  it('isolates only the unparseable layers', () => {
    expect(out.unparseableLayers).toContain('theme.extend.colors.env')
    expect(out.unparseableLayers.some((p) => p.includes('...basePreset'))).toBe(true)
    expect(out.unparseableLayers).toContain('theme.extend.spacing')
    expect(out.unparseableLayers).toContain('plugins[0]')
  })

  it('still extracts every statically safe sibling', () => {
    const colors = statesOf(out.states, 'colors')
    expect(out.schema.colors.primary).toBe('#4F46E5')
    expect(colors.primary).toBe('extracted')
    expect(out.schema.colors.canvas).toBe('#0B0B0F')
    expect(out.schema.colors.muted).toBe('#9CA3AF')
    expect(colors.muted).toBe('extracted')
    expect(out.schema.rounded.lg).toBe('0.75rem')
  })

  it('recovers the missing layers from the compiled bundle as Inferred', () => {
    const colors = statesOf(out.states, 'colors')
    expect(out.usedFallback).toBe(true)
    // Never declared statically anywhere — only the built CSS knows it.
    expect(out.schema.colors.border).toBe('#27272A')
    expect(colors.border).toBe('inferred')
    expect(out.schema.colors['accent-nebula']).toBe('#7C3AED')
    expect(colors['accent-nebula']).toBe('inferred')
    // The spacing scale the config hid behind `definePreset(...)`.
    expect(out.schema.spacing.lg).toBe('24px')
    expect(statesOf(out.states, 'spacing').lg).toBe('inferred')
  })

  it('lets a statically declared value outrank the compiled one', () => {
    // The bundle says `--color-surface: #0B0B0F`; the config declares `canvas`
    // and the CSS declares `--color-canvas`, so `canvas` stays Extracted.
    expect(statesOf(out.states, 'colors').canvas).toBe('extracted')
  })

  it('reads dark-mode overrides out of the bundle media query', () => {
    expect(out.schema.darkMode.enabled).toBe(true)
    expect(out.schema.darkMode.colors.surface).toBe('#050507')
    expect(out.schema.darkMode.colors['on-surface']).toBe('#FAFAFA')
  })

  it('reports what it could not evaluate, per layer', () => {
    const skipped = out.signals.filter((s) => s.kind === 'skipped')
    expect(skipped.length).toBeGreaterThan(0)
    expect(skipped.every((s) => s.source === 'tailwind.config.ts')).toBe(true)
    expect(out.signals.some((s) => s.kind === 'fallback')).toBe(true)
  })

  it('never leaves a token without provenance', () => {
    for (const [group, tokens] of Object.entries(out.states)) {
      for (const [key, state] of Object.entries(tokens)) {
        expect(['extracted', 'inferred', 'defaulted'], `${group}.${key}`).toContain(state)
      }
    }
    const total = out.summary.extracted + out.summary.inferred + out.summary.defaulted
    expect(total).toBeGreaterThan(0)
    expect(out.summary.extracted).toBeGreaterThan(0)
    expect(out.summary.inferred).toBeGreaterThan(0)
  })
})

describe('extractDesignSystem — CSS-variable projects', () => {
  it('reads shadcn HSL triplets and its single --radius', () => {
    const out = run(shadcnCssVars, 'ledger/ui')
    expect(out.schema.colors.primary).toBe('#2563EB')
    expect(out.schema.colors.background).toBe('#FFFFFF')
    expect(statesOf(out.states, 'colors').primary).toBe('extracted')
    expect(out.schema.rounded.base).toBe('0.5rem')
    expect(out.schema.darkMode.colors.background).toBe('#020817')
  })

  it('reads a Tailwind v4 @theme block with no config file', () => {
    const out = run(tailwindV4, 'orbit/web')
    expect(out.detection.frameworks).toEqual(['vue-tailwind'])
    expect(out.detection.hasTailwind).toBe(true)
    expect(out.schema.colors.primary).toMatch(/^#[0-9A-F]{6}$/)
    expect(out.schema.colors.surface).toBe('#FFFFFF')
    expect(statesOf(out.states, 'colors').surface).toBe('extracted')
    expect(out.schema.typography['body-md'].fontFamily).toBe('Geist')
  })
})

describe('extractDesignSystem — non-web projects', () => {
  it('reads Flutter theme colors and detects the stack', () => {
    const out = run(flutterApp, 'harbor/app')
    expect(out.detection.frameworks).toEqual(['flutter'])
    expect(out.schema.name).toBe('Harbor App')
    expect(out.schema.colors.primary).toBe('#2563EB')
    expect(out.schema.colors['surface-raised']).toBe('#F8FAFC')
    // A private `_onSurface` is still a theme color.
    expect(out.schema.colors['on-surface']).toBe('#0F172A')
    expect(statesOf(out.states, 'colors').primary).toBe('extracted')
  })

  it('falls back to react-tailwind and all-defaults for an unrecognisable repo', () => {
    const out = run(emptyRepo, 'mystery/box')
    expect(out.detection.frameworks).toEqual(['react-tailwind'])
    expect(out.summary.extracted).toBe(0)
    expect(out.summary.inferred).toBe(0)
    expect(Object.values(statesOf(out.states, 'colors')).every((s) => s === 'defaulted')).toBe(true)
  })
})

describe('extractDesignSystem — golden output', () => {
  it('pins the schema synthesized from the unparseable-config repo', () => {
    const out = run(complexTailwind, 'nebula/app')
    expect({
      colors: out.schema.colors,
      spacing: out.schema.spacing,
      rounded: out.schema.rounded,
      breakpoints: out.schema.breakpoints,
      darkMode: out.schema.darkMode,
      states: out.states,
      summary: out.summary,
      unparseableLayers: out.unparseableLayers,
    }).toMatchSnapshot()
  })

  it('pins the extraction report the workspace shows the user', () => {
    expect(run(complexTailwind, 'nebula/app').signals).toMatchSnapshot()
  })
})

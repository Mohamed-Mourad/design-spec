import { describe, expect, it } from 'vitest'
import {
  applyFigmaImport,
  emptyImport,
  figmaColorToHex,
  figmaFileKey,
  mapFigmaStyles,
  mapFigmaVariables,
  tokenKeyFor,
} from './map'
import type { FigmaNode, FigmaStyleMeta, FigmaVariable, FigmaVariableCollection } from './types'
import { defaultSchema } from '@/defaults/schema'
import type { DesignSystemSchema } from '@/types/schema'

const style = (over: Partial<FigmaStyleMeta>): FigmaStyleMeta => ({
  key: 'k',
  node_id: '1:1',
  style_type: 'FILL',
  name: 'Primary',
  ...over,
})

describe('figmaFileKey', () => {
  it.each([
    ['https://www.figma.com/file/abc123DEF456/My-System', 'abc123DEF456'],
    ['https://www.figma.com/design/abc123DEF456/My-System?node-id=1-2', 'abc123DEF456'],
    ['https://www.figma.com/proto/abc123DEF456/Proto', 'abc123DEF456'],
    ['  abc123DEF456  ', 'abc123DEF456'],
  ])('reads the key out of %s', (input, expected) => {
    expect(figmaFileKey(input)).toBe(expected)
  })

  it.each(['', 'not a link', 'https://example.com/file/abc123DEF456', 'short'])(
    'returns null for %s',
    (input) => {
      expect(figmaFileKey(input)).toBeNull()
    },
  )
})

describe('figmaColorToHex', () => {
  it('converts 0-1 channels to uppercase hex', () => {
    expect(figmaColorToHex({ r: 1, g: 0, b: 0.5 })).toBe('#FF0080')
  })

  it('drops alpha — the schema is hex only', () => {
    expect(figmaColorToHex({ r: 0, g: 0, b: 0, a: 0.25 })).toBe('#000000')
  })

  it('clamps values outside the 0-1 range', () => {
    expect(figmaColorToHex({ r: 2, g: -1, b: 0 })).toBe('#FF0000')
  })
})

describe('tokenKeyFor', () => {
  it.each([
    ['Brand/Primary 500', 'brand-primary-500'],
    ['  Surface   Raised ', 'surface-raised'],
    ['on-surface', 'on-surface'],
    ['///', 'unnamed'],
  ])('normalises %s', (name, expected) => {
    expect(tokenKeyFor(name)).toBe(expected)
  })
})

describe('mapFigmaStyles', () => {
  it('maps a solid fill style to a color token', () => {
    const result = mapFigmaStyles([style({ name: 'Brand/Primary' })], {
      '1:1': { id: '1:1', fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1 } }] },
    })
    expect(result.colors).toEqual({ 'brand-primary': '#0000FF' })
    expect(result.counts).toEqual({ styles: 1, variables: 0, tokens: 1 })
  })

  it('ignores a hidden paint and takes the first visible solid one', () => {
    const result = mapFigmaStyles([style({})], {
      '1:1': {
        id: '1:1',
        fills: [
          { type: 'SOLID', visible: false, color: { r: 1, g: 0, b: 0 } },
          { type: 'SOLID', color: { r: 0, g: 1, b: 0 } },
        ],
      },
    })
    expect(result.colors.primary).toBe('#00FF00')
  })

  it('reports a gradient fill instead of guessing a color', () => {
    const result = mapFigmaStyles([style({ name: 'Sunset' })], {
      '1:1': { id: '1:1', fills: [{ type: 'GRADIENT_LINEAR' }] },
    })
    expect(result.colors).toEqual({})
    expect(result.notes).toEqual([
      { kind: 'skipped', source: 'Sunset', reason: 'only solid paint styles map to a color token' },
    ])
  })

  it('maps a text style, converting line height and letter spacing to px', () => {
    const result = mapFigmaStyles([style({ style_type: 'TEXT', name: 'Headline/LG' })], {
      '1:1': {
        id: '1:1',
        style: {
          fontFamily: 'Inter',
          fontWeight: 700,
          fontSize: 32,
          lineHeightPx: 38.4,
          letterSpacing: -0.64,
          textCase: 'UPPER',
        },
      },
    })
    expect(result.typography['headline-lg']).toEqual({
      fontFamily: 'Inter',
      fontSize: '32px',
      fontWeight: 700,
      lineHeight: '38.4px',
      letterSpacing: '-0.64px',
      textTransform: 'uppercase',
    })
  })

  it('omits a zero letter spacing rather than writing 0px', () => {
    const result = mapFigmaStyles([style({ style_type: 'TEXT', name: 'Body' })], {
      '1:1': { id: '1:1', style: { fontFamily: 'Inter', fontSize: 16, letterSpacing: 0 } },
    })
    expect(result.typography.body).not.toHaveProperty('letterSpacing')
    expect(result.typography.body.lineHeight).toBe(1)
  })

  it('composes drop shadows into one box-shadow value', () => {
    const result = mapFigmaStyles([style({ style_type: 'EFFECT', name: 'Elevation/1' })], {
      '1:1': {
        id: '1:1',
        effects: [
          {
            type: 'DROP_SHADOW',
            color: { r: 0, g: 0, b: 0, a: 0.1 },
            offset: { x: 0, y: 2 },
            radius: 4,
            spread: 0,
          },
        ],
      },
    })
    expect(result.shadows['elevation-1']).toEqual({
      value: '0px 2px 4px 0px rgba(0, 0, 0, 0.1)',
    })
  })

  it('keeps several effects as separate layers and marks an inner shadow inset', () => {
    const result = mapFigmaStyles([style({ style_type: 'EFFECT', name: 'Stack' })], {
      '1:1': {
        id: '1:1',
        effects: [
          { type: 'DROP_SHADOW', offset: { x: 0, y: 1 }, radius: 2 },
          { type: 'INNER_SHADOW', offset: { x: 0, y: 1 }, radius: 3 },
        ],
      },
    })
    expect(result.shadows.stack).toEqual({
      value: ['0px 1px 2px 0px rgba(0, 0, 0, 1)', 'inset 0px 1px 3px 0px rgba(0, 0, 0, 1)'],
      inset: true,
    })
  })

  it('reports a blur effect rather than approximating it', () => {
    const result = mapFigmaStyles([style({ style_type: 'EFFECT', name: 'Frost' })], {
      '1:1': { id: '1:1', effects: [{ type: 'LAYER_BLUR', radius: 8 }] },
    })
    expect(result.shadows).toEqual({})
    expect(result.notes.map((n) => n.reason)).toEqual([
      'layer blur has no box-shadow equivalent',
      'the effect style has no visible shadow',
    ])
  })

  it('reports a grid style — it has no token equivalent', () => {
    const result = mapFigmaStyles([style({ style_type: 'GRID', name: '12 col' })], {
      '1:1': { id: '1:1' },
    })
    expect(result.notes[0].reason).toBe('grid styles have no token equivalent')
  })

  it('reports a style whose node was not returned', () => {
    const result = mapFigmaStyles([style({ name: 'Ghost', node_id: '9:9' })], {})
    expect(result.notes[0]).toEqual({
      kind: 'skipped',
      source: 'Ghost',
      reason: 'the style has no readable node in this file',
    })
  })

  it('keeps the first claimant when two names normalise to one key', () => {
    const nodes: Record<string, FigmaNode> = {
      '1:1': { id: '1:1', fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }] },
      '2:2': { id: '2:2', fills: [{ type: 'SOLID', color: { r: 0, g: 1, b: 0 } }] },
    }
    const result = mapFigmaStyles(
      [style({ name: 'Primary 500', node_id: '2:2' }), style({ name: 'primary/500', node_id: '1:1' })],
      nodes,
    )
    expect(result.colors['primary-500']).toBe('#00FF00')
    expect(result.notes[0]).toEqual({
      kind: 'collision',
      source: 'primary/500',
      reason: 'another style or variable already maps to primary-500',
    })
  })

  it('is deterministic whatever order Figma returns styles in', () => {
    const nodes: Record<string, FigmaNode> = {
      '1:1': { id: '1:1', fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }] },
      '2:2': { id: '2:2', fills: [{ type: 'SOLID', color: { r: 0, g: 1, b: 0 } }] },
    }
    const a = style({ name: 'Alpha', node_id: '1:1' })
    const b = style({ name: 'Beta', node_id: '2:2' })
    expect(JSON.stringify(mapFigmaStyles([a, b], nodes))).toBe(
      JSON.stringify(mapFigmaStyles([b, a], nodes)),
    )
  })
})

describe('mapFigmaVariables', () => {
  const collection = (over: Partial<FigmaVariableCollection> = {}): FigmaVariableCollection => ({
    id: 'c1',
    name: 'Core',
    defaultModeId: 'm-light',
    modes: [
      { modeId: 'm-light', name: 'Light' },
      { modeId: 'm-dark', name: 'Dark' },
    ],
    ...over,
  })

  const variable = (over: Partial<FigmaVariable>): FigmaVariable => ({
    id: 'v1',
    name: 'Primary',
    variableCollectionId: 'c1',
    resolvedType: 'COLOR',
    valuesByMode: {},
    ...over,
  })

  it('maps a color variable and its dark mode', () => {
    const result = mapFigmaVariables(
      {
        v1: variable({
          valuesByMode: {
            'm-light': { r: 0, g: 0, b: 1 },
            'm-dark': { r: 0.1, g: 0.1, b: 0.6 },
          },
        }),
      },
      { c1: collection() },
    )
    expect(result.colors).toEqual({ primary: '#0000FF' })
    expect(result.darkColors).toEqual({ primary: '#1A1A99' })
    expect(result.counts.variables).toBe(1)
  })

  it('finds the dark mode by name, not by position', () => {
    const result = mapFigmaVariables(
      {
        v1: variable({
          valuesByMode: { 'm-a': { r: 1, g: 1, b: 1 }, 'm-b': { r: 0, g: 0, b: 0 } },
        }),
      },
      {
        c1: collection({
          defaultModeId: 'm-a',
          modes: [
            { modeId: 'm-b', name: 'Night' },
            { modeId: 'm-a', name: 'Day' },
          ],
        }),
      },
    )
    expect(result.colors.primary).toBe('#FFFFFF')
    expect(result.darkColors.primary).toBe('#000000')
  })

  it('leaves dark mode alone when the collection has only one mode', () => {
    const result = mapFigmaVariables(
      { v1: variable({ valuesByMode: { 'm-light': { r: 1, g: 1, b: 1 } } }) },
      { c1: collection({ modes: [{ modeId: 'm-light', name: 'Default' }] }) },
    )
    expect(result.darkColors).toEqual({})
  })

  it('reports every mode beyond the default and the dark one', () => {
    const result = mapFigmaVariables(
      {},
      {
        c1: collection({
          modes: [
            { modeId: 'm-light', name: 'Light' },
            { modeId: 'm-dark', name: 'Dark' },
            { modeId: 'm-hc', name: 'High contrast' },
          ],
        }),
      },
    )
    expect(result.notes).toEqual([
      {
        kind: 'mode',
        source: 'Core / High contrast',
        reason: 'only the default and dark modes are imported',
      },
    ])
  })

  it('routes a float by name — radius to rounded, everything else to spacing', () => {
    const result = mapFigmaVariables(
      {
        v1: variable({
          id: 'v1',
          name: 'Corner Radius/md',
          resolvedType: 'FLOAT',
          valuesByMode: { 'm-light': 8 },
        }),
        v2: variable({
          id: 'v2',
          name: 'Space/lg',
          resolvedType: 'FLOAT',
          valuesByMode: { 'm-light': 24 },
        }),
      },
      { c1: collection() },
    )
    expect(result.rounded).toEqual({ 'corner-radius-md': '8px' })
    expect(result.spacing).toEqual({ 'space-lg': '24px' })
  })

  it('follows a variable alias to its concrete value', () => {
    const result = mapFigmaVariables(
      {
        base: variable({ id: 'base', name: 'Blue/500', valuesByMode: { 'm-light': { r: 0, g: 0, b: 1 } } }),
        alias: variable({
          id: 'alias',
          name: 'Primary',
          valuesByMode: { 'm-light': { type: 'VARIABLE_ALIAS', id: 'base' } },
        }),
      },
      { c1: collection() },
    )
    expect(result.colors.primary).toBe('#0000FF')
  })

  it('gives up on an alias loop instead of hanging', () => {
    const result = mapFigmaVariables(
      {
        a: variable({ id: 'a', name: 'A', valuesByMode: { 'm-light': { type: 'VARIABLE_ALIAS', id: 'b' } } }),
        b: variable({ id: 'b', name: 'B', valuesByMode: { 'm-light': { type: 'VARIABLE_ALIAS', id: 'a' } } }),
      },
      { c1: collection() },
    )
    expect(result.colors).toEqual({})
    expect(result.notes).toHaveLength(2)
  })

  it('reports a string variable — it has no token equivalent', () => {
    const result = mapFigmaVariables(
      {
        v1: variable({ name: 'Brand name', resolvedType: 'STRING', valuesByMode: { 'm-light': 'Acme' } }),
      },
      { c1: collection() },
    )
    expect(result.notes[0].reason).toBe('string variables have no token equivalent')
  })

  it('reports a variable whose collection is missing', () => {
    const result = mapFigmaVariables({ v1: variable({ variableCollectionId: 'gone' }) }, {})
    expect(result.notes[0].reason).toBe(
      'the variable belongs to a collection this file does not expose',
    )
  })

  it('accumulates onto an existing import so styles and variables share a result', () => {
    const base = mapFigmaStyles([style({ name: 'Surface' })], {
      '1:1': { id: '1:1', fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }] },
    })
    const result = mapFigmaVariables(
      { v1: variable({ valuesByMode: { 'm-light': { r: 0, g: 0, b: 1 } } }) },
      { c1: collection() },
      base,
    )
    expect(Object.keys(result.colors).sort()).toEqual(['primary', 'surface'])
    expect(result.counts).toMatchObject({ styles: 1, variables: 1, tokens: 2 })
  })
})

describe('applyFigmaImport', () => {
  const schema = () => JSON.parse(JSON.stringify(defaultSchema)) as DesignSystemSchema

  it('merge adds and updates without removing anything', () => {
    const imported = emptyImport()
    imported.colors = { primary: '#FF0000', brand: '#00FF00' }
    const next = applyFigmaImport(schema(), imported, 'merge')
    expect(next.colors.primary).toBe('#FF0000')
    expect(next.colors.brand).toBe('#00FF00')
    expect(next.colors.success).toBe(defaultSchema.colors.success)
  })

  it('replace swaps the whole group', () => {
    const imported = emptyImport()
    imported.colors = { primary: '#FF0000' }
    const next = applyFigmaImport(schema(), imported, 'replace')
    expect(next.colors).toEqual({ primary: '#FF0000' })
  })

  it('replace leaves a group the import never populated alone', () => {
    const imported = emptyImport()
    imported.colors = { primary: '#FF0000' }
    const next = applyFigmaImport(schema(), imported, 'replace')
    expect(next.shadows).toEqual(defaultSchema.shadows)
    expect(next.typography).toEqual(defaultSchema.typography)
  })

  it('turns dark mode on when the file publishes one', () => {
    const imported = emptyImport()
    imported.darkColors = { primary: '#111111' }
    const next = applyFigmaImport(schema(), imported, 'merge')
    expect(next.darkMode.enabled).toBe(true)
    expect(next.darkMode.colors.primary).toBe('#111111')
  })

  it('leaves dark mode untouched when the file has none', () => {
    const before = schema()
    const next = applyFigmaImport(before, emptyImport(), 'replace')
    expect(next.darkMode).toEqual(before.darkMode)
  })

  it('does not mutate the schema it was given', () => {
    const before = schema()
    const imported = emptyImport()
    imported.colors = { primary: '#FF0000' }
    applyFigmaImport(before, imported, 'replace')
    expect(before.colors.primary).toBe(defaultSchema.colors.primary)
  })
})

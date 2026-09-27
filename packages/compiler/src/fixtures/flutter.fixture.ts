// flutter.fixture.ts — schemas for the Flutter golden suite: the responsive
// fixture with dark mode on, in each `flutterNaming` mode. Excluded from the
// build (see tsconfig).

import type { DesignSystemSchema, ExportConfig } from '../types/schema.js'
import { responsiveSchema } from './responsive.fixture.js'

export const FLUTTER_NAMINGS: ExportConfig['flutterNaming'][] = ['prefixed-class', 'snake_const', 'raw']

/** Responsive Button + dark-mode overrides, exporting the Flutter stack. */
export const flutterSchema: DesignSystemSchema = {
  ...responsiveSchema,
  name: 'Flutter Fixture',
  darkMode: {
    enabled: true,
    colors: { primary: '#60A5FA', surface: '#0F172A', 'on-surface': '#F8FAFC' },
  },
  export: { ...responsiveSchema.export, frameworks: ['flutter'] },
}

/** `flutterSchema` in one naming mode. */
export function withNaming(naming: ExportConfig['flutterNaming'], base: DesignSystemSchema = flutterSchema): DesignSystemSchema {
  return { ...base, export: { ...base.export, flutterNaming: naming } }
}

/**
 * Blueprints that hit the widget emitter's rare branches: visibility per
 * breakpoint, an undefined breakpoint, required / enum / numeric / extra-slot
 * props, a reserved-word prop, literal values (one matching a token exactly),
 * shadow + border-color refs, and a non-interactive (`data`) category.
 */
export const flutterEdgeSchema: DesignSystemSchema = {
  ...flutterSchema,
  name: 'Flutter Edge Fixture',
  componentBlueprints: {
    StatCard: {
      name: 'stat-card',
      description: 'A KPI tile.',
      category: 'data',
      variants: ['default'],
      sizes: [],
      states: ['default'],
      anatomy: ['root', 'value', 'icon'],
      props: {
        value: { type: 'number', required: true },
        trend: { type: 'enum', values: ['up', 'down', 'flat'] },
        tone: { type: 'enum', values: ['default', 'accent'], default: 'default' },
        precision: { type: 'number', default: 2 },
        caption: { type: 'string', required: true, description: 'Label under the value.' },
        icon: { type: 'slot' },
        in: { type: 'boolean', default: true },
        children: { type: 'slot', required: true },
        loose: { type: 'enum' },
      },
      tokens: {
        base: {
          backgroundColor: '#FFFFFF',
          textColor: '#123456',
          borderColor: '{borders.color.default}',
          shadow: '{shadows.md}',
          rounded: '12px',
          padding: '{spacing.lg}',
          size: '96px',
        },
      },
      examples: [],
      responsive: {
        mystery: { tokens: { padding: '{spacing.xl}' } },
        tablet: { visibleAt: false },
        desktop: { visibleAt: true, tokens: { shadow: '0 2px 4px rgba(0,0,0,0.2)' } },
      },
    },
    Divider: {
      name: 'Divider',
      description: 'A hairline rule.',
      category: 'layout',
      variants: [],
      sizes: [],
      states: [],
      anatomy: ['root'],
      props: {},
      tokens: { base: { borderWidth: '{borders.width.thin}', height: '1px', width: '{layout.container.maxWidth}' } },
      examples: [],
    },
    Empty: {
      name: 'Empty',
      description: 'No tokens at all.',
      category: 'feedback',
      variants: ['a', 'b'],
      sizes: [],
      states: [],
      anatomy: [],
      props: { variant: { type: 'enum', values: ['a', 'b'] } },
      tokens: { base: { typography: '#nope', textColor: '{colors.missing}' } },
      examples: [],
    },
  },
}

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

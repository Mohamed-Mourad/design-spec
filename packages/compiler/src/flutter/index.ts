// flutter/index.ts — the Flutter stack: Dart theme files for a Material 3 app.
//
// Pure (schema) => FileOutput[], deterministic, fixed file order. Identifiers
// follow `schema.export.flutterNaming` (see naming.ts).

import type { DesignSystemSchema } from '../types/schema.js'
import type { FileOutput } from '../types/compiler.js'
import { compileFlutterColors } from './colors.js'
import { compileFlutterTypography } from './typography.js'
import { compileFlutterSpacing } from './spacing.js'
import { compileFlutterTheme } from './theme.js'

/** The `lib/theme/*.dart` token files. */
export function compileFlutterTokens(schema: DesignSystemSchema): FileOutput[] {
  return [
    compileFlutterColors(schema),
    compileFlutterTypography(schema),
    compileFlutterSpacing(schema),
    compileFlutterTheme(schema),
  ]
}

/** Every Flutter output: theme token files. */
export function compileFlutter(schema: DesignSystemSchema): FileOutput[] {
  return compileFlutterTokens(schema)
}

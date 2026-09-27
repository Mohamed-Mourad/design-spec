// flutter/index.ts — the Flutter stack: Dart theme files for a Material 3 app
// plus a widget stub per component blueprint.
//
// Pure (schema) => FileOutput[], deterministic, fixed file order. Identifiers
// follow `schema.export.flutterNaming` (see naming.ts).

import type { DesignSystemSchema } from '../types/schema.js'
import type { FileOutput } from '../types/compiler.js'
import { compileFlutterColors } from './colors.js'
import { compileFlutterTypography } from './typography.js'
import { compileFlutterSpacing } from './spacing.js'
import { compileFlutterTheme } from './theme.js'
import { compileFlutterWidgets } from './widgets.js'

/** The `lib/theme/*.dart` token files. */
export function compileFlutterTokens(schema: DesignSystemSchema): FileOutput[] {
  return [
    compileFlutterColors(schema),
    compileFlutterTypography(schema),
    compileFlutterSpacing(schema),
    compileFlutterTheme(schema),
  ]
}

/** Every Flutter output: theme token files, then one widget stub per blueprint. */
export function compileFlutter(schema: DesignSystemSchema): FileOutput[] {
  return [...compileFlutterTokens(schema), ...compileFlutterWidgets(schema)]
}

// flutter/colors.ts — schema colors → lib/theme/app_colors.dart.
//
// The central color mapping file: the one place raw `Color(0xFF…)` literals
// live. Everything else (theme, widgets, Janitor fixes) references these by the
// identifier `naming.ts` derives. Dark-mode overrides are a second group when
// `darkMode.enabled`. Pure, deterministic, insertion-order stable.

import type { DesignSystemSchema } from '../types/schema.js'
import type { FileOutput } from '../types/compiler.js'
import { declareGroup, lintHeader, DART_HEADER, type DartDecl } from './naming.js'
import { colorLiteral } from './values.js'

function decls(colors: Record<string, string>): DartDecl[] {
  const out: DartDecl[] = []
  for (const [name, hex] of Object.entries(colors)) {
    const value = colorLiteral(hex)
    if (value) out.push({ name, value })
  }
  return out
}

/** Dark overrides the theme should apply, or {} when dark mode is off. */
export function darkColors(schema: DesignSystemSchema): Record<string, string> {
  return schema.darkMode?.enabled ? schema.darkMode.colors : {}
}

export function compileFlutterColors(schema: DesignSystemSchema): FileOutput {
  const naming = schema.export.flutterNaming
  const lines = [
    ...DART_HEADER,
    ...lintHeader(naming),
    '',
    "import 'package:flutter/painting.dart';",
    '',
    ...declareGroup(naming, 'colors', 'Color', decls(schema.colors), 'Color tokens (light).'),
  ]
  const dark = darkColors(schema)
  if (Object.keys(dark).length > 0) {
    lines.push(
      '',
      ...declareGroup(naming, 'colorsDark', 'Color', decls(dark), 'Dark-mode color overrides — applied by AppTheme.dark.'),
    )
  }
  lines.push('')
  return { filename: 'lib/theme/app_colors.dart', content: lines.join('\n'), language: 'dart' }
}

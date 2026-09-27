// flutter/theme.ts — assemble lib/theme/app_theme.dart (Material 3 ThemeData).
//
// `AppTheme.light` seeds a Material 3 ColorScheme from the primary color, then
// pins every schema color whose name matches a ColorScheme role (`primary`,
// `on-surface` → onSurface, `border` → outline, …). Typography tokens named on
// the M3 type scale (`headline-lg` → headlineLarge) fill the TextTheme.
// `AppTheme.dark` (only when `darkMode.enabled`) starts from `ThemeData.dark()`
// and pins only the overridden roles — the seed derives the rest, which is the
// Flutter-idiomatic counterpart to the web's `prefers-color-scheme` override.
// References token identifiers only; no literals. Pure.

import type { DesignSystemSchema } from '../types/schema.js'
import type { FileOutput } from '../types/compiler.js'
import { DART_HEADER, dartIdent, flutterRef, lintHeader, words, type FlutterNaming } from './naming.js'
import { darkColors } from './colors.js'

/** Material 3 ColorScheme roles a schema color can pin by name. */
const COLOR_ROLES = new Set([
  'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer',
  'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
  'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer',
  'error', 'onError', 'errorContainer', 'onErrorContainer',
  'surface', 'onSurface', 'onSurfaceVariant', 'surfaceTint',
  'surfaceContainerLowest', 'surfaceContainerLow', 'surfaceContainer', 'surfaceContainerHigh', 'surfaceContainerHighest',
  'inverseSurface', 'onInverseSurface', 'inversePrimary',
  'outline', 'outlineVariant', 'shadow', 'scrim',
])

/** Common web token names for a role the schema didn't name exactly. */
const ROLE_ALIASES: Record<string, string> = { border: 'outline' }

/** role → schema color name, in schema order; an exact role name beats an alias. */
export function colorRoles(colors: Record<string, string>): Array<[string, string]> {
  const byRole = new Map<string, string>()
  for (const name of Object.keys(colors)) {
    const id = dartIdent(name)
    if (COLOR_ROLES.has(id)) byRole.set(id, name)
  }
  for (const name of Object.keys(colors)) {
    const role = ROLE_ALIASES[dartIdent(name)]
    if (role && !byRole.has(role)) byRole.set(role, name)
  }
  return [...byRole.entries()]
}

const TYPE_ROLES = ['display', 'headline', 'title', 'body', 'label']
const TYPE_SIZES: Record<string, string> = { lg: 'Large', large: 'Large', md: 'Medium', medium: 'Medium', sm: 'Small', small: 'Small' }

/** M3 TextTheme slot → typography token name (`headline-lg` → headlineLarge). */
export function textRoles(typography: Record<string, unknown>): Array<[string, string]> {
  const out = new Map<string, string>()
  for (const name of Object.keys(typography)) {
    const ws = words(name)
    if (ws.length !== 2 || !TYPE_ROLES.includes(ws[0]) || !TYPE_SIZES[ws[1]]) continue
    const slot = `${ws[0]}${TYPE_SIZES[ws[1]]}`
    if (!out.has(slot)) out.set(slot, name)
  }
  return [...out.entries()]
}

function colorSchemeExpr(
  brightness: 'light' | 'dark',
  seed: string,
  roles: Array<[string, string]>,
  ind: string,
): string[] {
  const lines = [
    `${ind}colorScheme: ColorScheme.fromSeed(`,
    `${ind}  seedColor: ${seed},`,
    `${ind}  brightness: Brightness.${brightness},`,
  ]
  if (roles.length === 0) {
    lines.push(`${ind}),`)
    return lines
  }
  lines.push(`${ind}).copyWith(`)
  for (const [role, ref] of roles) lines.push(`${ind}  ${role}: ${ref},`)
  lines.push(`${ind}),`)
  return lines
}

function textThemeArgs(naming: FlutterNaming, slots: Array<[string, string]>, ind: string): string[] {
  return slots.map(([slot, name]) => `${ind}${slot}: ${flutterRef(naming, 'typography', name)},`)
}

export function compileFlutterTheme(schema: DesignSystemSchema): FileOutput {
  const naming = schema.export.flutterNaming
  const colorNames = Object.keys(schema.colors)
  const seedName = 'primary' in schema.colors ? 'primary' : colorNames[0]
  const lightSeed = seedName !== undefined ? flutterRef(naming, 'colors', seedName) : 'Color(0xFF6750A4)'
  const lightRoles = colorRoles(schema.colors).map(([role, n]) => [role, flutterRef(naming, 'colors', n)] as [string, string])
  const slots = textRoles(schema.typography)
  const surface = 'surface' in schema.colors ? flutterRef(naming, 'colors', 'surface') : null

  const lines = [
    ...DART_HEADER,
    ...lintHeader(naming),
    '',
    "import 'package:flutter/material.dart';",
    '',
    "import 'app_colors.dart';",
    ...(slots.length ? ["import 'app_typography.dart';"] : []),
    '',
    '/// Material 3 themes assembled from the design tokens.',
    'abstract final class AppTheme {',
    '  static ThemeData get light => ThemeData(',
    '        useMaterial3: true,',
    '        brightness: Brightness.light,',
    ...colorSchemeExpr('light', lightSeed, lightRoles, '        '),
    ...(surface ? [`        scaffoldBackgroundColor: ${surface},`] : []),
  ]
  if (slots.length) {
    lines.push('        textTheme: const TextTheme(', ...textThemeArgs(naming, slots, '          '), '        ),')
  }
  lines.push('      );')

  const dark = darkColors(schema)
  if (schema.darkMode?.enabled) {
    const darkRef = (n: string) => flutterRef(naming, 'colorsDark', n)
    const darkSeed = seedName !== undefined && seedName in dark ? darkRef(seedName) : lightSeed
    const darkRoles = colorRoles(dark).map(([role, n]) => [role, darkRef(n)] as [string, string])
    lines.push(
      '',
      '  static ThemeData get dark {',
      '    final base = ThemeData.dark(useMaterial3: true);',
      '    return base.copyWith(',
      ...colorSchemeExpr('dark', darkSeed, darkRoles, '      '),
      ...('surface' in dark ? [`      scaffoldBackgroundColor: ${darkRef('surface')},`] : []),
    )
    if (slots.length) {
      lines.push('      textTheme: base.textTheme.merge(const TextTheme(', ...textThemeArgs(naming, slots, '        '), '      )),')
    }
    lines.push('    );', '  }')
  }
  lines.push('}', '')

  return { filename: 'lib/theme/app_theme.dart', content: lines.join('\n'), language: 'dart' }
}

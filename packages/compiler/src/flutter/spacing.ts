// flutter/spacing.ts — spatial tokens → lib/theme/app_spacing.dart.
//
// Spacing, radii, border widths, shadows (elevation) and breakpoints — every
// non-color, non-type token a layout needs, as logical-pixel doubles (and
// `List<BoxShadow>` for shadows). Breakpoints feed the widgets' `LayoutBuilder`
// thresholds; Flutter has no media queries. Pure, deterministic.

import type { DesignSystemSchema } from '../types/schema.js'
import type { FileOutput } from '../types/compiler.js'
import { declareGroup, lintHeader, DART_HEADER, type DartDecl, type FlutterGroup } from './naming.js'
import { num, toPx, parseShadow } from './values.js'

function lengthDecls(group: Record<string, unknown>): DartDecl[] {
  const out: DartDecl[] = []
  for (const [name, v] of Object.entries(group)) {
    const px = toPx(v)
    if (px !== null) out.push({ name, value: num(px) })
  }
  return out
}

/** `List<BoxShadow>` const expression for one shadow token, with a note for dropped layers. */
export function shadowList(value: string | string[], inset?: boolean): { value: string; note?: string } {
  const { layers, dropped } = parseShadow(value, inset)
  return {
    value: `[${layers.join(', ')}]`,
    note: dropped.length ? `not expressible as BoxShadow: ${dropped.join(', ')}` : undefined,
  }
}

export function compileFlutterSpacing(schema: DesignSystemSchema): FileOutput {
  const naming = schema.export.flutterNaming
  const block = (group: FlutterGroup, type: string, decls: DartDecl[], doc: string) => [
    '',
    ...declareGroup(naming, group, type, decls, doc),
  ]
  const shadows: DartDecl[] = Object.entries(schema.shadows).map(([name, s]) => ({
    name,
    ...shadowList(s.value, s.inset),
  }))

  const lines = [
    ...DART_HEADER,
    ...lintHeader(naming),
    '',
    "import 'package:flutter/painting.dart';",
    ...block('spacing', 'double', lengthDecls(schema.spacing), 'Spacing scale (logical px).'),
    ...block('rounded', 'double', lengthDecls(schema.rounded), 'Corner radii (logical px).'),
    ...block('borderWidth', 'double', lengthDecls(schema.borders.width), 'Border widths (logical px).'),
    ...block('shadows', 'List<BoxShadow>', shadows, 'Elevation shadows.'),
    ...block(
      'breakpoints',
      'double',
      lengthDecls(schema.breakpoints),
      'Breakpoint min-widths (logical px) — compare against LayoutBuilder constraints.maxWidth.',
    ),
    '',
  ]
  return { filename: 'lib/theme/app_spacing.dart', content: lines.join('\n'), language: 'dart' }
}

// flutter/typography.ts — schema typography → lib/theme/app_typography.dart.
//
// One const `TextStyle` per token. CSS → Flutter: `lineHeight` becomes the
// `height` multiplier (a px line-height is divided by the font size),
// `letterSpacing` in em is scaled by the font size, font weights snap to the
// nearest `FontWeight.w100…w900`. `textTransform` / OpenType settings have no
// const TextStyle equivalent and are kept as a trailing note. Pure.

import type { DesignSystemSchema, TypographyToken } from '../types/schema.js'
import type { FileOutput } from '../types/compiler.js'
import { declareGroup, lintHeader, DART_HEADER, type DartDecl } from './naming.js'
import { num, toPx, dartString } from './values.js'

const ROOT_PX = 16

function weight(w: number): string {
  const snapped = Math.min(900, Math.max(100, Math.round(w / 100) * 100))
  return `FontWeight.w${snapped}`
}

/** `Inter, "Helvetica Neue", sans-serif` → ['Inter', 'Helvetica Neue', 'sans-serif']. */
function families(stack: string): string[] {
  return stack
    .split(',')
    .map((f) => f.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
}

/** CSS line-height → Flutter `height` multiplier, or null. */
function height(lh: TypographyToken['lineHeight'], fontSize: number): number | null {
  if (typeof lh === 'number') return lh
  const s = String(lh).trim()
  if (/^-?\d*\.?\d+$/.test(s)) return parseFloat(s)
  if (s.endsWith('em') && !s.endsWith('rem')) return parseFloat(s)
  const px = toPx(s)
  return px !== null && fontSize > 0 ? px / fontSize : null
}

/** CSS letter-spacing → logical px, or null. `em` is relative to the font size. */
function letterSpacing(ls: TypographyToken['letterSpacing'], fontSize: number): number | null {
  if (ls === undefined) return null
  const s = String(ls).trim()
  if (s.endsWith('em') && !s.endsWith('rem')) return parseFloat(s) * fontSize
  return toPx(s)
}

/** A const `TextStyle(...)` expression for one token, plus a note for dropped CSS features. */
export function textStyle(t: TypographyToken): { value: string; note?: string } {
  const fontSize = toPx(t.fontSize) ?? ROOT_PX
  const [family, ...fallback] = families(t.fontFamily)
  const args: string[] = []
  if (family) args.push(`fontFamily: ${dartString(family)}`)
  if (fallback.length) args.push(`fontFamilyFallback: [${fallback.map(dartString).join(', ')}]`)
  args.push(`fontSize: ${num(fontSize)}`)
  args.push(`fontWeight: ${weight(t.fontWeight)}`)
  const h = height(t.lineHeight, fontSize)
  if (h !== null) args.push(`height: ${num(h)}`)
  const ls = letterSpacing(t.letterSpacing, fontSize)
  if (ls !== null) args.push(`letterSpacing: ${num(ls)}`)

  const dropped: string[] = []
  if (t.textTransform && t.textTransform !== 'none') dropped.push(`textTransform: ${t.textTransform}`)
  if (t.fontFeature) dropped.push(`fontFeature: ${t.fontFeature}`)
  if (t.fontVariation) dropped.push(`fontVariation: ${t.fontVariation}`)

  return {
    value: `TextStyle(${args.join(', ')})`,
    note: dropped.length ? `apply in code: ${dropped.join('; ')}` : undefined,
  }
}

export function compileFlutterTypography(schema: DesignSystemSchema): FileOutput {
  const naming = schema.export.flutterNaming
  const decls: DartDecl[] = Object.entries(schema.typography).map(([name, t]) => ({ name, ...textStyle(t) }))
  const lines = [
    ...DART_HEADER,
    ...lintHeader(naming),
    '',
    "import 'package:flutter/painting.dart';",
    '',
    ...declareGroup(naming, 'typography', 'TextStyle', decls, 'Text styles. Color comes from the theme / widget, not the style.'),
    '',
  ]
  return { filename: 'lib/theme/app_typography.dart', content: lines.join('\n'), language: 'dart' }
}

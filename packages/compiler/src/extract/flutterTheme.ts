// extract/flutterTheme.ts — read colors out of a Flutter theme file.
//
// Parses `static const Color name = Color(0xAARRGGBB);` declarations. The alpha
// byte is dropped (schema colors are opaque sRGB hex). No Dart is evaluated;
// this is the same static-only rule the JS path follows.

import type { ColorValue } from '../types/schema.js'

const COLOR_DECL =
  /(?:static\s+(?:const|final)\s+)?Color\??\s+(\w+)\s*=\s*(?:const\s+)?Color\(\s*0x([0-9a-fA-F]{6,8})\s*\)/g

/** `Color(0xFF2563EB)` → `#2563EB`; a 6-digit literal is taken as-is. */
export function parseFlutterColors(source: string): Record<string, ColorValue> {
  const colors: Record<string, ColorValue> = {}
  for (const m of source.matchAll(COLOR_DECL)) {
    const name = m[1].replace(/^_/, '')
    const hex = m[2].length === 8 ? m[2].slice(2) : m[2]
    if (colors[name] === undefined) colors[name] = `#${hex.toUpperCase()}` as ColorValue
  }
  return colors
}

// scanners/flutter.ts — extract colors from a Flutter app_colors/app_theme.
//
// Parses `static const Color name = Color(0xFFRRGGBB);` declarations. The alpha
// byte is dropped (schema colors are sRGB hex). No Dart evaluation.

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ColorValue } from '@design-spec/compiler'

export interface FlutterScan {
  colors: Record<string, ColorValue>
}

const DECL = /(?:static\s+const\s+)?Color\s+(\w+)\s*=\s*Color\(0x([0-9a-fA-F]{8})\)/g

/** Parse Dart source for `Color name = Color(0xAARRGGBB)` declarations. Pure. */
export function parseFlutterColors(source: string): Record<string, ColorValue> {
  const colors: Record<string, ColorValue> = {}
  for (const m of source.matchAll(DECL)) {
    const name = m[1].replace(/^_/, '')
    const hex = m[2].slice(2) // drop AA
    colors[name] = `#${hex.toUpperCase()}` as ColorValue
  }
  return colors
}

const FILES = ['lib/theme/app_colors.dart', 'lib/theme/app_theme.dart', 'lib/app_colors.dart', 'lib/app_theme.dart']

/** Scan a Flutter project root for theme color declarations. */
export async function scanFlutter(root: string): Promise<FlutterScan> {
  const colors: Record<string, ColorValue> = {}
  for (const rel of FILES) {
    const p = join(root, rel)
    if (!existsSync(p)) continue
    try {
      Object.assign(colors, parseFlutterColors(await readFile(p, 'utf8')))
    } catch {
      /* skip unreadable file */
    }
  }
  return { colors }
}

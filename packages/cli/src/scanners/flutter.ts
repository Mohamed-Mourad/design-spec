// scanners/flutter.ts — read a Flutter theme's colors off disk.
//
// A filesystem adapter over the compiler's `parseFlutterColors`, shared with the
// cloud retrofit. No Dart is evaluated on either path.

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { parseFlutterColors, type ColorValue } from '@design-spec/compiler'

export { parseFlutterColors } from '@design-spec/compiler'

export interface FlutterScan {
  colors: Record<string, ColorValue>
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

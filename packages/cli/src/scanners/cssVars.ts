// scanners/cssVars.ts — extract CSS custom properties from :root blocks.
//
// Reads *.css / *.scss for `--token: value` declarations inside a `:root {…}`
// rule. Colors are mapped into the schema's colors group; everything else is
// returned for the caller to slot or ignore. No JS evaluation.

import { readFile } from 'node:fs/promises'
import type { ColorValue } from '@design-spec/compiler'

export interface CssVarScan {
  colors: Record<string, ColorValue>
  other: Record<string, string>
}

const ROOT_BLOCK = /:root\s*\{([^}]*)\}/g
const DECL = /--([\w-]+)\s*:\s*([^;]+);/g
const HEX = /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/

/** Parse CSS source for :root custom properties. Pure. */
export function parseCssVars(source: string): CssVarScan {
  const colors: Record<string, ColorValue> = {}
  const other: Record<string, string> = {}

  for (const block of source.matchAll(ROOT_BLOCK)) {
    const body = block[1]
    for (const decl of body.matchAll(DECL)) {
      const name = decl[1].trim()
      const value = decl[2].trim()
      // Strip a leading "color-" prefix so `--color-primary` → `primary`.
      const key = name.replace(/^color-/, '')
      if (HEX.test(value)) colors[key] = value as ColorValue
      else other[name] = value
    }
  }
  return { colors, other }
}

/** Scan a list of CSS/SCSS files, merging results (first file wins on conflict). */
export async function scanCssFiles(files: string[]): Promise<CssVarScan> {
  const merged: CssVarScan = { colors: {}, other: {} }
  for (const file of files) {
    let src: string
    try {
      src = await readFile(file, 'utf8')
    } catch {
      continue
    }
    const scan = parseCssVars(src)
    merged.colors = { ...scan.colors, ...merged.colors }
    merged.other = { ...scan.other, ...merged.other }
  }
  return merged
}

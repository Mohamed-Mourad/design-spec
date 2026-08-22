// scanners/cssVars.ts — read CSS custom properties off disk.
//
// A filesystem adapter over the compiler's `extractCssCustomProps`, which is
// shared with the cloud retrofit's Smart Fallback. This module owns only file
// I/O and merge order; all classification lives in the compiler.

import { readFile } from 'node:fs/promises'
import { extractCssCustomProps, type CssVarExtraction } from '@design-spec/compiler'

export type CssVarScan = CssVarExtraction

/** Parse CSS source for theme-level custom properties. Pure. */
export { extractCssCustomProps as parseCssVars } from '@design-spec/compiler'

function emptyScan(): CssVarScan {
  return {
    colors: {},
    darkColors: {},
    spacing: {},
    rounded: {},
    shadows: {},
    fontFamily: {},
    fontSize: {},
    breakpoints: {},
    borderWidth: {},
    other: {},
    declarationCount: 0,
  }
}

type ScanGroup = Exclude<keyof CssVarScan, 'declarationCount'>

const GROUPS: ScanGroup[] = [
  'colors',
  'darkColors',
  'spacing',
  'rounded',
  'shadows',
  'fontFamily',
  'fontSize',
  'breakpoints',
  'borderWidth',
  'other',
]

/** Scan CSS/SCSS files, merging results — the first file to define a key wins. */
export async function scanCssFiles(files: string[]): Promise<CssVarScan> {
  const merged = emptyScan()
  for (const file of files) {
    let src: string
    try {
      src = await readFile(file, 'utf8')
    } catch {
      continue
    }
    const scan = extractCssCustomProps(src)
    for (const group of GROUPS) {
      Object.assign(merged[group], { ...scan[group], ...merged[group] })
    }
    merged.declarationCount += scan.declarationCount
  }
  return merged
}
